using FlexDemy.Application.Common;
using FlexDemy.Domain.ErrorObservability;
using Microsoft.Extensions.Logging;

namespace FlexDemy.Application.ErrorObservability;

// AD-24/NFR2: the ONE method in this codebase explicitly required to never let an exception
// escape -- the observability system must never itself become a second source of outages. Every
// other Application service signals failure via a thrown AppException subtype (AD-5/AD-10); this
// is a deliberate, narrow exception to that house rule, scoped to exactly this one method. Do not
// "fix" the outer try/catch into a thrown exception.
public class ErrorCaptureService(
    IErrorRecordRepository repository,
    IUnitOfWork unitOfWork,
    IIdGenerator idGenerator,
    ICorrelationIdAccessor correlationIdAccessor,
    ILogger<ErrorCaptureService> logger) : IErrorCaptureService
{
    // Matches the error_records.message column's HasMaxLength(2048).
    private const int MaxMessageLength = 2048;

    public async Task CaptureAsync(ErrorCaptureRequest request, CancellationToken cancellationToken = default)
    {
        try
        {
            var denyListedContextValues = ErrorRedactor.GetDenyListedContextValues(request.Context).ToList();
            var redactedMessage = ErrorRedactor.RedactFreeText(request.Message, denyListedContextValues) ?? request.Message;
            var redactedStackTrace = ErrorRedactor.RedactFreeText(request.StackTrace, denyListedContextValues);
            // Code-review patch: RequestPath commonly carries a raw query string (a reset token,
            // an API key passed as a query parameter) -- FR-5's redaction is mandatory before
            // persistence for any captured free text, not just Message/StackTrace.
            var redactedRequestPath = ErrorRedactor.RedactFreeText(request.RequestPath, denyListedContextValues);

            // Fingerprint is computed from the full redacted message, before truncation -- two
            // long messages that only differ after the 2048-char storage cap should still
            // fingerprint distinctly; only the persisted Message value itself is length-bounded.
            var fingerprint = ErrorFingerprintGenerator.Generate(request.ExceptionType, redactedMessage, request.OriginContext);
            var existing = await repository.GetByFingerprintAsync(fingerprint, cancellationToken);
            var now = DateTimeOffset.UtcNow;

            // Story 4.1/4.4: an explicit caller-supplied value (the anonymous frontend-reporting
            // endpoint's own stored id, since its ambient accessor value belongs to the reporting
            // call itself, not the originating page session) always wins over the ambient accessor.
            var correlationId = request.CorrelationIdOverride ?? correlationIdAccessor.Current;

            if (existing is null)
            {
                var (category, secondaryCategory) = ErrorCategoryMapper.Map(request);
                var priority = ErrorPriorityAssigner.AssignInitial(request, category);

                var record = new ErrorRecord
                {
                    Id = idGenerator.NewId(),
                    Fingerprint = fingerprint,
                    Source = request.Source,
                    Category = category,
                    SecondaryCategory = secondaryCategory,
                    Priority = priority,
                    Status = ErrorStatus.New,
                    Message = Truncate(redactedMessage),
                    ExceptionType = request.ExceptionType,
                    StackTrace = redactedStackTrace,
                    OriginContext = request.OriginContext,
                    RelatedEntityType = request.RelatedEntityType,
                    RelatedEntityId = request.RelatedEntityId,
                    UserId = request.UserId,
                    RequestPath = redactedRequestPath,
                    CorrelationId = correlationId,
                    OccurrenceCount = 1,
                    FirstOccurredAt = now,
                    LastOccurredAt = now,
                };

                try
                {
                    repository.Add(record);
                    await unitOfWork.SaveChangesAsync(cancellationToken);
                }
                catch (Exception)
                {
                    // Code-review patch: a concurrent capture may have already inserted this
                    // Fingerprint between our lookup above and this save -- the unique index on
                    // Fingerprint (ErrorRecordConfiguration) is what actually enforces FR-8's "one
                    // row per Fingerprint" under concurrency. Re-fetch and fall back to the
                    // repeat-occurrence path instead of silently losing this occurrence's
                    // contribution. Catches the generic Exception type, not a specific EF/Npgsql
                    // one, to keep this Application-layer service decoupled from Infrastructure's
                    // persistence technology (AD-1).
                    var raceWinner = await repository.GetByFingerprintAsync(fingerprint, cancellationToken);
                    if (raceWinner is null)
                        throw; // not a uniqueness collision -- some other failure, let the outer catch handle it

                    ApplyRepeatOccurrence(raceWinner, now, correlationId);
                    await unitOfWork.SaveChangesAsync(cancellationToken);
                }
            }
            else
            {
                ApplyRepeatOccurrence(existing, now, correlationId);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
        catch (Exception ex)
        {
            // NFR2: swallowed -- error capture must never itself become a source of outages.
            // Code-review patch: still logged (not rethrown) so a total capture-pipeline outage
            // (bad connection string, schema drift) leaves at least one diagnostic trail instead of
            // vanishing with zero signal anywhere that the whole feature has gone dark.
            logger.LogError(ex, "IErrorCaptureService.CaptureAsync failed and was swallowed per NFR2");
        }
    }

    private static void ApplyRepeatOccurrence(ErrorRecord existing, DateTimeOffset now, string? correlationId)
    {
        // FR-16: a Resolved or Archived record's Fingerprint recurring flips it back to New
        // (Reopen) -- ResolvedAt/ArchivedAt/ResolvedByUserId are deliberately left untouched here
        // (not cleared), preserving the most-recent-dismissal info until the *next* dismissal
        // overwrites them.
        var wasArchived = existing.Status == ErrorStatus.Archived;
        // Story 4.6 code-review patch (AC #3): a Resolved reopen must also preserve a genuine
        // prior MANUAL increase (Story 4.6/FR-17), not just an Archived reopen -- AC #3's literal
        // "unchanged Priority even if it was previously manually increased" applies to both
        // dismissal states. A Resolved record that was never manually touched still gets Phase
        // B's ordinary spike escalation below, preserving Story 4.2's original intent for the
        // common (untouched) case.
        var wasManuallyIncreased = existing.PriorityIncreasedAt is not null;
        existing.Status = ErrorStatus.New;

        // Code-review patch: Escalate() must read OccurrenceCount/LastOccurredAt BEFORE they're
        // updated for this occurrence -- it needs the record's state as of its *last completed*
        // occurrence to compute the historical average interval correctly. Incrementing first (the
        // original bug) fed Escalate() a divisor that already counted the in-flight occurrence,
        // systematically underestimating the true historical interval. FR-10 Phase B, per its own
        // literal "evaluated every time an existing, non-Archived Fingerprint occurs again"
        // wording -- runs for a still-New or a just-reopened-from-Resolved record with no manual
        // increase, but not for a reopen from Archived or one with a manual increase already on
        // record (both preserve Priority exactly as-is, matching AC #3's "does not reset
        // Priority" for the strongest dismissal/attribution signals).
        existing.Priority = (wasArchived || wasManuallyIncreased)
            ? existing.Priority
            : ErrorPriorityAssigner.Escalate(existing, now);

        existing.OccurrenceCount += 1;
        existing.LastOccurredAt = now;

        // Code-review patch: only overwrite when the new value is non-null -- FR-22's
        // "most-recent-occurrence" convention shouldn't mean wiping a previously-captured real
        // Correlation ID just because this particular occurrence happened to have none available.
        existing.CorrelationId = correlationId ?? existing.CorrelationId;
    }

    private static string Truncate(string message) =>
        message.Length > MaxMessageLength ? message[..MaxMessageLength] : message;
}

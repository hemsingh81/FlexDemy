using FlexDemy.Domain.ErrorObservability;

namespace FlexDemy.Application.ErrorObservability;

// FR-10: two-phase rule-based priority assignment. Deterministic and auditable -- no AI/
// non-deterministic component in either phase.
public static class ErrorPriorityAssigner
{
    // [ASSUMPTION: Critical Path starting set is Authentication (login/register) + Course Publish,
    // per the PRD's own Glossary -- confirm before build; the real code doesn't currently mark any
    // flow as "critical," so this is a new concept this feature introduces. Detected here via
    // RequestPath, which only covers the HTTP-triggered leg of a flow -- a background job failure
    // deep inside the publish pipeline (e.g. PublishNodeContentJob) has no RequestPath and is not
    // matched by this check, a known limitation of this approximation.]
    private static bool IsCriticalPath(ErrorCaptureRequest request)
    {
        if (request.RequestPath is null)
            return false;

        return request.RequestPath.StartsWith("/api/v1/auth/login", StringComparison.OrdinalIgnoreCase)
            || request.RequestPath.StartsWith("/api/v1/auth/register", StringComparison.OrdinalIgnoreCase)
            || (request.RequestPath.StartsWith("/api/v1/courses/", StringComparison.OrdinalIgnoreCase)
                && request.RequestPath.EndsWith("/publish", StringComparison.OrdinalIgnoreCase));
    }

    // Phase A: runs once, only on first-ever occurrence of a Fingerprint.
    //
    // [DEVIATION FROM THE PRD'S LITERAL RULE NUMBERING -- confirmed by a failing test, not a
    // hypothetical: the PRD lists rule 2 ("P1 for a user-facing non-background-job request, OR
    // Category == Background Job Error") ahead of rule 3 ("P3 for Validation/FrontendRuntime
    // category"). Read strictly top-down, rule 2's "user-facing (non-background-job) request" is
    // true for essentially every backend capture -- including a plain ValidationException thrown
    // during a normal HTTP request. That makes rule 3's P3-for-ValidationError branch permanently
    // unreachable for the single most common real case, which contradicts the PRD's own stated
    // intent that Validation errors are deliberately *low* severity (matching Sentry/Rollbar/
    // Bugsnag convention: a 4xx-shaped caller-input mistake is not a system problem). Category-
    // based P3 is therefore evaluated BEFORE the generic P1 request-type rule -- confirm before
    // build if this reordering is acceptable, or if "user-facing request" was meant to exclude
    // Validation Error some other way.
    //
    // A second, related fix (code-review patch): the background-job-failure check is evaluated
    // BEFORE the category-P3 check, not after -- FR-3's terminal-failure records must be "always
    // at least P1 severe on first sight" per the PRD's own explicit parenthetical, which the
    // original ordering silently violated for a job whose underlying exception happened to be
    // ValidationException (it got P3 instead). Also note: the PRD's literal rule 2 text says
    // "Category == Background Job Error" -- ErrorCategoryMapper never actually sets Category to
    // that value (only SecondaryCategory ever holds it, see ErrorCategory.cs), so this check reads
    // `request.IsBackgroundJobFailure` instead, the only field that's actually true for a job
    // terminal failure at the point Phase A runs.
    //
    // Known, non-blocking limitation (code-review observation, not a further code change): given
    // this system's only 3 real capture-site shapes -- an HTTP request (FR-1), a background job
    // failure (FR-3), or a frontend error (FR-6/7) -- P2 is not actually reachable by any request
    // ErrorCategoryMapper can produce: every frontend capture resolves FrontendRuntimeError (P3),
    // and every backend capture is either a job failure (P1) or a plain request (P1). P2 exists
    // structurally as the PRD's own stated fallback branch but has no live trigger today; revisit
    // if a future capture site or category makes it reachable.]
    public static ErrorPriority AssignInitial(ErrorCaptureRequest request, ErrorCategory category)
    {
        // [ASSUMPTION: Data Integrity Error is unconditionally P0 regardless of other context --
        // confirm before build.]
        if (IsCriticalPath(request) || category == ErrorCategory.DataIntegrityError)
            return ErrorPriority.P0;

        if (request.IsBackgroundJobFailure)
            return ErrorPriority.P1;

        if (category is ErrorCategory.ValidationError or ErrorCategory.FrontendRuntimeError)
            return ErrorPriority.P3;

        // "User-facing (non-background-job) request" -- a backend capture that reaches this point
        // is, by construction, not a job failure (handled above) and not Validation/FrontendRuntime
        // (handled above) -- i.e. exactly the PRD's "user-facing non-background-job request" case.
        if (request.Source == ErrorSource.Backend)
            return ErrorPriority.P1;

        return ErrorPriority.P2;
    }

    // Phase B: runs only on repeat occurrence (an existing, non-Archived Fingerprint). Never fires
    // on a first occurrence and never decreases Priority (same one-way principle as a manual
    // Increase, Story 4.6).
    //
    // [ASSUMPTION: the PRD's literal spike rule ("10x the prior 24h average within a 1-hour
    // window") needs a per-occurrence timestamp history this story's schema doesn't store (only
    // OccurrenceCount/FirstOccurredAt/LastOccurredAt). Approximated here as: the time since the
    // record's last occurrence (before this one) is at least 10x shorter than the record's own
    // historical average inter-occurrence interval -- i.e. "this Fingerprint is now recurring at
    // least 10x faster than its own past pace," using only the fields actually persisted. Confirm
    // before build whether this approximation is acceptable or whether a real occurrence-timestamp
    // window needs to be added.]
    public static ErrorPriority Escalate(ErrorRecord existingRecord, DateTimeOffset now)
    {
        if (existingRecord.Priority is not (ErrorPriority.P2 or ErrorPriority.P3))
            return existingRecord.Priority;

        // Fewer than 2 prior occurrences means no historical interval exists yet to compare against.
        if (existingRecord.OccurrenceCount < 2)
            return existingRecord.Priority;

        var historicalSpanSeconds = (existingRecord.LastOccurredAt - existingRecord.FirstOccurredAt).TotalSeconds;
        var historicalAverageIntervalSeconds = historicalSpanSeconds / (existingRecord.OccurrenceCount - 1);
        var currentIntervalSeconds = (now - existingRecord.LastOccurredAt).TotalSeconds;

        if (historicalAverageIntervalSeconds > 0 && currentIntervalSeconds > 0
            && historicalAverageIntervalSeconds >= currentIntervalSeconds * 10)
        {
            return ErrorPriority.P1;
        }

        return existingRecord.Priority;
    }

    // Story 4.6/FR-17: manual Increase Priority action -- exactly one step toward P0, reusing
    // this enum's own declared ordering (P3=0 < P2=1 < P1=2 < P0=3) rather than a second,
    // duplicate priority-ordering table. The P0 case is a caller-precondition violation, not a
    // normal outcome -- ErrorAdminService.IncreasePriorityAsync checks for P0 itself and throws
    // the user-facing ValidationException before ever calling this; this guard is defense in
    // depth against being called with an already-invalid input, not the primary enforcement.
    public static ErrorPriority IncreaseOneStep(ErrorPriority current)
    {
        if (current == ErrorPriority.P0)
            throw new InvalidOperationException("Already at the highest priority (P0).");

        return (ErrorPriority)((int)current + 1);
    }
}

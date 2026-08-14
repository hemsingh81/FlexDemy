using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Domain.ErrorObservability;
using Hangfire;
using Hangfire.Server;

namespace FlexDemy.Infrastructure.Jobs;

// Story 3.8/Task 2: same [AutomaticRetry(Attempts = 5)]/idempotency-guard/final-attempt-fail-
// closed shape as ExtractStructureJob.cs (the direct template). One job per confirmed node --
// generates all 5 Drill-Down levels then all 5 Ways via Story 3.5's AdaptiveLearningService,
// committing an interim SaveChangesAsync before each sub-call (the documented AD-11 carve-out for
// Hangfire batch job items, same precedent Stories 2.6-2.8's own jobs already established) so a
// tutor watching the live checklist sees sub-progress in near-real-time.
public class PublishNodeContentJob(
    IPublishBatchRepository repository,
    IUnitOfWork unitOfWork,
    IAdaptiveLearningService adaptiveLearningService,
    IVersionService versionService,
    ICourseService courseService,
    ICorrelationIdAccessor correlationIdAccessor,
    IErrorCaptureService errorCaptureService) : IPublishNodeContentJob
{
    // Matches ExtractStructureJob.cs's own explicit-constant discipline (not Hangfire's implicit default).
    private const int MaxAttempts = 5;

    [AutomaticRetry(Attempts = MaxAttempts)]
    public async Task RunAsync(string batchItemId, string? correlationId, CancellationToken cancellationToken, PerformContext? context = null)
    {
        // Story 4.1/AD-23: see ScanFileJob's own comment for why this is the first line.
        correlationIdAccessor.Set(correlationId);

        var item = await repository.GetItemByIdAsync(batchItemId, cancellationToken)
            ?? throw new NotFoundException(nameof(PublishBatchItem), batchItemId);
        var batch = await repository.GetByIdAsync(item.BatchId, cancellationToken)
            ?? throw new NotFoundException(nameof(PublishBatch), item.BatchId);
        var courseId = batch.CourseId;
        var nodeId = item.TopicId ?? item.SubtopicId
            ?? throw new InvalidOperationException($"PublishBatchItem {item.Id} has neither TopicId nor SubtopicId set.");

        // Guards only the generation work, not the decrement/finalize step below (code-review
        // patch -- see that step's own comment for why). Unlike ExtractStructureJob (which makes
        // no interim write), this job DOES commit interim ProgressText updates as it works, so a
        // Hangfire retry after a transient mid-run failure resumes with Status already InProgress
        // -- fine to continue from (it restarts the level/way loop from 1, which just
        // re-generates/re-upserts a few already-done rows redundantly rather than losing
        // correctness). Only an already-terminal item (Done/Failed, from a prior completed
        // attempt) skips generation.
        if (item.Status is not (PublishItemStatus.Done or PublishItemStatus.Failed))
        {
            item.Status = PublishItemStatus.InProgress;
            await unitOfWork.SaveChangesAsync(cancellationToken);

            try
            {
                for (var level = 1; level <= 5; level++)
                {
                    item.ProgressText = $"Generating Level {level} of 5…";
                    await unitOfWork.SaveChangesAsync(cancellationToken);
                    await adaptiveLearningService.GenerateLevelAsync(courseId, nodeId, level, cancellationToken);
                }

                for (var wayNumber = 1; wayNumber <= 5; wayNumber++)
                {
                    item.ProgressText = $"Generating Way {wayNumber} of 5…";
                    await unitOfWork.SaveChangesAsync(cancellationToken);
                    await adaptiveLearningService.GenerateWayAsync(courseId, nodeId, wayNumber, cancellationToken);
                }

                item.Status = PublishItemStatus.Done;
                item.ProgressText = "Drill-Down + Ways generated";
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (AiTaskBudgetExceededException ex)
            {
                // No retry -- retrying immediately cannot un-exceed a budget threshold still in effect.
                await MarkFailedAsync(item, "AI budget exceeded during publish generation.", ex, cancellationToken);
            }
            catch (AiResponseValidationException ex)
            {
                // A logical generation failure (the AI's response failed validation) is terminal for
                // this item, not a transient blip retrying would fix -- mirrors ExtractStructureJob's
                // own parse-failure-is-terminal treatment. This item is NOT itself the fallback
                // mechanism: Story 3.5's GetOrGenerateLevelAsync/GetOrGenerateWayAsync (on-demand
                // fallback) already serves a student viewing this node for free, since no
                // GeneratedContentJson was ever written for it.
                await MarkFailedAsync(item, ex.Message, ex, cancellationToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // Every other exception (AiTaskUnavailableException, a transient network blip, or
                // anything else genuinely unexpected) is retry-worthy -- same generalized
                // retry-then-fail-closed shape as ExtractStructureJob.
                var retryCount = context?.GetJobParameter<int?>("RetryCount") ?? 0;
                if (retryCount < MaxAttempts - 1)
                    throw; // Let it propagate uncaught -- triggers Hangfire's automatic retry. Item
                            // stays non-terminal, so the decrement below is never reached this attempt.

                await MarkFailedAsync(
                    item,
                    ex is AiTaskUnavailableException
                        ? "AI generation unavailable — retries exhausted"
                        : $"Publish generation failed — retries exhausted ({ex.GetType().Name})",
                    ex,
                    cancellationToken);
            }
        }

        // Story 3.8/Task 3, AD-16: runs on every invocation once this item is terminal -- whether
        // it just became terminal above, or was already terminal on entry (a resumed retry after
        // this exact block, or the finalize call below, previously threw). Code-review patch: the
        // original version guarded this whole block behind the Status check above (an early
        // `return`), which meant a retry of an item whose Status was ALREADY Done/Failed could
        // never re-reach the decrement at all -- if DecrementRemainingAsync (or the finalize calls
        // below it) ever threw, that exception propagated uncaught to Hangfire, but every
        // subsequent retry hit the (then-unconditional) idempotency guard and returned immediately,
        // permanently losing that item's decrement with no visible error. DecrementRemainingAsync
        // is now itself atomic AND idempotent (claims via PublishBatchItem.DecrementCommitted
        // before decrementing, in one SQL statement) -- calling it again for an item that already
        // claimed is a safe no-op that still returns the CURRENT Remaining value, so a retry can
        // always observe Remaining == 0 and (re-)run finalize even after the decrement itself
        // already succeeded on an earlier, since-failed attempt.
        var remaining = await repository.DecrementRemainingAsync(item.Id, batch.Id, cancellationToken);
        if (remaining == 0)
        {
            await versionService.CreateSnapshotAsync(courseId, cancellationToken);
            await courseService.MarkPublishedAsync(courseId, cancellationToken);
        }
    }

    // Story 4.3/FR-3/FR-4: called from all 3 terminal-failure sites above -- one CaptureAsync call
    // site here instead of duplicating it at each. `exception` is passed through from the caller's
    // own catch block so ExceptionType/StackTrace reflect the real failure, not the human-friendly
    // `reason` string that goes into ProgressText instead (that field's shape/content is unchanged).
    private async Task MarkFailedAsync(PublishBatchItem item, string reason, Exception? exception, CancellationToken cancellationToken)
    {
        item.Status = PublishItemStatus.Failed;
        item.ProgressText = reason;
        await unitOfWork.SaveChangesAsync(cancellationToken);

        await errorCaptureService.CaptureAsync(new ErrorCaptureRequest
        {
            ExceptionType = exception?.GetType().Name,
            Message = exception?.Message ?? reason,
            StackTrace = exception?.StackTrace,
            Source = ErrorSource.Backend,
            OriginContext = nameof(PublishNodeContentJob),
            RelatedEntityType = nameof(PublishBatchItem),
            RelatedEntityId = item.Id,
            IsBackgroundJobFailure = true,
        }, cancellationToken);
    }
}

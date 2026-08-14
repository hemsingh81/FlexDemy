namespace FlexDemy.Application.Common;

// Story 2.8: same seam/reasoning as IScanFileJobEnqueuer (2.6) and IParseFileJobEnqueuer (2.7)
// applied to the third pipeline step -- ParseFileJob's successful-parse branch needs to enqueue
// IExtractStructureJob in a way that stays unit-testable with NSubstitute. The Infrastructure
// implementation still calls Hangfire's own BackgroundJob.Enqueue<IExtractStructureJob>(...)
// under the hood, per this story's Task 5.
public interface IExtractStructureJobEnqueuer
{
    // Story 4.1/AD-23: see IScanFileJobEnqueuer's own header comment for why this parameter exists.
    void Enqueue(string courseFileId, string? correlationId);
}

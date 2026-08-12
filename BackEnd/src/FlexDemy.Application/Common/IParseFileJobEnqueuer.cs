namespace FlexDemy.Application.Common;

// Story 2.7: same seam/reasoning as IScanFileJobEnqueuer (Story 2.6) applied to the next
// pipeline step -- ScanFileJob's clean-scan branch needs to enqueue IParseFileJob in a way that
// stays unit-testable with NSubstitute, since Hangfire's static/extension-method API isn't
// directly mockable. The Infrastructure implementation still calls Hangfire's own
// BackgroundJob.Enqueue<IParseFileJob>(...) under the hood, per this story's Task 4.
public interface IParseFileJobEnqueuer
{
    void Enqueue(string courseFileId);
}

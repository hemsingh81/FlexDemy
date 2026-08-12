namespace FlexDemy.Application.Common;

// Story 2.6: thin seam over Hangfire's static BackgroundJob.Enqueue entry point, purely so
// CourseFileService can be unit-tested with NSubstitute like every other external dependency in
// this codebase (IFileStorageService, IFileScanner, IAiGateway) -- Hangfire's own static/
// extension-method API isn't directly mockable. The Infrastructure implementation still calls
// Hangfire's own BackgroundJob.Enqueue<IScanFileJob>(...) under the hood (Task 5's specified
// entry point), not IBackgroundJobClient DI -- this interface is this codebase's own seam, not a
// Hangfire concept.
public interface IScanFileJobEnqueuer
{
    void Enqueue(string courseFileId);
}

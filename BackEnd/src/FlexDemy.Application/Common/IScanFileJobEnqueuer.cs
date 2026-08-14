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
    // Story 4.1/AD-23: correlationId is captured from ICorrelationIdAccessor.Current by the
    // calling Application service at enqueue time and forwarded as an explicit job argument --
    // never derived independently inside the job.
    void Enqueue(string courseFileId, string? correlationId);
}

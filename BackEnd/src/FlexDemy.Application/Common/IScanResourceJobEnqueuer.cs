namespace FlexDemy.Application.Common;

// Story 8.1: mirrors IScanFileJobEnqueuer exactly -- a thin seam over Hangfire's static
// BackgroundJob.Enqueue, purely for testability (UploadResourceAsync substitutes this in tests
// rather than depending on Hangfire's static API directly).
public interface IScanResourceJobEnqueuer
{
    void Enqueue(string resourceId, string? correlationId);
}

using FlexDemy.Application.Common;
using Hangfire;

namespace FlexDemy.Infrastructure.Jobs;

// Story 2.8: thin wrapper around Hangfire's static BackgroundJob.Enqueue -- same shape as
// ScanFileJobEnqueuer (2.6) and ParseFileJobEnqueuer (2.7).
public class ExtractStructureJobEnqueuer : IExtractStructureJobEnqueuer
{
    public void Enqueue(string courseFileId, string? correlationId) =>
        BackgroundJob.Enqueue<IExtractStructureJob>(j => j.RunAsync(courseFileId, correlationId, CancellationToken.None, null));
}

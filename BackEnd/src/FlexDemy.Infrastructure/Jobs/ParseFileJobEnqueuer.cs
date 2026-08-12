using FlexDemy.Application.Common;
using Hangfire;

namespace FlexDemy.Infrastructure.Jobs;

// Story 2.7: thin wrapper around Hangfire's static BackgroundJob.Enqueue -- same shape as
// ScanFileJobEnqueuer (Story 2.6).
public class ParseFileJobEnqueuer : IParseFileJobEnqueuer
{
    public void Enqueue(string courseFileId) =>
        BackgroundJob.Enqueue<IParseFileJob>(j => j.RunAsync(courseFileId, CancellationToken.None, null));
}

using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace FlexDemy.Api.RateLimiting;

// Story 4.4/AC #5: genuinely new cross-cutting infrastructure to this codebase (confirmed zero
// existing RateLimit usage repo-wide). Pulled into its own testable class -- not an inline lambda
// in Program.cs -- so GetPartition/OnRejected can be exercised directly with a
// PartitionedRateLimiter<HttpContext> in a unit test; this repo has no WebApplicationFactory-based
// integration test infra to drive the real ASP.NET Core pipeline through (see Task 9's own
// [ASSUMPTION] note).
public static class ErrorReportingRateLimiterPolicy
{
    public const string PolicyName = "ErrorReporting";
    public const int PermitLimit = 30;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    // Code-review patch: a fixed window lets a client burst up to ~2x PermitLimit across a
    // window boundary (PermitLimit requests just before the window rolls over, PermitLimit more
    // just after) -- a sliding window divided into segments smooths that out, closer to AC #5's
    // "more than 30 requests/minute" intent, using the same rate-limiting API family with no new
    // dependency.
    private const int SegmentsPerWindow = 6;

    public static RateLimitPartition<string> GetPartition(HttpContext context)
    {
        var key = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetSlidingWindowLimiter(key, _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = PermitLimit,
            Window = Window,
            SegmentsPerWindow = SegmentsPerWindow,
            QueueLimit = 0,
        });
    }

    // AC #5: an exceeded limit must return 204, not the library's own default 429 -- this is the
    // one non-default piece of the setup.
    public static ValueTask OnRejected(OnRejectedContext context, CancellationToken cancellationToken)
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status204NoContent;
        return ValueTask.CompletedTask;
    }
}

using System.Net;
using System.Threading.RateLimiting;
using FlexDemy.Api.RateLimiting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Xunit;

namespace FlexDemy.Api.Tests.RateLimiting;

// Story 4.4/Task 9's own [ASSUMPTION]: this repo has no WebApplicationFactory-based integration
// test infra (confirmed -- only FlexDemy.Api.Tests/Controllers exists, all direct-construction
// unit tests), so "31 rapid requests from the same IP" is exercised directly against a real
// PartitionedRateLimiter built from ErrorReportingRateLimiterPolicy.GetPartition, the same
// partitioner Program.cs registers -- not through the full ASP.NET Core pipeline, whose in-process
// test host wouldn't populate RemoteIpAddress realistically anyway.
public class ErrorReportingRateLimiterPolicyTests
{
    private static HttpContext MakeContextForIp(string ip)
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse(ip);
        return context;
    }

    [Fact]
    public void The_31st_request_within_a_minute_from_the_same_IP_is_rejected()
    {
        var limiter = PartitionedRateLimiter.Create<HttpContext, string>(ErrorReportingRateLimiterPolicy.GetPartition);
        var context = MakeContextForIp("203.0.113.5");

        for (var i = 0; i < ErrorReportingRateLimiterPolicy.PermitLimit; i++)
        {
            using var lease = limiter.AttemptAcquire(context);
            Assert.True(lease.IsAcquired, $"Request {i + 1} of {ErrorReportingRateLimiterPolicy.PermitLimit} should be permitted.");
        }

        using var rejectedLease = limiter.AttemptAcquire(context);

        Assert.False(rejectedLease.IsAcquired);
    }

    [Fact]
    public void A_different_source_IP_has_its_own_independent_limit()
    {
        var limiter = PartitionedRateLimiter.Create<HttpContext, string>(ErrorReportingRateLimiterPolicy.GetPartition);
        var exhaustedIp = MakeContextForIp("203.0.113.5");
        for (var i = 0; i < ErrorReportingRateLimiterPolicy.PermitLimit; i++)
        {
            limiter.AttemptAcquire(exhaustedIp).Dispose();
        }
        Assert.False(limiter.AttemptAcquire(exhaustedIp).IsAcquired);

        var otherIp = MakeContextForIp("198.51.100.9");

        using var lease = limiter.AttemptAcquire(otherIp);

        Assert.True(lease.IsAcquired);
    }

    [Fact]
    public async Task OnRejected_sets_204_No_Content_not_the_library_default_429()
    {
        var limiter = PartitionedRateLimiter.Create<HttpContext, string>(ErrorReportingRateLimiterPolicy.GetPartition);
        var context = MakeContextForIp("203.0.113.5");
        for (var i = 0; i < ErrorReportingRateLimiterPolicy.PermitLimit; i++)
        {
            limiter.AttemptAcquire(context).Dispose();
        }
        var rejectedLease = limiter.AttemptAcquire(context);
        Assert.False(rejectedLease.IsAcquired);
        var rejectedContext = new OnRejectedContext { HttpContext = context, Lease = rejectedLease };

        await ErrorReportingRateLimiterPolicy.OnRejected(rejectedContext, CancellationToken.None);

        Assert.Equal(StatusCodes.Status204NoContent, context.Response.StatusCode);
    }
}

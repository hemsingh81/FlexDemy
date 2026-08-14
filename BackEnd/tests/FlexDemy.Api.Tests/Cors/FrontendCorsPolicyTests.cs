using FlexDemy.Api.Cors;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Xunit;

namespace FlexDemy.Api.Tests.Cors;

// Code-review patch (Story 4.4): regression guard for the exact bug this round's review caught
// only by manual inspection -- a CORS policy that allows the frontend origin but never exposes
// X-Correlation-Id leaves httpClient.ts's response.headers.get('X-Correlation-Id') silently
// reading null on every cross-origin request. Exercises the same Configure() method Program.cs
// registers, since this repo has no WebApplicationFactory infra to drive the real pipeline.
public class FrontendCorsPolicyTests
{
    [Fact]
    public void Configure_exposes_the_X_Correlation_Id_header_to_cross_origin_JS()
    {
        var builder = new CorsPolicyBuilder();

        FrontendCorsPolicy.Configure(builder, ["http://localhost:3000"]);
        var policy = builder.Build();

        Assert.Contains("X-Correlation-Id", policy.ExposedHeaders);
    }

    [Fact]
    public void Configure_allows_the_given_origins()
    {
        var builder = new CorsPolicyBuilder();

        FrontendCorsPolicy.Configure(builder, ["http://localhost:3000", "http://127.0.0.1:3100"]);
        var policy = builder.Build();

        Assert.Contains("http://localhost:3000", policy.Origins);
        Assert.Contains("http://127.0.0.1:3100", policy.Origins);
    }
}

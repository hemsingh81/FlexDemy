using Microsoft.AspNetCore.Cors.Infrastructure;

namespace FlexDemy.Api.Cors;

// Code-review patch (Story 4.4): pulled out of Program.cs's inline lambda into its own testable
// method, mirroring ErrorReportingRateLimiterPolicy's own precedent -- this repo has no
// WebApplicationFactory-based integration test infra to exercise Program.cs's registered CORS
// policy directly, so the exact configuration used there needs to be independently callable to
// get any regression coverage at all for a class of bug (a missing WithExposedHeaders call) that
// this same review round just caught only by manual inspection.
public static class FrontendCorsPolicy
{
    public const string PolicyName = "Frontend";

    public static void Configure(CorsPolicyBuilder policy, IReadOnlyCollection<string> allowedOrigins) =>
        policy.WithOrigins([.. allowedOrigins]).AllowAnyHeader().AllowAnyMethod().WithExposedHeaders("X-Correlation-Id");
}

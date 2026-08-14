using FlexDemy.Api.RateLimiting;
using FlexDemy.Application.Common;
using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace FlexDemy.Api.Controllers;

// AD-24: the anonymous half of the two-controller split -- no [Authorize] attribute at all,
// deliberately, so a crash on the login screen itself (no token yet) still gets captured
// (AC #4). UseAuthentication still runs ahead of this on every request regardless of the
// controller's own [Authorize] status (Program.cs's existing pipeline order), so
// ICurrentUserService.UserId resolves a claim for free when a valid bearer token was sent.
[ApiController]
[Route("api/v1/errors")]
[EnableRateLimiting(ErrorReportingRateLimiterPolicy.PolicyName)]
public class ErrorReportingController(IErrorCaptureService errorCaptureService, ICurrentUserService currentUserService) : ControllerBase
{
    [HttpPost("client")]
    public async Task<IActionResult> ReportClientError(ReportClientErrorRequest request, CancellationToken cancellationToken)
    {
        // Code-review patch: this is the one anonymous, unauthenticated write surface in the
        // app -- an empty/whitespace-only Message has nothing worth capturing, so it's a no-op
        // rather than persisting a garbage record. Still returns 202 unconditionally (AC #3/#5),
        // same as every other path through this action.
        if (!string.IsNullOrWhiteSpace(request.Message))
        {
            // CaptureAsync already swallows its own failures (Story 4.2, NFR2) -- no failure
            // path here to branch on.
            //
            // Code-review patch: request.CorrelationId is untrusted client input on an anonymous
            // endpoint, exactly like the X-Correlation-Id request header CorrelationIdMiddleware
            // already validates -- sanitized through the same shared validator rather than
            // trusted verbatim, so an anonymous caller can't spoof an arbitrary correlation ID
            // and cross-link its report to an unrelated session's trail.
            await errorCaptureService.CaptureAsync(new ErrorCaptureRequest
            {
                Message = request.Message,
                StackTrace = request.Stack,
                Source = ErrorSource.Frontend,
                RequestPath = request.Url,
                UserId = currentUserService.UserId,
                CorrelationIdOverride = CorrelationIdValidator.Sanitize(request.CorrelationId),
            }, cancellationToken);
        }

        return Accepted();
    }
}

public record ReportClientErrorRequest(string Message, string? Stack, string? Url, string? UserAgent, DateTime? Timestamp, string? CorrelationId);

using FlexDemy.Api.Controllers;
using FlexDemy.Application.Common;
using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using Xunit;

namespace FlexDemy.Api.Tests.Controllers;

// POST /api/v1/errors/client is deliberately anonymous (AD-24) -- no [Authorize] attribute
// anywhere on this controller, so these tests exercise the action directly rather than through
// an authorization pipeline (there is none to exercise). UserId population is entirely
// delegated to ICurrentUserService (whatever it returns, valid token or not); the "authenticated
// vs. not" behavior itself is that service's own responsibility, already established by
// HttpContextCurrentUserService.
public class ErrorReportingControllerTests
{
    private static ReportClientErrorRequest MakeRequest(string? correlationId = null, string message = "boom") =>
        new(message, "at x.y.z", "https://app.example.com/dashboard", "test-agent", DateTime.UtcNow, correlationId);

    [Fact]
    public async Task An_authenticated_request_populates_UserId_on_the_captured_record_and_returns_202()
    {
        var errorCaptureService = Substitute.For<IErrorCaptureService>();
        var currentUserService = Substitute.For<ICurrentUserService>();
        currentUserService.UserId.Returns("user_1");
        var controller = new ErrorReportingController(errorCaptureService, currentUserService);

        var result = await controller.ReportClientError(MakeRequest(), CancellationToken.None);

        Assert.IsType<AcceptedResult>(result);
        await errorCaptureService.Received(1).CaptureAsync(
            Arg.Is<ErrorCaptureRequest>(r => r.UserId == "user_1"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task An_unauthenticated_request_leaves_UserId_null_and_still_returns_202()
    {
        var errorCaptureService = Substitute.For<IErrorCaptureService>();
        var currentUserService = Substitute.For<ICurrentUserService>();
        currentUserService.UserId.Returns((string?)null);
        var controller = new ErrorReportingController(errorCaptureService, currentUserService);

        var result = await controller.ReportClientError(MakeRequest(), CancellationToken.None);

        Assert.IsType<AcceptedResult>(result);
        await errorCaptureService.Received(1).CaptureAsync(
            Arg.Is<ErrorCaptureRequest>(r => r.UserId == null),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Maps_the_request_body_onto_ErrorCaptureRequest_with_Source_Frontend()
    {
        var errorCaptureService = Substitute.For<IErrorCaptureService>();
        var currentUserService = Substitute.For<ICurrentUserService>();
        currentUserService.UserId.Returns((string?)null);
        var controller = new ErrorReportingController(errorCaptureService, currentUserService);

        await controller.ReportClientError(MakeRequest(), CancellationToken.None);

        await errorCaptureService.Received(1).CaptureAsync(
            Arg.Is<ErrorCaptureRequest>(r =>
                r.Message == "boom" &&
                r.StackTrace == "at x.y.z" &&
                r.Source == ErrorSource.Frontend &&
                r.RequestPath == "https://app.example.com/dashboard"),
            Arg.Any<CancellationToken>());
    }

    // AC #6/FR-23: the frontend's own stored Correlation ID (from a prior page/response) takes
    // precedence over whatever CorrelationIdMiddleware assigned to this specific anonymous POST
    // -- exercises Story 4.2's CorrelationIdOverride field for real.
    [Fact]
    public async Task Passes_the_request_body_CorrelationId_through_as_CorrelationIdOverride()
    {
        var errorCaptureService = Substitute.For<IErrorCaptureService>();
        var currentUserService = Substitute.For<ICurrentUserService>();
        var controller = new ErrorReportingController(errorCaptureService, currentUserService);

        await controller.ReportClientError(MakeRequest("corr-from-frontend"), CancellationToken.None);

        await errorCaptureService.Received(1).CaptureAsync(
            Arg.Is<ErrorCaptureRequest>(r => r.CorrelationIdOverride == "corr-from-frontend"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Returns_202_unconditionally_even_though_CaptureAsync_never_throws_per_NFR2()
    {
        var errorCaptureService = Substitute.For<IErrorCaptureService>();
        var currentUserService = Substitute.For<ICurrentUserService>();
        var controller = new ErrorReportingController(errorCaptureService, currentUserService);

        var result = await controller.ReportClientError(MakeRequest(), CancellationToken.None);

        Assert.IsType<AcceptedResult>(result);
    }

    // Code-review patch: an anonymous caller must not be able to spoof an arbitrary
    // CorrelationId and cross-link its report to an unrelated session's trail.
    [Theory]
    [InlineData("not a valid id!")]
    [InlineData("has spaces")]
    [InlineData("semi;colon")]
    public async Task A_malformed_CorrelationId_is_sanitized_to_null_instead_of_passed_through(string malformedCorrelationId)
    {
        var errorCaptureService = Substitute.For<IErrorCaptureService>();
        var currentUserService = Substitute.For<ICurrentUserService>();
        var controller = new ErrorReportingController(errorCaptureService, currentUserService);

        var result = await controller.ReportClientError(MakeRequest(malformedCorrelationId), CancellationToken.None);

        Assert.IsType<AcceptedResult>(result);
        await errorCaptureService.Received(1).CaptureAsync(
            Arg.Is<ErrorCaptureRequest>(r => r.CorrelationIdOverride == null),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task An_oversized_CorrelationId_is_sanitized_to_null_instead_of_passed_through()
    {
        var errorCaptureService = Substitute.For<IErrorCaptureService>();
        var currentUserService = Substitute.For<ICurrentUserService>();
        var controller = new ErrorReportingController(errorCaptureService, currentUserService);

        var result = await controller.ReportClientError(MakeRequest(new string('a', 129)), CancellationToken.None);

        Assert.IsType<AcceptedResult>(result);
        await errorCaptureService.Received(1).CaptureAsync(
            Arg.Is<ErrorCaptureRequest>(r => r.CorrelationIdOverride == null),
            Arg.Any<CancellationToken>());
    }

    // Code-review patch: an empty/whitespace-only Message has nothing worth capturing on this
    // anonymous write endpoint -- treated as a no-op rather than a persisted garbage record.
    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task An_empty_or_whitespace_Message_skips_CaptureAsync_but_still_returns_202(string emptyMessage)
    {
        var errorCaptureService = Substitute.For<IErrorCaptureService>();
        var currentUserService = Substitute.For<ICurrentUserService>();
        var controller = new ErrorReportingController(errorCaptureService, currentUserService);

        var result = await controller.ReportClientError(MakeRequest(message: emptyMessage), CancellationToken.None);

        Assert.IsType<AcceptedResult>(result);
        await errorCaptureService.DidNotReceive().CaptureAsync(Arg.Any<ErrorCaptureRequest>(), Arg.Any<CancellationToken>());
    }
}

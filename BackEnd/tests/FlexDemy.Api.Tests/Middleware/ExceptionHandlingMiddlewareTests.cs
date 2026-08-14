using System.Text.Json;
using FlexDemy.Api.Middleware;
using FlexDemy.Application.Common;
using FlexDemy.Application.ErrorObservability;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;

namespace FlexDemy.Api.Tests.Middleware;

// No WebApplicationFactory-based integration test infra exists yet in this repo (checked --
// only FlexDemy.Api.Tests/Controllers has tests, all constructing controllers/handlers directly)
// -- ExceptionHandlingMiddleware.InvokeAsync only needs a RequestDelegate + HttpContext, so a
// direct unit test doesn't require inventing any new heavier test infrastructure.
public class ExceptionHandlingMiddlewareTests
{
    private static async Task<(int StatusCode, ProblemDetails Body, IErrorCaptureService ErrorCaptureService, ICurrentUserService CurrentUserService)> InvokeWithAsync(
        Exception exception, string? currentUserId = null, Action<HttpContext>? configureContext = null)
    {
        var errorCaptureService = Substitute.For<IErrorCaptureService>();
        var currentUserService = Substitute.For<ICurrentUserService>();
        currentUserService.UserId.Returns(currentUserId);
        var middleware = new ExceptionHandlingMiddleware(_ => throw exception, NullLogger<ExceptionHandlingMiddleware>.Instance, errorCaptureService, currentUserService);
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();
        configureContext?.Invoke(context);

        await middleware.InvokeAsync(context);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await JsonSerializer.DeserializeAsync<ProblemDetails>(context.Response.Body);
        return (context.Response.StatusCode, body!, errorCaptureService, currentUserService);
    }

    [Fact]
    public async Task AiGatewayException_maps_to_502_Bad_Gateway()
    {
        var (statusCode, body, _, _) = await InvokeWithAsync(new AiGatewayException("upstream provider failed"));

        Assert.Equal(StatusCodes.Status502BadGateway, statusCode);
        Assert.Equal("AI Gateway Error", body.Title);
        Assert.Equal("upstream provider failed", body.Detail);
    }

    [Fact]
    public async Task NotFoundException_maps_to_404()
    {
        var (statusCode, _, _, _) = await InvokeWithAsync(new NotFoundException("Tag", "abc"));

        Assert.Equal(StatusCodes.Status404NotFound, statusCode);
    }

    [Fact]
    public async Task ValidationException_maps_to_400()
    {
        var (statusCode, _, _, _) = await InvokeWithAsync(new ValidationException("bad input"));

        Assert.Equal(StatusCodes.Status400BadRequest, statusCode);
    }

    [Fact]
    public async Task ConflictException_maps_to_409()
    {
        var (statusCode, _, _, _) = await InvokeWithAsync(new ConflictException("already exists"));

        Assert.Equal(StatusCodes.Status409Conflict, statusCode);
    }

    [Fact]
    public async Task UnauthorizedAppException_maps_to_401()
    {
        var (statusCode, _, _, _) = await InvokeWithAsync(new UnauthorizedAppException("not allowed"));

        Assert.Equal(StatusCodes.Status401Unauthorized, statusCode);
    }

    [Fact]
    public async Task AiTaskUnavailableException_maps_to_503_Service_Unavailable()
    {
        var (statusCode, body, _, _) = await InvokeWithAsync(new AiTaskUnavailableException("explainTopic"));

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, statusCode);
        Assert.Equal("AI Task Unavailable", body.Title);
    }

    [Fact]
    public async Task AiTaskBudgetExceededException_maps_to_429_Too_Many_Requests()
    {
        var (statusCode, body, _, _) = await InvokeWithAsync(new AiTaskBudgetExceededException("explainTopic"));

        Assert.Equal(StatusCodes.Status429TooManyRequests, statusCode);
        Assert.Equal("AI Task Budget Exceeded", body.Title);
    }

    // -- Story 4.3: global capture wiring (AC #1, #2) ------------------------------------------------

    [Fact]
    public async Task A_non_AppException_still_returns_the_existing_500_response_unchanged_and_calls_CaptureAsync_once()
    {
        var exception = new NullReferenceException("boom");

        var (statusCode, body, errorCaptureService, _) = await InvokeWithAsync(exception);

        Assert.Equal(StatusCodes.Status500InternalServerError, statusCode);
        Assert.Equal("Unexpected Error", body.Title);
        await errorCaptureService.Received(1).CaptureAsync(
            Arg.Is<ErrorCaptureRequest>(r => r.ExceptionType == "NullReferenceException" && r.Message == "boom"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task An_AppException_subtype_still_returns_its_existing_mapped_status_code_unchanged_and_calls_CaptureAsync_with_the_concrete_type_name()
    {
        var exception = new ValidationException("bad input");

        var (statusCode, _, errorCaptureService, _) = await InvokeWithAsync(exception);

        Assert.Equal(StatusCodes.Status400BadRequest, statusCode);
        await errorCaptureService.Received(1).CaptureAsync(
            Arg.Is<ErrorCaptureRequest>(r => r.ExceptionType == "ValidationException" && r.Message == "bad input"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task OperationCanceledException_propagates_uncaught_and_is_not_captured()
    {
        var errorCaptureService = Substitute.For<IErrorCaptureService>();
        var currentUserService = Substitute.For<ICurrentUserService>();
        var middleware = new ExceptionHandlingMiddleware(
            _ => throw new OperationCanceledException(), NullLogger<ExceptionHandlingMiddleware>.Instance, errorCaptureService, currentUserService);
        var context = new DefaultHttpContext { RequestServices = new ServiceCollection().BuildServiceProvider() };
        context.Response.Body = new MemoryStream();

        await Assert.ThrowsAsync<OperationCanceledException>(() => middleware.InvokeAsync(context));

        await errorCaptureService.DidNotReceive().CaptureAsync(Arg.Any<ErrorCaptureRequest>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CaptureAsync_uses_the_matched_route_pattern_as_OriginContext_not_the_resolved_path_with_ids()
    {
        var routePattern = RoutePatternFactory.Parse("api/v1/courses/{id}/publish");
        var endpoint = new RouteEndpoint(_ => Task.CompletedTask, routePattern, 0, null, "publish-course");

        var (_, _, errorCaptureService, _) = await InvokeWithAsync(
            new ValidationException("bad input"),
            configureContext: context =>
            {
                context.Request.Path = "/api/v1/courses/abc-123/publish";
                context.SetEndpoint(endpoint);
            });

        await errorCaptureService.Received(1).CaptureAsync(
            Arg.Is<ErrorCaptureRequest>(r => r.OriginContext == "api/v1/courses/{id}/publish" && r.RequestPath == "/api/v1/courses/abc-123/publish"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CaptureAsync_falls_back_to_the_request_path_as_OriginContext_when_no_endpoint_matched()
    {
        var (_, _, errorCaptureService, _) = await InvokeWithAsync(
            new ValidationException("bad input"),
            configureContext: context => context.Request.Path = "/api/v1/unmatched");

        await errorCaptureService.Received(1).CaptureAsync(
            Arg.Is<ErrorCaptureRequest>(r => r.OriginContext == "/api/v1/unmatched"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CaptureAsync_sources_UserId_from_ICurrentUserService_not_from_HttpContext_User_directly()
    {
        var (_, _, errorCaptureService, currentUserService) = await InvokeWithAsync(new ValidationException("bad input"), currentUserId: "user-42");

        _ = currentUserService.Received(1).UserId;
        await errorCaptureService.Received(1).CaptureAsync(
            Arg.Is<ErrorCaptureRequest>(r => r.UserId == "user-42"),
            Arg.Any<CancellationToken>());
    }
}

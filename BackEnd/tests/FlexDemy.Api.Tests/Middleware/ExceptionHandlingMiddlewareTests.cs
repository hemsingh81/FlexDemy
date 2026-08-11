using System.Text.Json;
using FlexDemy.Api.Middleware;
using FlexDemy.Application.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;

namespace FlexDemy.Api.Tests.Middleware;

// No WebApplicationFactory-based integration test infra exists yet in this repo (checked --
// only FlexDemy.Api.Tests/Controllers has tests, all constructing controllers/handlers directly)
// -- ExceptionHandlingMiddleware.InvokeAsync only needs a RequestDelegate + HttpContext, so a
// direct unit test doesn't require inventing any new heavier test infrastructure.
public class ExceptionHandlingMiddlewareTests
{
    private static async Task<(int StatusCode, ProblemDetails Body)> InvokeWithAsync(Exception exception)
    {
        var middleware = new ExceptionHandlingMiddleware(_ => throw exception, NullLogger<ExceptionHandlingMiddleware>.Instance);
        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await JsonSerializer.DeserializeAsync<ProblemDetails>(context.Response.Body);
        return (context.Response.StatusCode, body!);
    }

    [Fact]
    public async Task AiGatewayException_maps_to_502_Bad_Gateway()
    {
        var (statusCode, body) = await InvokeWithAsync(new AiGatewayException("upstream provider failed"));

        Assert.Equal(StatusCodes.Status502BadGateway, statusCode);
        Assert.Equal("AI Gateway Error", body.Title);
        Assert.Equal("upstream provider failed", body.Detail);
    }

    [Fact]
    public async Task NotFoundException_maps_to_404()
    {
        var (statusCode, _) = await InvokeWithAsync(new NotFoundException("Tag", "abc"));

        Assert.Equal(StatusCodes.Status404NotFound, statusCode);
    }

    [Fact]
    public async Task ValidationException_maps_to_400()
    {
        var (statusCode, _) = await InvokeWithAsync(new ValidationException("bad input"));

        Assert.Equal(StatusCodes.Status400BadRequest, statusCode);
    }

    [Fact]
    public async Task ConflictException_maps_to_409()
    {
        var (statusCode, _) = await InvokeWithAsync(new ConflictException("already exists"));

        Assert.Equal(StatusCodes.Status409Conflict, statusCode);
    }

    [Fact]
    public async Task UnauthorizedAppException_maps_to_401()
    {
        var (statusCode, _) = await InvokeWithAsync(new UnauthorizedAppException("not allowed"));

        Assert.Equal(StatusCodes.Status401Unauthorized, statusCode);
    }

    [Fact]
    public async Task AiTaskUnavailableException_maps_to_503_Service_Unavailable()
    {
        var (statusCode, body) = await InvokeWithAsync(new AiTaskUnavailableException("explainTopic"));

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, statusCode);
        Assert.Equal("AI Task Unavailable", body.Title);
    }

    [Fact]
    public async Task AiTaskBudgetExceededException_maps_to_429_Too_Many_Requests()
    {
        var (statusCode, body) = await InvokeWithAsync(new AiTaskBudgetExceededException("explainTopic"));

        Assert.Equal(StatusCodes.Status429TooManyRequests, statusCode);
        Assert.Equal("AI Task Budget Exceeded", body.Title);
    }
}

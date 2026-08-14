using FlexDemy.Api.Middleware;
using FlexDemy.Infrastructure.Correlation;
using Microsoft.AspNetCore.Http;

namespace FlexDemy.Api.Tests.Middleware;

// Same direct-unit-test approach as ExceptionHandlingMiddlewareTests.cs -- no
// WebApplicationFactory-based integration test infra exists in this repo yet, and
// CorrelationIdMiddleware.InvokeAsync only needs a RequestDelegate + HttpContext +
// ICorrelationIdAccessor, so a direct unit test doesn't require inventing any new
// heavier test infrastructure. (Story 4.1's own text assumed a WebApplicationFactory-based
// integration test existed to extend -- it doesn't; this deviates to match actual repo state.)
//
// Important AsyncLocal semantics this test file had to correct for during dev: a value set via
// ICorrelationIdAccessor.Set(...) inside InvokeAsync flows DOWNWARD into `next(context)` and
// anything it calls (exactly what ExceptionHandlingMiddleware needs), but does NOT flow back UP
// to InvokeAsync's own caller once it returns -- by design, same reason ASP.NET Core's own
// IHttpContextAccessor is only ever read downstream of where it's set, never by the code that
// invoked the setting middleware. Assertions below therefore read accessor.Current from inside
// the `next` delegate, not after awaiting InvokeAsync from the test method itself.
public class CorrelationIdMiddlewareTests
{
    [Fact]
    public async Task No_incoming_header_generates_a_new_id_set_on_the_accessor_and_echoed_on_the_response()
    {
        var accessor = new AsyncLocalCorrelationIdAccessor();
        string? observedInNext = null;
        var middleware = new CorrelationIdMiddleware(_ =>
        {
            observedInNext = accessor.Current;
            return Task.CompletedTask;
        });
        var context = new DefaultHttpContext();

        await middleware.InvokeAsync(context, accessor);

        Assert.False(string.IsNullOrWhiteSpace(observedInNext));
        Assert.Equal(observedInNext, context.Response.Headers["X-Correlation-Id"].ToString());
    }

    [Fact]
    public async Task Incoming_header_is_reused_as_is_not_regenerated()
    {
        var accessor = new AsyncLocalCorrelationIdAccessor();
        string? observedInNext = null;
        var middleware = new CorrelationIdMiddleware(_ =>
        {
            observedInNext = accessor.Current;
            return Task.CompletedTask;
        });
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Correlation-Id"] = "incoming-id-123";

        await middleware.InvokeAsync(context, accessor);

        Assert.Equal("incoming-id-123", observedInNext);
        Assert.Equal("incoming-id-123", context.Response.Headers["X-Correlation-Id"].ToString());
    }

    [Fact]
    public async Task Accessor_is_already_set_by_the_time_next_runs_so_a_downstream_exception_has_an_id_to_attach_to()
    {
        var accessor = new AsyncLocalCorrelationIdAccessor();
        string? observedInsideNext = null;
        var middleware = new CorrelationIdMiddleware(_ =>
        {
            observedInsideNext = accessor.Current;
            return Task.CompletedTask;
        });
        var context = new DefaultHttpContext();

        await middleware.InvokeAsync(context, accessor);

        Assert.False(string.IsNullOrWhiteSpace(observedInsideNext));
    }

    // Code-review patch: validation tests for untrusted incoming header content.
    [Fact]
    public async Task Incoming_header_with_surrounding_whitespace_is_trimmed()
    {
        var accessor = new AsyncLocalCorrelationIdAccessor();
        string? observedInNext = null;
        var middleware = new CorrelationIdMiddleware(_ =>
        {
            observedInNext = accessor.Current;
            return Task.CompletedTask;
        });
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Correlation-Id"] = "  incoming-id-123  ";

        await middleware.InvokeAsync(context, accessor);

        Assert.Equal("incoming-id-123", observedInNext);
    }

    [Fact]
    public async Task A_repeated_header_is_rejected_not_comma_joined_and_a_fresh_id_is_minted_instead()
    {
        var accessor = new AsyncLocalCorrelationIdAccessor();
        string? observedInNext = null;
        var middleware = new CorrelationIdMiddleware(_ =>
        {
            observedInNext = accessor.Current;
            return Task.CompletedTask;
        });
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Correlation-Id"] = new Microsoft.Extensions.Primitives.StringValues(["first-id", "second-id"]);

        await middleware.InvokeAsync(context, accessor);

        Assert.NotEqual("first-id", observedInNext);
        Assert.NotEqual("second-id", observedInNext);
        Assert.DoesNotContain(',', observedInNext);
        Assert.False(string.IsNullOrWhiteSpace(observedInNext));
    }

    [Fact]
    public async Task An_over_length_header_is_rejected_and_a_fresh_id_is_minted_instead()
    {
        var accessor = new AsyncLocalCorrelationIdAccessor();
        string? observedInNext = null;
        var middleware = new CorrelationIdMiddleware(_ =>
        {
            observedInNext = accessor.Current;
            return Task.CompletedTask;
        });
        var context = new DefaultHttpContext();
        var overLong = new string('a', 129);
        context.Request.Headers["X-Correlation-Id"] = overLong;

        await middleware.InvokeAsync(context, accessor);

        Assert.NotEqual(overLong, observedInNext);
        Assert.True(observedInNext!.Length <= 128);
    }

    [Theory]
    [InlineData("has spaces inside")]
    [InlineData("has,a,comma")]
    [InlineData("has\nnewline")]
    [InlineData("<script>alert(1)</script>")]
    public async Task A_header_with_disallowed_characters_is_rejected_and_a_fresh_id_is_minted_instead(string invalidValue)
    {
        var accessor = new AsyncLocalCorrelationIdAccessor();
        string? observedInNext = null;
        var middleware = new CorrelationIdMiddleware(_ =>
        {
            observedInNext = accessor.Current;
            return Task.CompletedTask;
        });
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Correlation-Id"] = invalidValue;

        await middleware.InvokeAsync(context, accessor);

        Assert.NotEqual(invalidValue, observedInNext);
        Assert.False(string.IsNullOrWhiteSpace(observedInNext));
    }

    [Fact]
    public async Task A_whitespace_only_header_is_rejected_and_a_fresh_id_is_minted_instead()
    {
        var accessor = new AsyncLocalCorrelationIdAccessor();
        string? observedInNext = null;
        var middleware = new CorrelationIdMiddleware(_ =>
        {
            observedInNext = accessor.Current;
            return Task.CompletedTask;
        });
        var context = new DefaultHttpContext();
        context.Request.Headers["X-Correlation-Id"] = "   ";

        await middleware.InvokeAsync(context, accessor);

        Assert.False(string.IsNullOrWhiteSpace(observedInNext));
    }

    [Fact]
    public async Task Response_header_is_set_even_though_the_accessor_value_does_not_flow_back_to_the_caller()
    {
        // Documents the asymmetry explicitly: unlike the AsyncLocal-backed accessor, the response
        // header write happens directly on the shared HttpContext object (not ambient/AsyncLocal
        // state), so it IS visible to the test after InvokeAsync returns -- this is intentional
        // and is exactly what lets a client see X-Correlation-Id on the actual HTTP response.
        var accessor = new AsyncLocalCorrelationIdAccessor();
        var middleware = new CorrelationIdMiddleware(_ => Task.CompletedTask);
        var context = new DefaultHttpContext();

        await middleware.InvokeAsync(context, accessor);

        Assert.False(string.IsNullOrWhiteSpace(context.Response.Headers["X-Correlation-Id"].ToString()));
    }
}

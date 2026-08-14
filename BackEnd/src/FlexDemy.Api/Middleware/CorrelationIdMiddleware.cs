using FlexDemy.Application.Common;

namespace FlexDemy.Api.Middleware;

// AD-23/Story 4.1: registered before ExceptionHandlingMiddleware in Program.cs so a Correlation
// ID is always already established by the time any exception is caught. Reuses an incoming
// X-Correlation-Id header if present and well-formed, otherwise mints a fresh GUID -- not
// IIdGenerator.NewId() (AD-9 only binds entity primary keys; this isn't a persisted entity). Sets
// the response header before calling next() so it's present on both success and
// exception-mapped responses.
public class CorrelationIdMiddleware(RequestDelegate next)
{
    private const string HeaderName = "X-Correlation-Id";

    public async Task InvokeAsync(HttpContext context, ICorrelationIdAccessor correlationIdAccessor)
    {
        var correlationId = TryGetValidIncomingId(context) ?? Guid.NewGuid().ToString();

        correlationIdAccessor.Set(correlationId);
        context.Response.Headers[HeaderName] = correlationId;

        await next(context);
    }

    private static string? TryGetValidIncomingId(HttpContext context)
    {
        if (!context.Request.Headers.TryGetValue(HeaderName, out var incoming))
            return null;

        // A repeated header (sent more than once) is rejected rather than silently comma-joined by
        // StringValues.ToString() -- an ambiguous client request shouldn't produce one "merged" ID.
        if (incoming.Count != 1)
            return null;

        // Code-review patch (Story 4.4): shape/length validation moved to the shared
        // CorrelationIdValidator so ErrorReportingController's own untrusted CorrelationId body
        // field applies the identical rule -- see that class's header comment. A
        // rejected/invalid value falls back to a freshly minted GUID -- never blocks the request.
        return CorrelationIdValidator.Sanitize(incoming[0]);
    }
}

using FlexDemy.Application.Common;
using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;

namespace FlexDemy.Api.Middleware;

// AD-5/AD-10: the single place AppException subtypes are translated into RFC 7807
// ProblemDetails. Add a new `case` here (not a bespoke error shape elsewhere) when
// AppException gains a new subtype.
// Story 4.3/FR-1/FR-2: also the outermost capture site -- catches every exception (AppException or
// not), not just AppException, so a non-AppException (e.g. NullReferenceException) is captured
// too. The switch expression's `_` fallback already produces the correct 500 for anything that
// isn't a listed AppException subtype, so widening the catch clause is the entire behavior change;
// every existing mapped status code is unaffected.
public class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger, IErrorCaptureService errorCaptureService, ICurrentUserService currentUserService)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        // Code-review patch: excludes OperationCanceledException, matching the identical guard
        // already used by all 4 Hangfire jobs -- an ordinary client disconnect (tab closed,
        // navigation away) must not be mapped to a spurious 500 and captured as a backend error;
        // it propagates uncaught, same as before this story widened the catch clause.
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            var (statusCode, title) = ex switch
            {
                NotFoundException => (StatusCodes.Status404NotFound, "Not Found"),
                ValidationException => (StatusCodes.Status400BadRequest, "Validation Failed"),
                ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
                UnauthorizedAppException => (StatusCodes.Status401Unauthorized, "Unauthorized"),
                AiGatewayException => (StatusCodes.Status502BadGateway, "AI Gateway Error"),
                AiResponseValidationException => (StatusCodes.Status502BadGateway, "AI Response Validation Failed"),
                AiTaskUnavailableException => (StatusCodes.Status503ServiceUnavailable, "AI Task Unavailable"),
                AiTaskBudgetExceededException => (StatusCodes.Status429TooManyRequests, "AI Task Budget Exceeded"),
                _ => (StatusCodes.Status500InternalServerError, "Unexpected Error"),
            };

            logger.LogWarning(ex, "Request failed with {ExceptionType}", ex.GetType().Name);

            // Story 4.3: CaptureAsync already swallows its own failures (Story 4.2, NFR2) -- no
            // extra try/catch needed here, and it never delays or alters the response below.
            //
            // Code-review patch: OriginContext uses the matched route PATTERN (e.g.
            // "api/v1/courses/{id}/publish"), not the resolved path with real id values -- the
            // latter breaks ErrorFingerprintGenerator's dedup (which normalizes Message but not
            // OriginContext), since two different resource ids for the same underlying bug would
            // otherwise hash to two different Fingerprints instead of one recurring one. Falls
            // back to the raw path only if no endpoint matched at all (routing failed before
            // resolving one). Uses CancellationToken.None, not context.RequestAborted -- the
            // token most likely to already be canceled for the client-disconnect case this catch
            // can still reach (a real exception racing a disconnect), which would otherwise make
            // CaptureAsync's own DB calls throw immediately and get silently swallowed by its
            // NFR2 catch-all; capture's whole point is to persist independent of the request's
            // own lifecycle. UserId is read via the same ICurrentUserService this codebase's
            // other authenticated-user lookups already use (AuditSaveChangesInterceptor), rather
            // than re-deriving the ClaimTypes.NameIdentifier-vs-JwtRegisteredClaimNames.Sub
            // ambiguity ad hoc (see HttpContextCurrentUserService's own comment on why both must
            // be checked).
            await errorCaptureService.CaptureAsync(new ErrorCaptureRequest
            {
                ExceptionType = ex.GetType().Name,
                Message = ex.Message,
                StackTrace = ex.StackTrace,
                Source = ErrorSource.Backend,
                OriginContext = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? context.Request.Path,
                RequestPath = context.Request.Path,
                UserId = currentUserService.UserId,
            }, CancellationToken.None);

            context.Response.StatusCode = statusCode;
            context.Response.ContentType = "application/problem+json";

            var problemDetails = new ProblemDetails
            {
                Status = statusCode,
                Title = title,
                Detail = ex.Message,
                Instance = context.Request.Path,
            };

            await context.Response.WriteAsJsonAsync(problemDetails);
        }
    }
}

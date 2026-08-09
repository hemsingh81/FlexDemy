using FlexDemy.Application.Common;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Middleware;

// AD-5/AD-10: the single place AppException subtypes are translated into RFC 7807
// ProblemDetails. Add a new `case` here (not a bespoke error shape elsewhere) when
// AppException gains a new subtype.
public class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (AppException ex)
        {
            var (statusCode, title) = ex switch
            {
                NotFoundException => (StatusCodes.Status404NotFound, "Not Found"),
                ValidationException => (StatusCodes.Status400BadRequest, "Validation Failed"),
                ConflictException => (StatusCodes.Status409Conflict, "Conflict"),
                UnauthorizedAppException => (StatusCodes.Status401Unauthorized, "Unauthorized"),
                _ => (StatusCodes.Status500InternalServerError, "Unexpected Error"),
            };

            logger.LogWarning(ex, "Request failed with {ExceptionType}", ex.GetType().Name);

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

namespace FlexDemy.Application.Common;

// AD-5/AD-10: Application signals failure via typed exceptions, never a Result<T> wrapper.
// FlexDemy.Api/Middleware/ExceptionHandlingMiddleware.cs maps each subtype to its
// ProblemDetails status code -- add a new subtype here (not a new ad-hoc exception type
// elsewhere) when a use-case needs a new failure kind.
public abstract class AppException(string message) : Exception(message);

public sealed class NotFoundException(string entityName, string id)
    : AppException($"{entityName} '{id}' was not found.");

public sealed class ValidationException(string message) : AppException(message);

public sealed class ConflictException(string message) : AppException(message);

public sealed class UnauthorizedAppException(string message) : AppException(message);

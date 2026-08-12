namespace FlexDemy.Application.Common;

// AD-5/AD-10: Application signals failure via typed exceptions, never a Result<T> wrapper.
// FlexDemy.Api/Middleware/ExceptionHandlingMiddleware.cs maps each subtype to its
// ProblemDetails status code -- add a new subtype here (not a new ad-hoc exception type
// elsewhere) when a use-case needs a new failure kind.
public abstract class AppException(string message, Exception? innerException = null) : Exception(message, innerException);

public sealed class NotFoundException(string entityName, string id)
    : AppException($"{entityName} '{id}' was not found.");

public sealed class ValidationException(string message) : AppException(message);

public sealed class ConflictException(string message) : AppException(message);

public sealed class UnauthorizedAppException(string message) : AppException(message);

// AD-14: thrown by IAiGateway implementations when the upstream gateway call fails (non-success
// HTTP status, network error, or no API key configured for the requested provider). Maps to 502.
public sealed class AiGatewayException(string message) : AppException(message);

// AD-14 (Story 1.6): thrown by IAiTaskGateway when BOTH the primary and fallback provider for an
// AI Task fail -- a distinct, terminal state from AiGatewayException (which is IAiGateway's own
// single-call failure). Maps to 503. Carries the fallback's own failure as InnerException so
// exception-based telemetry (APM/error aggregation) retains the causal chain, not just the log line.
public sealed class AiTaskUnavailableException(string taskId, Exception? innerException = null)
    : AppException($"AI Task '{taskId}' is unavailable: both the primary and fallback provider failed.", innerException);

// AD-18 (Story 1.8): thrown when a pre-flight atomic reserve blocks a call because it would push
// the task's spend past its configured budget threshold (or no budget row exists for the task).
// Maps to 429 -- a distinct, terminal state from AiTaskUnavailableException (which is "both
// providers failed"); this is "the call was never attempted because the budget forbade it."
public sealed class AiTaskBudgetExceededException(string taskId)
    : AppException($"AI Task '{taskId}' has exceeded its configured budget threshold.");

// Story 2.6/AD-22: thrown by IFileScanner when the malware scanner itself is unreachable
// (connection failure/timeout) -- never returned as a "clean" FileScanResult. Caught inside
// ScanFileJob (Infrastructure/Jobs), not surfaced to any HTTP request, so it has no
// ExceptionHandlingMiddleware mapping.
public sealed class FileScanUnavailableException(string message, Exception? innerException = null)
    : AppException(message, innerException);

// Story 2.7/AD-21: thrown by IDocumentParser when the Docling parsing service itself is
// unreachable/erroring -- same fail-closed shape as FileScanUnavailableException. Caught inside
// ParseFileJob, not surfaced to any HTTP request.
public sealed class DocumentParsingUnavailableException(string message, Exception? innerException = null)
    : AppException(message, innerException);

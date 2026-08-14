using FlexDemy.Domain.ErrorObservability;

namespace FlexDemy.Application.ErrorObservability;

// FR-9: rule-based, deterministic category assignment -- one primary Category from a fixed
// 9-value set, plus an optional BackgroundJobError cross-cutting tag (SecondaryCategory, never
// the primary value itself). A pure function over ErrorCaptureRequest's own fields, so it never
// needs to re-derive anything from a live exception object.
public static class ErrorCategoryMapper
{
    private static readonly HashSet<string> ExternalIntegrationExceptionTypes = new(StringComparer.Ordinal)
    {
        "AiGatewayException",
        "AiTaskUnavailableException",
        "AiResponseValidationException",
        "AiTaskBudgetExceededException",
        "DocumentParsingUnavailableException",
        "FileScanUnavailableException",
    };

    private static readonly HashSet<string> FileProcessingOrigins = new(StringComparer.OrdinalIgnoreCase)
    {
        "ScanFileJob",
        "ParseFileJob",
    };

    public static (ErrorCategory Category, ErrorCategory? SecondaryCategory) Map(ErrorCaptureRequest request)
    {
        var category = MapPrimary(request);
        var secondaryCategory = request.IsBackgroundJobFailure ? ErrorCategory.BackgroundJobError : (ErrorCategory?)null;
        return (category, secondaryCategory);
    }

    private static ErrorCategory MapPrimary(ErrorCaptureRequest request)
    {
        if (request.Source == ErrorSource.Frontend)
            return ErrorCategory.FrontendRuntimeError;

        var exceptionTypeCategory = MapByExceptionType(request.ExceptionType);

        // Code-review patch: File Processing wins over External Integration *specifically* (FR-9's
        // own wording), never over any other category a job's exception type maps to. The
        // original check ran before the exception-type switch entirely, so it also silently
        // overrode ValidationError/AuthenticationAuthorizationError/DataIntegrityError whenever
        // OriginContext was ScanFileJob/ParseFileJob -- e.g. a ConflictException thrown inside
        // ParseFileJob lost its DataIntegrityError classification, and with it Phase A's
        // unconditional-P0 guarantee for that category. Now the override only applies when the
        // exception-type rules would otherwise have produced ExternalIntegrationError.
        if (exceptionTypeCategory == ErrorCategory.ExternalIntegrationError
            && request.OriginContext is not null
            && FileProcessingOrigins.Contains(request.OriginContext))
        {
            return ErrorCategory.FileProcessingError;
        }

        return exceptionTypeCategory;
    }

    private static ErrorCategory MapByExceptionType(string? exceptionType)
    {
        if (string.IsNullOrEmpty(exceptionType))
            return ErrorCategory.Uncategorized;

        return exceptionType switch
        {
            "ValidationException" => ErrorCategory.ValidationError,
            "UnauthorizedAppException" => ErrorCategory.AuthenticationAuthorizationError,
            "ConflictException" => ErrorCategory.DataIntegrityError,
            _ when ExternalIntegrationExceptionTypes.Contains(exceptionType) => ErrorCategory.ExternalIntegrationError,
            // [ASSUMPTION: the PRD's FR-9 table lists both "System/Infrastructure Error" and
            // "Uncategorized" as "nothing else matched" -- disambiguated here as: a named-but-
            // unrecognized ExceptionType (a real exception object that just isn't one of the 10
            // known AppException subtypes, e.g. a raw NullReferenceException reaching FR-1's
            // global catch-all, or a DB connectivity exception) is SystemInfrastructureError;
            // Uncategorized is reserved for a genuinely absent ExceptionType (handled above).
            // Confirm before build if the opposite mapping was intended. Code-review note
            // (2026-08-13, user-confirmed): NotFoundException correctly falls into this bucket --
            // intended behavior, not a gap.]
            _ => ErrorCategory.SystemInfrastructureError,
        };
    }
}

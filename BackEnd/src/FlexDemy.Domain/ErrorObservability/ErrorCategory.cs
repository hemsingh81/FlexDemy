namespace FlexDemy.Domain.ErrorObservability;

// FR-9: 9-value fixed, deterministic mapping. BackgroundJobError is only ever assigned as the
// cross-cutting tag value on ErrorRecord.SecondaryCategory (see ErrorCategoryMapper) -- it is
// never the primary Category value.
public enum ErrorCategory
{
    SystemInfrastructureError,
    ValidationError,
    AuthenticationAuthorizationError,
    ExternalIntegrationError,
    FileProcessingError,
    DataIntegrityError,
    BackgroundJobError,
    FrontendRuntimeError,
    Uncategorized,
}

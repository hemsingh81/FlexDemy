using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using Xunit;

namespace FlexDemy.Application.Tests.ErrorObservability;

public class ErrorCategoryMapperTests
{
    private static ErrorCaptureRequest MakeRequest(
        string? exceptionType = null,
        ErrorSource source = ErrorSource.Backend,
        string? originContext = null,
        bool isBackgroundJobFailure = false) => new()
    {
        ExceptionType = exceptionType,
        Message = "something failed",
        Source = source,
        OriginContext = originContext,
        IsBackgroundJobFailure = isBackgroundJobFailure,
    };

    // -- One test per FR-9 table row -------------------------------------------------------------

    [Fact]
    public void Unrecognized_exception_type_maps_to_SystemInfrastructureError()
    {
        var (category, _) = ErrorCategoryMapper.Map(MakeRequest(exceptionType: "NullReferenceException"));

        Assert.Equal(ErrorCategory.SystemInfrastructureError, category);
    }

    [Fact]
    public void ValidationException_maps_to_ValidationError()
    {
        var (category, _) = ErrorCategoryMapper.Map(MakeRequest(exceptionType: "ValidationException"));

        Assert.Equal(ErrorCategory.ValidationError, category);
    }

    [Fact]
    public void UnauthorizedAppException_maps_to_AuthenticationAuthorizationError()
    {
        var (category, _) = ErrorCategoryMapper.Map(MakeRequest(exceptionType: "UnauthorizedAppException"));

        Assert.Equal(ErrorCategory.AuthenticationAuthorizationError, category);
    }

    [Theory]
    [InlineData("AiGatewayException")]
    [InlineData("AiTaskUnavailableException")]
    [InlineData("AiResponseValidationException")]
    [InlineData("AiTaskBudgetExceededException")]
    [InlineData("DocumentParsingUnavailableException")]
    [InlineData("FileScanUnavailableException")]
    public void The_6_external_integration_exception_types_map_to_ExternalIntegrationError(string exceptionType)
    {
        var (category, _) = ErrorCategoryMapper.Map(MakeRequest(exceptionType: exceptionType));

        Assert.Equal(ErrorCategory.ExternalIntegrationError, category);
    }

    // Code-review patch: File Processing only wins when the exception type would otherwise have
    // resolved External Integration -- an origin of ScanFileJob/ParseFileJob alone, with no
    // exception type (or one from another category), does not.
    [Theory]
    [InlineData("ScanFileJob")]
    [InlineData("ParseFileJob")]
    public void Origin_is_ScanFileJob_or_ParseFileJob_with_an_ExternalIntegration_exception_type_maps_to_FileProcessingError(string originContext)
    {
        var (category, _) = ErrorCategoryMapper.Map(MakeRequest(exceptionType: "AiGatewayException", originContext: originContext));

        Assert.Equal(ErrorCategory.FileProcessingError, category);
    }

    [Fact]
    public void ConflictException_maps_to_DataIntegrityError()
    {
        var (category, _) = ErrorCategoryMapper.Map(MakeRequest(exceptionType: "ConflictException"));

        Assert.Equal(ErrorCategory.DataIntegrityError, category);
    }

    [Fact]
    public void Frontend_source_maps_to_FrontendRuntimeError_regardless_of_exception_type()
    {
        var (category, _) = ErrorCategoryMapper.Map(MakeRequest(source: ErrorSource.Frontend, exceptionType: "TypeError"));

        Assert.Equal(ErrorCategory.FrontendRuntimeError, category);
    }

    [Fact]
    public void A_null_exception_type_with_no_origin_maps_to_Uncategorized()
    {
        var (category, _) = ErrorCategoryMapper.Map(MakeRequest());

        Assert.Equal(ErrorCategory.Uncategorized, category);
    }

    [Fact]
    public void IsBackgroundJobFailure_sets_SecondaryCategory_to_BackgroundJobError_never_the_primary_Category()
    {
        var (category, secondaryCategory) = ErrorCategoryMapper.Map(
            MakeRequest(exceptionType: "AiGatewayException", originContext: "ExtractStructureJob", isBackgroundJobFailure: true));

        Assert.Equal(ErrorCategory.ExternalIntegrationError, category);
        Assert.Equal(ErrorCategory.BackgroundJobError, secondaryCategory);
    }

    [Fact]
    public void IsBackgroundJobFailure_false_leaves_SecondaryCategory_null()
    {
        var (_, secondaryCategory) = ErrorCategoryMapper.Map(MakeRequest(exceptionType: "AiGatewayException"));

        Assert.Null(secondaryCategory);
    }

    // -- File Processing vs External Integration overlap ------------------------------------------

    [Fact]
    public void FileProcessingError_wins_over_ExternalIntegrationError_when_both_would_otherwise_apply()
    {
        var (category, _) = ErrorCategoryMapper.Map(
            MakeRequest(exceptionType: "DocumentParsingUnavailableException", originContext: "ParseFileJob"));

        Assert.Equal(ErrorCategory.FileProcessingError, category);
    }

    // Code-review patch: regression test for the original bug -- File Processing must NOT override
    // a category the exception type maps to that isn't ExternalIntegrationError. A ConflictException
    // thrown inside ParseFileJob must keep its DataIntegrityError classification (and, with it,
    // ErrorPriorityAssigner's unconditional-P0 guarantee for that category), not lose it to the
    // origin-based override.
    [Fact]
    public void FileProcessingError_does_NOT_override_DataIntegrityError_even_when_origin_is_ParseFileJob()
    {
        var (category, _) = ErrorCategoryMapper.Map(
            MakeRequest(exceptionType: "ConflictException", originContext: "ParseFileJob"));

        Assert.Equal(ErrorCategory.DataIntegrityError, category);
    }

    [Fact]
    public void FileProcessingError_does_NOT_override_ValidationError_even_when_origin_is_ScanFileJob()
    {
        var (category, _) = ErrorCategoryMapper.Map(
            MakeRequest(exceptionType: "ValidationException", originContext: "ScanFileJob"));

        Assert.Equal(ErrorCategory.ValidationError, category);
    }
}

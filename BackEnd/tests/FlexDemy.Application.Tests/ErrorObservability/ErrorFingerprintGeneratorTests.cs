using FlexDemy.Application.ErrorObservability;
using Xunit;

namespace FlexDemy.Application.Tests.ErrorObservability;

public class ErrorFingerprintGeneratorTests
{
    [Fact]
    public void Identical_inputs_produce_the_identical_fingerprint()
    {
        var a = ErrorFingerprintGenerator.Generate("NotFoundException", "CourseFile 'abc' was not found", "CoursesController");
        var b = ErrorFingerprintGenerator.Generate("NotFoundException", "CourseFile 'abc' was not found", "CoursesController");

        Assert.Equal(a, b);
    }

    [Fact]
    public void A_different_ExceptionType_produces_a_different_fingerprint()
    {
        var a = ErrorFingerprintGenerator.Generate("NotFoundException", "same message", "Origin");
        var b = ErrorFingerprintGenerator.Generate("ValidationException", "same message", "Origin");

        Assert.NotEqual(a, b);
    }

    [Fact]
    public void A_different_OriginContext_produces_a_different_fingerprint()
    {
        var a = ErrorFingerprintGenerator.Generate("NotFoundException", "same message", "ScanFileJob");
        var b = ErrorFingerprintGenerator.Generate("NotFoundException", "same message", "ParseFileJob");

        Assert.NotEqual(a, b);
    }

    // -- Message normalization: same underlying failure, different embedded id ----------------------

    [Fact]
    public void Messages_differing_only_by_an_embedded_dashed_GUID_collapse_to_the_same_fingerprint()
    {
        var a = ErrorFingerprintGenerator.Generate("NotFoundException", "CourseFile '3fa85f64-5717-4562-b3fc-2c963f66afa6' was not found", "Origin");
        var b = ErrorFingerprintGenerator.Generate("NotFoundException", "CourseFile '7c9e6679-7425-40de-944b-e07fc1f90ae7' was not found", "Origin");

        Assert.Equal(a, b);
    }

    // Code-review patch: Guid.ToString("N")'s no-dash 32-hex-char form must normalize too.
    [Fact]
    public void Messages_differing_only_by_an_embedded_no_dash_GUID_collapse_to_the_same_fingerprint()
    {
        var a = ErrorFingerprintGenerator.Generate("NotFoundException", "CourseFile '3fa85f6457174562b3fc2c963f66afa6' was not found", "Origin");
        var b = ErrorFingerprintGenerator.Generate("NotFoundException", "CourseFile '7c9e66797425" + "40de944be07fc1f90ae7' was not found", "Origin");

        Assert.Equal(a, b);
    }

    [Fact]
    public void Messages_differing_only_by_an_embedded_4_plus_digit_number_collapse_to_the_same_fingerprint()
    {
        var a = ErrorFingerprintGenerator.Generate("ConflictException", "Row 123456 already exists", "Origin");
        var b = ErrorFingerprintGenerator.Generate("ConflictException", "Row 987654 already exists", "Origin");

        Assert.Equal(a, b);
    }

    // Code-review patch: a blanket \d+ strip was over-aggressive -- distinct short numbers (e.g.
    // HTTP status codes) must NOT collapse together, since narrowing to 4+ digits was the fix.
    [Fact]
    public void Messages_differing_only_by_a_short_1_to_3_digit_number_do_NOT_collapse_e_g_distinct_status_codes()
    {
        var a = ErrorFingerprintGenerator.Generate("AiGatewayException", "AI Gateway returned 429", "Origin");
        var b = ErrorFingerprintGenerator.Generate("AiGatewayException", "AI Gateway returned 500", "Origin");

        Assert.NotEqual(a, b);
    }

    // -- Delimiter-collision fix ----------------------------------------------------------------------

    // Code-review patch: without length-prefixing, ExceptionType="Foo", Message="Bar|baz" would
    // hash identically to ExceptionType="Foo|Bar", Message="baz".
    [Fact]
    public void A_pipe_character_inside_a_field_does_not_collide_with_a_pipe_character_at_a_field_boundary()
    {
        var a = ErrorFingerprintGenerator.Generate("Foo", "Bar|baz", "Origin");
        var b = ErrorFingerprintGenerator.Generate("Foo|Bar", "baz", "Origin");

        Assert.NotEqual(a, b);
    }

    [Fact]
    public void A_null_ExceptionType_and_a_null_OriginContext_do_not_throw_and_produce_a_stable_fingerprint()
    {
        var a = ErrorFingerprintGenerator.Generate(null, "frontend crash", null);
        var b = ErrorFingerprintGenerator.Generate(null, "frontend crash", null);

        Assert.Equal(a, b);
    }
}

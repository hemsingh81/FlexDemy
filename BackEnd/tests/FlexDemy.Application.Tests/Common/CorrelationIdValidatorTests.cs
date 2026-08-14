using FlexDemy.Application.Common;

namespace FlexDemy.Application.Tests.Common;

public class CorrelationIdValidatorTests
{
    [Theory]
    [InlineData("abc123")]
    [InlineData("ABC-123_xyz")]
    [InlineData("11111111-1111-1111-1111-111111111111")]
    public void Sanitize_returns_a_well_formed_opaque_token_trimmed(string value)
    {
        Assert.Equal(value, CorrelationIdValidator.Sanitize(value));
    }

    [Fact]
    public void Sanitize_trims_surrounding_whitespace()
    {
        Assert.Equal("abc123", CorrelationIdValidator.Sanitize("  abc123  "));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("has spaces")]
    [InlineData("semi;colon")]
    [InlineData("<script>")]
    public void Sanitize_returns_null_for_missing_or_malformed_input(string? value)
    {
        Assert.Null(CorrelationIdValidator.Sanitize(value));
    }

    [Fact]
    public void Sanitize_returns_null_when_the_value_exceeds_128_characters()
    {
        Assert.Null(CorrelationIdValidator.Sanitize(new string('a', 129)));
    }

    [Fact]
    public void Sanitize_accepts_a_value_exactly_128_characters_long()
    {
        var value = new string('a', 128);

        Assert.Equal(value, CorrelationIdValidator.Sanitize(value));
    }
}

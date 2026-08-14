using FlexDemy.Application.ErrorObservability;
using Xunit;

namespace FlexDemy.Application.Tests.ErrorObservability;

public class ErrorRedactorTests
{
    [Fact]
    public void RedactFreeText_redacts_a_Bearer_token_while_preserving_the_Bearer_prefix()
    {
        var result = ErrorRedactor.RedactFreeText("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def");

        Assert.DoesNotContain("eyJhbGciOiJIUzI1NiJ9.abc.def", result);
        Assert.Contains("Bearer [REDACTED]", result);
    }

    [Theory]
    [InlineData("No API key configured for provider: gsk_abc123XYZ")]
    [InlineData("Firebase error, key AIzaSyD-abc123XYZ rejected")]
    public void RedactFreeText_redacts_provider_key_prefixed_secrets(string text)
    {
        var result = ErrorRedactor.RedactFreeText(text);

        Assert.Contains("[REDACTED]", result);
    }

    [Fact]
    public void RedactFreeText_redacts_a_connection_string_Password_segment_preserving_the_key_name()
    {
        var result = ErrorRedactor.RedactFreeText("Host=db;Password=hunter2secret;Port=5432");

        Assert.DoesNotContain("hunter2secret", result);
        Assert.Contains("Password=[REDACTED]", result);
    }

    [Fact]
    public void RedactFreeText_redacts_a_connection_string_Pwd_segment()
    {
        var result = ErrorRedactor.RedactFreeText("Server=db;Pwd=hunter2secret;");

        Assert.DoesNotContain("hunter2secret", result);
        Assert.Contains("Pwd=[REDACTED]", result);
    }

    [Fact]
    public void RedactFreeText_returns_null_for_null_input()
    {
        Assert.Null(ErrorRedactor.RedactFreeText(null));
    }

    [Fact]
    public void RedactFreeText_leaves_text_with_no_secret_shaped_content_unchanged()
    {
        var result = ErrorRedactor.RedactFreeText("Course 'course_1' was not found");

        Assert.Equal("Course 'course_1' was not found", result);
    }

    [Fact]
    public void RedactFreeText_redacts_an_additional_sensitive_value_case_insensitively()
    {
        var result = ErrorRedactor.RedactFreeText("token was ABCDEFGH12345678", ["abcdefgh12345678"]);

        Assert.DoesNotContain("ABCDEFGH12345678", result);
        Assert.Contains("[REDACTED]", result);
    }

    [Fact]
    public void GetDenyListedContextValues_returns_the_value_for_a_key_matching_a_deny_listed_substring()
    {
        var context = new Dictionary<string, string> { ["ApiKey"] = "super-secret-value-123" };

        var values = ErrorRedactor.GetDenyListedContextValues(context).ToList();

        Assert.Contains("super-secret-value-123", values);
    }

    [Fact]
    public void GetDenyListedContextValues_matches_deny_listed_keys_case_insensitively()
    {
        var context = new Dictionary<string, string> { ["apikey"] = "super-secret-value-123" };

        var values = ErrorRedactor.GetDenyListedContextValues(context).ToList();

        Assert.Contains("super-secret-value-123", values);
    }

    [Fact]
    public void GetDenyListedContextValues_ignores_a_key_not_matching_any_deny_listed_substring()
    {
        var context = new Dictionary<string, string> { ["Notes"] = "just some notes" };

        var values = ErrorRedactor.GetDenyListedContextValues(context).ToList();

        Assert.Empty(values);
    }

    // Code-review patch: a value shorter than the minimum redactable length is skipped, to avoid
    // a blind substring replace mangling unrelated text.
    [Fact]
    public void GetDenyListedContextValues_skips_a_value_shorter_than_the_minimum_redactable_length()
    {
        var context = new Dictionary<string, string> { ["Password"] = "1" };

        var values = ErrorRedactor.GetDenyListedContextValues(context).ToList();

        Assert.Empty(values);
    }

    [Fact]
    public void GetDenyListedContextValues_returns_null_context_as_empty()
    {
        var values = ErrorRedactor.GetDenyListedContextValues(null).ToList();

        Assert.Empty(values);
    }
}

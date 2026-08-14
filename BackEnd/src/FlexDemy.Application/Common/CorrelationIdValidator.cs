using System.Text.RegularExpressions;

namespace FlexDemy.Application.Common;

// Code-review patch (Story 4.4): extracted from CorrelationIdMiddleware (Story 4.1) so
// ErrorReportingController can apply the identical untrusted-client-input validation to
// ReportClientErrorRequest.CorrelationId -- that field is just as much unvalidated client input
// as the X-Correlation-Id request header the middleware already guards, just arriving in a body
// field on an anonymous endpoint instead. One shared shape/length rule for both, not two.
public static partial class CorrelationIdValidator
{
    private const int MaxLength = 128;

    [GeneratedRegex("^[A-Za-z0-9_-]+$")]
    private static partial Regex ValidPattern();

    // Returns the trimmed value if it's a well-formed opaque token (letters/digits/hyphen/
    // underscore, matching a GUID's own character set with headroom for other reasonable opaque
    // tokens), or null if the input is missing, too long, or contains anything else.
    public static string? Sanitize(string? value)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Length > MaxLength || !ValidPattern().IsMatch(trimmed))
            return null;

        return trimmed;
    }
}

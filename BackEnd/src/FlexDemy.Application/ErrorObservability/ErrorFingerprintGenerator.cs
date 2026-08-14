using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace FlexDemy.Application.ErrorObservability;

// FR-8: deterministic hash of ExceptionType + NormalizedMessage + OriginContext, grouping repeat
// occurrences of the same underlying failure into one ErrorRecord (AC #1/#2 of Story 4.2).
// [ASSUMPTION: the PRD does not specify a message-normalization algorithm -- confirm before
// build.] Strips embedded GUIDs (both dashed and Guid.ToString("N")'s no-dash 32-hex-char form)
// and standalone 4+-digit numeric-id runs before hashing, so two occurrences of "CourseFile
// 'abc123-...' was not found" and "CourseFile 'xyz789-...' was not found" collapse into one
// Fingerprint instead of one per distinct id -- without this, FR-8's dedup premise silently fails
// for the most common real error shape (a NotFoundException with an embedded id). The 4-digit
// floor (code-review patch) avoids collapsing genuinely distinct short numbers that aren't ids --
// e.g. an HTTP status code ("returned 429" vs "returned 500") -- into the same Fingerprint; this
// app's real entity ids are GUIDs (AD-9), not small integers, so a blanket \d+ strip was
// over-aggressive relative to what actually needs normalizing here.
public static partial class ErrorFingerprintGenerator
{
    [GeneratedRegex(@"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")]
    private static partial Regex DashedGuidPattern();

    [GeneratedRegex(@"\b[0-9a-fA-F]{32}\b")]
    private static partial Regex NoDashGuidPattern();

    [GeneratedRegex(@"\b\d{4,}\b")]
    private static partial Regex NumericIdPattern();

    public static string Generate(string? exceptionType, string message, string? originContext)
    {
        var normalizedMessage = NormalizeMessage(message);

        // Code-review patch: length-prefixed encoding, not a bare "|"-delimited concatenation --
        // a delimiter with no escaping lets a value containing "|" collide across genuinely
        // different (ExceptionType, Message, OriginContext) triples (e.g. ExceptionType="Foo",
        // Message="Bar|baz" would otherwise hash identically to ExceptionType="Foo|Bar",
        // Message="baz"). Prefixing each field with its own length removes that ambiguity
        // regardless of what characters the field itself contains.
        var input = $"{exceptionType?.Length ?? -1}:{exceptionType}|{normalizedMessage.Length}:{normalizedMessage}|{originContext?.Length ?? -1}:{originContext}";

        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexStringLower(hashBytes);
    }

    private static string NormalizeMessage(string message)
    {
        var withoutDashedGuids = DashedGuidPattern().Replace(message, "{id}");
        var withoutGuids = NoDashGuidPattern().Replace(withoutDashedGuids, "{id}");
        return NumericIdPattern().Replace(withoutGuids, "{id}");
    }
}

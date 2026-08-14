using System.Text.RegularExpressions;

namespace FlexDemy.Application.ErrorObservability;

// FR-5: redacts known-sensitive values before persistence, from both structured context (deny-
// listed field names) and free-text Message/StackTrace content (secret-shaped patterns) -- the
// PRD's own "Corrections Made During Review" flagged the free-text pass as a previously-missed
// gap (a secret sitting inline in a plain sentence, e.g. an exception message that reads "Invalid
// API key: gsk_abc123", is the more common real leak shape than a value under a recognized key).
// Both passes run unconditionally, regardless of Source (AC #4's "uniformly" requirement).
public static partial class ErrorRedactor
{
    private const string Redacted = "[REDACTED]";

    // Code-review patch: a deny-listed value shorter than this is skipped entirely -- a genuine
    // credential is never this short, and a blind substring replace on a short/common value (e.g.
    // a test fixture's Password = "1") would otherwise mangle unrelated text (every "1" in "Error
    // 100 occurred at line 15").
    private const int MinRedactableValueLength = 8;

    private static readonly string[] DenyListedKeySubstrings = ["Authorization", "ApiKey", "Password", "Token"];

    [GeneratedRegex(@"(?<prefix>Bearer\s+)(?<token>[\w-]+)", RegexOptions.IgnoreCase)]
    private static partial Regex BearerTokenPattern();

    [GeneratedRegex(@"\b(gsk_|sk_|AIza)[\w-]+")]
    private static partial Regex ProviderKeyPrefixPattern();

    [GeneratedRegex(@"(?<key>Password|Pwd)=(?<value>[^;]+)", RegexOptions.IgnoreCase)]
    private static partial Regex ConnectionStringSecretPattern();

    // ErrorRecord has no separate field to persist a "structured context" dictionary -- Message
    // and StackTrace are the only text that actually gets written to the row. So the structured
    // pass's real effect is: find which context values sit under a deny-listed key, then scrub
    // any literal occurrence of those values out of the free text that does get persisted. A
    // redacted *copy* of the context dictionary would otherwise have nowhere to go and no
    // observable effect on what's actually stored.
    public static IEnumerable<string> GetDenyListedContextValues(IReadOnlyDictionary<string, string>? context)
    {
        if (context is null)
            yield break;

        foreach (var (key, value) in context)
        {
            if (IsDenyListedKey(key) && !string.IsNullOrEmpty(value) && value.Length >= MinRedactableValueLength)
                yield return value;
        }
    }

    public static string? RedactFreeText(string? text, IEnumerable<string>? additionalSensitiveValues = null)
    {
        if (string.IsNullOrEmpty(text))
            return text;

        var afterBearer = BearerTokenPattern().Replace(text, $"${{prefix}}{Redacted}");
        var afterProviderKeys = ProviderKeyPrefixPattern().Replace(afterBearer, Redacted);
        var afterConnectionStringSecrets = ConnectionStringSecretPattern().Replace(afterProviderKeys, $"${{key}}={Redacted}");

        if (additionalSensitiveValues is null)
            return afterConnectionStringSecrets;

        var result = afterConnectionStringSecrets;
        foreach (var sensitiveValue in additionalSensitiveValues)
        {
            // Code-review patch: case-insensitive -- key matching (IsDenyListedKey) is already
            // OrdinalIgnoreCase, so a casing difference between how a secret was captured in
            // structured context and how it appears in free text must not leave it unredacted.
            result = result.Replace(sensitiveValue, Redacted, StringComparison.OrdinalIgnoreCase);
        }

        return result;
    }

    private static bool IsDenyListedKey(string key) =>
        DenyListedKeySubstrings.Any(denyListed => key.Contains(denyListed, StringComparison.OrdinalIgnoreCase));
}

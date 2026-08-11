namespace FlexDemy.Infrastructure.AiGateway;

// Bound from appsettings.json's "AiGateway" section (Task 3). ProviderApiKeys defaults empty --
// real keys arrive via environment-variable overrides (AiGateway__ProviderApiKeys__{provider})
// or dotnet user-secrets in local dev, never committed (see Story 1.4 Dev Notes).
public sealed class AiGatewayOptions
{
    public const string SectionName = "AiGateway";

    public string BaseUrl { get; set; } = "http://ai-gateway:8787";

    // Case-insensitive: a provider value of "Groq" should match a configured "groq" key rather
    // than silently failing lookup (review finding, 2026-08-11 review).
    public Dictionary<string, string> ProviderApiKeys { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

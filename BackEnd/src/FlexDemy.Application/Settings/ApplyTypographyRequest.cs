namespace FlexDemy.Application.Settings;

// The Advanced composer's save payload -- a font pairing and a size scale chosen independently and
// applied together. Both are curated slugs (FontPairingDefinition.Slug / FontSizeDefinition.Slug),
// re-validated server-side on every call; the pair itself need not match any curated combination.
public sealed record ApplyTypographyRequest(string FontPairingSlug, string FontSizeSlug);

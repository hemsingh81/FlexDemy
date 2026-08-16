namespace FlexDemy.Application.Settings;

// Deliberately NOT SettingDto/FontPairingDefinitionDto/FontSizeDefinitionDto -- this is the
// minimal public surface for the anonymous /effective-fonts endpoint: three resolved
// font-family strings plus one root-scale factor (Story 6.4), nothing admin-shaped (no Setting
// rows, no curated catalogs) reaches an unauthenticated caller. Typography (family + size) is
// one coherent concept for an anonymous caller -- extended in place, not split into a second
// public endpoint.
public sealed record EffectiveFontsDto(string DisplayFont, string BodyFont, string MonoFont, string RootFontScale);

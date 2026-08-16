namespace FlexDemy.Application.Settings;

public sealed record FontPairingDefinitionDto(
    string Slug,
    string DisplayFont,
    string BodyFont,
    string MonoFont,
    bool IsActive);

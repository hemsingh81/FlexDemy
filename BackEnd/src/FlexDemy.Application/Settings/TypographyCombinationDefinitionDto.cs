namespace FlexDemy.Application.Settings;

public sealed record TypographyCombinationDefinitionDto(
    string Slug,
    string Label,
    string FontPairingSlug,
    string FontSizeSlug,
    bool IsActive);

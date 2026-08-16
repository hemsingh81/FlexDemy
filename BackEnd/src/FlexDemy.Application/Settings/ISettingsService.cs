namespace FlexDemy.Application.Settings;

public interface ISettingsService
{
    Task<IReadOnlyList<SettingDto>> GetAllAsync(CancellationToken cancellationToken = default);

    // FR-8: the Effective Value for (key, keyType) is the stored Value when an active Setting
    // matches, otherwise the hardcoded default for that pair.
    Task<string> GetEffectiveValueAsync(string key, string keyType, CancellationToken cancellationToken = default);

    // AD-26: only IsActive (currently curated) pairings -- a decurated pairing shouldn't appear
    // as a picker option.
    Task<IReadOnlyList<FontPairingDefinitionDto>> GetFontPairingsAsync(CancellationToken cancellationToken = default);

    // Story 6.4: only IsActive (currently curated) scales -- mirrors GetFontPairingsAsync.
    Task<IReadOnlyList<FontSizeDefinitionDto>> GetFontSizesAsync(CancellationToken cancellationToken = default);

    // Code-review patch (2026-08-16): the public, anonymous-safe counterpart -- resolves the
    // active Font Setting's curated pairing server-side and returns only the three resolved
    // font-family strings. Never throws.
    Task<EffectiveFontsDto> GetEffectiveFontsAsync(CancellationToken cancellationToken = default);

    // AD-25: the exclusive mutation path for a Setting's Value. Runs FR-10's curation check for
    // Font-KeyType settings on every call, including reactivation. Story 6.3: also atomically
    // records one SettingChangeHistory entry per Apply.
    Task<SettingDto> ApplyAsync(string id, string value, CancellationToken cancellationToken = default);

    // Story 6.3/AC #2: reverse-chronological. Unknown settingId just returns an empty list.
    Task<IReadOnlyList<SettingChangeHistoryDto>> GetHistoryAsync(string settingId, CancellationToken cancellationToken = default);

    // Story 6.5: only IsActive combos whose referenced Font Pairing AND Font Size are themselves
    // still active -- never surfaces a preset that's guaranteed to fail if applied.
    Task<IReadOnlyList<TypographyCombinationDefinitionDto>> GetTypographyCombinationsAsync(CancellationToken cancellationToken = default);

    // Story 6.5: a new, additive operation -- atomically applies a curated combo's Font Pairing
    // AND Font Size together (both succeed or neither does). Does not replace or modify
    // ApplyAsync, which remains the exclusive single-Setting mutation path.
    Task<TypographyApplyResultDto> ApplyTypographyCombinationAsync(string comboSlug, CancellationToken cancellationToken = default);

    // The Advanced composer's save: an independently-chosen Font Pairing + Font Size applied
    // together with the same all-or-nothing guarantee as a curated combination, so a custom pair
    // can never land half-applied. The pair itself need not match any curated combination; each
    // half must still be independently curated and active.
    Task<TypographyApplyResultDto> ApplyTypographyAsync(string fontPairingSlug, string fontSizeSlug, CancellationToken cancellationToken = default);
}

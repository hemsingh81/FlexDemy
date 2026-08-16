using FlexDemy.Application.Common;
using FlexDemy.Domain.Common;
using FlexDemy.Domain.Settings;
using Microsoft.Extensions.Logging;
using System.Diagnostics.CodeAnalysis;

namespace FlexDemy.Application.Settings;

// AD-3: plain service, no mediator. AD-25: ApplyAsync is the exclusive mutation path for a
// Setting's Value (Story 6.2), now also the exclusive recorder of SettingChangeHistory (Story 6.3).
public class SettingsService(
    ISettingRepository repository,
    IFontPairingDefinitionRepository fontPairingDefinitionRepository,
    IFontSizeDefinitionRepository fontSizeDefinitionRepository,
    ITypographyCombinationDefinitionRepository typographyCombinationDefinitionRepository,
    ISettingChangeHistoryRepository historyRepository,
    ICurrentUserService currentUserService,
    IIdGenerator idGenerator,
    IUnitOfWork unitOfWork,
    ILogger<SettingsService> logger) : ISettingsService
{
    // FR-8's hardcoded defaults, keyed by (Key, KeyType). The Font/FontSize default identifiers
    // here must match DatabaseSeeder.EnsureSettingsAsync's seeded rows exactly -- both are the
    // fallback for "no curated value has been chosen yet," not real curated content (the curated
    // lists' actual content are [NOTE FOR PM] open items in the PRD, not yet defined).
    private static readonly Dictionary<(string Key, string KeyType), string> HardcodedDefaults = new()
    {
        [("font.pairing", "Font")] = "default",
        [("font.size", "FontSize")] = "default",
    };

    // Code-review patch (2026-08-16) / Story 6.4: the literal fallback for GetEffectiveFontsAsync,
    // matching FrontEnd/src/index.css's @theme block exactly -- verified against the file, not
    // assumed. Used only if resolving the active Setting's curated definition fails for any
    // reason (missing/decurated row, empty store pre-seed); GetEffectiveFontsAsync must never
    // throw. Font and FontSize resolve completely independently -- see GetEffectiveFontsAsync.
    private static readonly EffectiveFontsDto HardcodedFontDefaults = new(
        "\"Fraunces\", Georgia, serif",
        "\"Outfit\", system-ui, sans-serif",
        "\"JetBrains Mono\", monospace",
        "100%");

    public async Task<IReadOnlyList<SettingDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var settings = await repository.GetAllAsync(cancellationToken);
        return settings.Select(s => s.ToDto()).ToList();
    }

    public async Task<string> GetEffectiveValueAsync(string key, string keyType, CancellationToken cancellationToken = default)
    {
        var settings = await repository.GetAllAsync(cancellationToken);
        var match = settings.FirstOrDefault(s => s.Key == key && s.KeyType == keyType && s.IsActive);
        if (match is not null)
        {
            return match.Value;
        }

        return HardcodedDefaults.TryGetValue((key, keyType), out var fallback)
            ? fallback
            : throw new KeyNotFoundException($"No hardcoded default registered for ({key}, {keyType}).");
    }

    public async Task<IReadOnlyList<FontPairingDefinitionDto>> GetFontPairingsAsync(CancellationToken cancellationToken = default)
    {
        var pairings = await fontPairingDefinitionRepository.GetAllAsync(cancellationToken);
        return pairings.Where(p => p.IsActive).Select(p => p.ToDto()).ToList();
    }

    public async Task<IReadOnlyList<FontSizeDefinitionDto>> GetFontSizesAsync(CancellationToken cancellationToken = default)
    {
        var sizes = await fontSizeDefinitionRepository.GetAllAsync(cancellationToken);
        return sizes.Where(s => s.IsActive).Select(s => s.ToDto()).ToList();
    }

    // Code-review patch (2026-08-16): the public, anonymous-safe counterpart to GetAllAsync/
    // GetFontPairingsAsync -- resolves the active Font Setting's curated pairing server-side and
    // returns only the three resolved font-family strings, never the admin Settings list or the
    // full curated catalog. This is what SiteSettingsContext.tsx now calls instead of the two
    // admin-gated endpoints it originally called (the bug this patch fixes: those endpoints
    // require FeatureKeys.SettingsManage, so every non-Master/Support visitor -- nearly everyone,
    // including anonymous visitors on the login screen -- got 401/403, silently swallowed by the
    // frontend's own fail-safe catch, and never saw the applied font). Never throws -- matches
    // NFR-4's fail-safe philosophy at this lowest, most public level too.
    // Story 6.4: resolves Font Pairing and Font Size into local variables via two structurally
    // independent try/catch blocks -- neither returns early -- then builds exactly one
    // EffectiveFontsDto from both locals at the end. This is deliberate, not incidental: an early
    // return on a successful Font Pairing resolution would make Font Size resolution permanently
    // dead code (a failure resolving one must never suppress a successful resolution of the other
    // -- AC #3/FR-20's independence guarantee, enforced here in code, not just by the DTO shape).
    // Code-review patch (2026-08-16, second pass): fetches the Settings table once and resolves
    // both (Key, KeyType) pairs from that single in-memory list -- the prior version called
    // GetEffectiveValueAsync twice, each doing its own independent repository.GetAllAsync, so this
    // hot anonymous endpoint (hit on every page load site-wide) was fetching the whole table
    // twice per request. Also checks .IsActive on the resolved definition row (GetFontPairingsAsync/
    // GetFontSizesAsync and ApplyAsync's curation check all already do this -- the omission here
    // would have let a decurated-but-not-deleted row keep being served to every visitor). Each
    // catch re-throws a genuine cancellation (a cancelled/aborted anonymous request should
    // propagate normally, not silently resolve to a fake 200) and logs anything else -- a
    // backend defect degrading to hardcoded defaults should be diagnosable, not invisible.
    public async Task<EffectiveFontsDto> GetEffectiveFontsAsync(CancellationToken cancellationToken = default)
    {
        var settings = await repository.GetAllAsync(cancellationToken);

        string EffectiveValue(string key, string keyType)
        {
            var match = settings.FirstOrDefault(s => s.Key == key && s.KeyType == keyType && s.IsActive);
            return match?.Value ?? HardcodedDefaults[(key, keyType)];
        }

        var (displayFont, bodyFont, monoFont) = (HardcodedFontDefaults.DisplayFont, HardcodedFontDefaults.BodyFont, HardcodedFontDefaults.MonoFont);
        try
        {
            var pairing = await fontPairingDefinitionRepository.GetBySlugAsync(EffectiveValue("font.pairing", "Font"), cancellationToken);
            if (pairing is not null && pairing.IsActive) (displayFont, bodyFont, monoFont) = (pairing.DisplayFont, pairing.BodyFont, pairing.MonoFont);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Failed to resolve the effective Font Pairing; falling back to hardcoded defaults.");
        }

        var rootFontScale = HardcodedFontDefaults.RootFontScale;
        try
        {
            var size = await fontSizeDefinitionRepository.GetBySlugAsync(EffectiveValue("font.size", "FontSize"), cancellationToken);
            if (size is not null && size.IsActive) rootFontScale = size.RootFontScale;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Failed to resolve the effective Font Size scale; falling back to the hardcoded default.");
        }

        return new EffectiveFontsDto(displayFont, bodyFont, monoFont, rootFontScale);
    }

    // Code-review patch (2026-08-16, Story 6.5): shared by all 4 curation-validity checks in this
    // class (ApplyAsync's Font/FontSize branches, ApplyTypographyCombinationAsync's pairing/size
    // checks) -- was duplicated as `x is null || !x.IsActive` at each site with no shared helper,
    // increasing the odds one site silently drifts from the others as this file grows.
    // [NotNullWhen(true)] lets the compiler's nullable flow analysis understand `if
    // (!IsCuratedAndActive(x)) throw ...; x.Whatever` as a valid null-narrowing guard, the same
    // way a direct `if (x is null) throw` is recognized -- without it, every call site would need
    // a null-forgiving `!` on every subsequent dereference despite the guard genuinely covering it.
    private static bool IsCuratedAndActive<T>([NotNullWhen(true)] T? definition) where T : AuditableEntity =>
        definition is not null && definition.IsActive;

    public async Task<SettingDto> ApplyAsync(string id, string value, CancellationToken cancellationToken = default)
    {
        var setting = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Settings.Setting), id);

        // Code-review patch (2026-08-16): applies to every KeyType, not just Font -- without this,
        // a null/empty/over-length Value for a future non-Font KeyType would go straight into the
        // raw parameterized UPDATE with no EF-level validation behind it (ApplyValueAsync bypasses
        // SaveChangesAsync entirely), risking a raw Postgres error leaking through the generic-
        // exception 500 path. 256 matches Setting.Value's configured HasMaxLength.
        if (string.IsNullOrEmpty(value) || value.Length > 256)
            throw new ValidationException("Value must be non-empty and at most 256 characters.");

        // FR-10/AD-25: runs on every Apply unconditionally, including reactivation -- no branch
        // skips this check for a "just re-applying the same Value" call.
        if (setting.KeyType == "Font")
        {
            var pairing = await fontPairingDefinitionRepository.GetBySlugAsync(value, cancellationToken);
            if (!IsCuratedAndActive(pairing))
                throw new ValidationException($"'{value}' is not a currently curated font pairing.");
        }
        else if (setting.KeyType == "FontSize")
        {
            var size = await fontSizeDefinitionRepository.GetBySlugAsync(value, cancellationToken);
            if (!IsCuratedAndActive(size))
                throw new ValidationException($"'{value}' is not a currently curated font size scale.");
        }

        string oldValue = null!;
        var updatedAt = default(DateTimeOffset);

        await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            (oldValue, updatedAt) = await repository.ApplyValueAsync(id, value, currentUserService.UserId, cancellationToken);

            historyRepository.Add(new SettingChangeHistory
            {
                Id = idGenerator.NewId(),
                SettingId = id,
                Key = setting.Key,
                KeyType = setting.KeyType,
                OldValue = oldValue,
                NewValue = value,
            });

            await unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

        return new SettingDto(id, setting.Key, value, setting.KeyType, true, setting.CreatedAt, setting.CreatedBy, updatedAt, currentUserService.UserId);
    }

    public async Task<IReadOnlyList<SettingChangeHistoryDto>> GetHistoryAsync(string settingId, CancellationToken cancellationToken = default)
    {
        var history = await historyRepository.GetBySettingIdAsync(settingId, cancellationToken);
        return history.Select(h => h.ToDto()).ToList();
    }

    // Story 6.5: beyond GetFontPairingsAsync/GetFontSizesAsync's baseline (IsActive combos only),
    // also excludes a combo whose FontPairingSlug/FontSizeSlug no longer resolves to an active
    // definition -- the admin-facing list should never show a preset that's guaranteed to fail
    // if applied (ApplyTypographyCombinationAsync re-validates the same thing at Apply-time
    // regardless, this is purely a UX improvement over pushing that discovery to a rejection).
    public async Task<IReadOnlyList<TypographyCombinationDefinitionDto>> GetTypographyCombinationsAsync(CancellationToken cancellationToken = default)
    {
        var combos = await typographyCombinationDefinitionRepository.GetAllAsync(cancellationToken);
        var pairings = await fontPairingDefinitionRepository.GetAllAsync(cancellationToken);
        var sizes = await fontSizeDefinitionRepository.GetAllAsync(cancellationToken);

        var activePairingSlugs = pairings.Where(p => p.IsActive).Select(p => p.Slug).ToHashSet();
        var activeSizeSlugs = sizes.Where(s => s.IsActive).Select(s => s.Slug).ToHashSet();

        return combos
            .Where(c => c.IsActive && activePairingSlugs.Contains(c.FontPairingSlug) && activeSizeSlugs.Contains(c.FontSizeSlug))
            .Select(c => c.ToDto())
            .ToList();
    }

    // Story 6.5: the one genuinely new mechanism this story adds -- atomically applies a curated
    // Typography Combination's Font Pairing AND Font Size together. Additive, not a refactor:
    // ApplyAsync above remains completely untouched and is still the exclusive single-Setting
    // mutation path (Custom mode still calls it directly, once per Setting). Both underlying
    // writes happen inside ONE transaction so a mid-sequence failure (network drop, DB error on
    // the second write) rolls back everything already staged -- never a partial-preset state
    // where one Setting updated and the other didn't.
    public async Task<TypographyApplyResultDto> ApplyTypographyCombinationAsync(string comboSlug, CancellationToken cancellationToken = default)
    {
        var combo = await typographyCombinationDefinitionRepository.GetBySlugAsync(comboSlug, cancellationToken);
        if (!IsCuratedAndActive(combo))
            throw new ValidationException($"'{comboSlug}' is not a currently curated typography combination.");

        return await ApplyFontAndSizeAsync(combo.FontPairingSlug, combo.FontSizeSlug, cancellationToken);
    }

    // The Admin -> Settings screen's Advanced composer: a font pairing and a size scale chosen
    // independently and saved together. Deliberately routed through the SAME atomic dual-write as
    // ApplyTypographyCombinationAsync rather than letting the client make two ApplyAsync calls --
    // two sequential single-Setting requests can fail between them, leaving the exact
    // half-applied state (new font, old size) the combination path already exists to prevent.
    // The pair need not correspond to any curated combination; both halves are independently
    // curated values, which is what the validation below actually requires.
    public Task<TypographyApplyResultDto> ApplyTypographyAsync(string fontPairingSlug, string fontSizeSlug, CancellationToken cancellationToken = default) =>
        ApplyFontAndSizeAsync(fontPairingSlug, fontSizeSlug, cancellationToken);

    // Shared by both apply-both paths above. Validates each half is still curated, then writes both
    // Settings plus both history rows inside ONE transaction so a mid-sequence failure (network
    // drop, DB error on the second write) rolls back everything already staged -- never a partial
    // state where one Setting updated and the other didn't.
    private async Task<TypographyApplyResultDto> ApplyFontAndSizeAsync(string fontPairingSlug, string fontSizeSlug, CancellationToken cancellationToken)
    {
        // Re-validated on every call, not trusted from the caller -- a combo could reference a
        // pairing/size that's since been independently decurated, and a custom pair comes straight
        // off the wire. Same "check before the transaction opens" shape ApplyAsync already uses.
        var pairing = await fontPairingDefinitionRepository.GetBySlugAsync(fontPairingSlug, cancellationToken);
        if (!IsCuratedAndActive(pairing))
            throw new ValidationException($"'{fontPairingSlug}' is not a currently curated font pairing.");
        var size = await fontSizeDefinitionRepository.GetBySlugAsync(fontSizeSlug, cancellationToken);
        if (!IsCuratedAndActive(size))
            throw new ValidationException($"'{fontSizeSlug}' is not a currently curated font size scale.");

        var settings = await repository.GetAllAsync(cancellationToken);
        var fontSetting = settings.FirstOrDefault(s => s.Key == "font.pairing" && s.KeyType == "Font")
            ?? throw new NotFoundException(nameof(Domain.Settings.Setting), "font.pairing");
        var sizeSetting = settings.FirstOrDefault(s => s.Key == "font.size" && s.KeyType == "FontSize")
            ?? throw new NotFoundException(nameof(Domain.Settings.Setting), "font.size");

        string fontOldValue = null!, sizeOldValue = null!;
        var fontUpdatedAt = default(DateTimeOffset);
        var sizeUpdatedAt = default(DateTimeOffset);

        await unitOfWork.ExecuteInTransactionAsync(async () =>
        {
            (fontOldValue, fontUpdatedAt) = await repository.ApplyValueAsync(fontSetting.Id, fontPairingSlug, currentUserService.UserId, cancellationToken);
            historyRepository.Add(new SettingChangeHistory
            {
                Id = idGenerator.NewId(),
                SettingId = fontSetting.Id,
                Key = fontSetting.Key,
                KeyType = fontSetting.KeyType,
                OldValue = fontOldValue,
                NewValue = fontPairingSlug,
            });

            (sizeOldValue, sizeUpdatedAt) = await repository.ApplyValueAsync(sizeSetting.Id, fontSizeSlug, currentUserService.UserId, cancellationToken);
            historyRepository.Add(new SettingChangeHistory
            {
                Id = idGenerator.NewId(),
                SettingId = sizeSetting.Id,
                Key = sizeSetting.Key,
                KeyType = sizeSetting.KeyType,
                OldValue = sizeOldValue,
                NewValue = fontSizeSlug,
            });

            await unitOfWork.SaveChangesAsync(cancellationToken);
        }, cancellationToken);

        // Built from the pre-transaction fontSetting/sizeSetting entities plus the transaction's
        // fresh Value/UpdatedAt, not re-queried from the committed rows -- same deliberate pattern
        // ApplyAsync above already uses (its own comment explains why: the raw-SQL write bypasses
        // EF's ChangeTracker, so the pre-write tracked entity's Value/UpdatedAt are stale but its
        // Key/KeyType/CreatedAt/CreatedBy are still valid, since those never change during an Apply).
        var fontDto = new SettingDto(fontSetting.Id, fontSetting.Key, fontPairingSlug, fontSetting.KeyType, true, fontSetting.CreatedAt, fontSetting.CreatedBy, fontUpdatedAt, currentUserService.UserId);
        var sizeDto = new SettingDto(sizeSetting.Id, sizeSetting.Key, fontSizeSlug, sizeSetting.KeyType, true, sizeSetting.CreatedAt, sizeSetting.CreatedBy, sizeUpdatedAt, currentUserService.UserId);
        return new TypographyApplyResultDto(fontDto, sizeDto);
    }
}

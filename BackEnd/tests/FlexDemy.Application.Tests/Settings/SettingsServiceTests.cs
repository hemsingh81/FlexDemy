using FlexDemy.Application.Common;
using FlexDemy.Application.Settings;
using FlexDemy.Domain.Settings;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.Settings;

public class SettingsServiceTests
{
    private static Setting MakeSetting(string key = "font.pairing", string keyType = "Font", string value = "warm-editorial", bool isActive = true) => new()
    {
        Id = $"setting_{key}_{keyType}",
        Key = key,
        Value = value,
        KeyType = keyType,
        IsActive = isActive,
    };

    private static FontPairingDefinition MakePairing(string slug = "default", bool isActive = true) => new()
    {
        Id = $"fpd_{slug}",
        Slug = slug,
        DisplayFont = "\"Fraunces\", Georgia, serif",
        BodyFont = "\"Outfit\", system-ui, sans-serif",
        MonoFont = "\"JetBrains Mono\", monospace",
        IsActive = isActive,
    };

    private static FontSizeDefinition MakeSize(string slug = "default", string rootFontScale = "100%", bool isActive = true) => new()
    {
        Id = $"fsd_{slug}",
        Slug = slug,
        RootFontScale = rootFontScale,
        IsActive = isActive,
    };

    private static TypographyCombinationDefinition MakeCombo(string slug = "default", string fontPairingSlug = "default", string fontSizeSlug = "default", bool isActive = true) => new()
    {
        Id = $"tcd_{slug}",
        Slug = slug,
        Label = slug,
        FontPairingSlug = fontPairingSlug,
        FontSizeSlug = fontSizeSlug,
        IsActive = isActive,
    };

    private static SettingsService CreateSut(
        ISettingRepository? repository = null,
        IFontPairingDefinitionRepository? fontPairingDefinitionRepository = null,
        IFontSizeDefinitionRepository? fontSizeDefinitionRepository = null,
        ITypographyCombinationDefinitionRepository? typographyCombinationDefinitionRepository = null,
        ISettingChangeHistoryRepository? historyRepository = null,
        ICurrentUserService? currentUserService = null,
        IIdGenerator? idGenerator = null,
        IUnitOfWork? unitOfWork = null)
    {
        // Only give a freshly-created substitute a default ApplyValueAsync return -- if the caller
        // passed its own repository, it's already configured that call the way its test needs
        // (or deliberately left it unconfigured because the curation check throws first). Wiring a
        // wildcard default here too would win over a caller's more specific config, since
        // NSubstitute matches the most-recently-configured matching setup, not the most specific.
        if (repository is null)
        {
            repository = Substitute.For<ISettingRepository>();
            repository.ApplyValueAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string?>(), Arg.Any<CancellationToken>())
                .Returns(("old-value", DateTimeOffset.UtcNow));
        }

        unitOfWork ??= Substitute.For<IUnitOfWork>();
        // Unconfigured, NSubstitute would return a completed Task WITHOUT ever invoking the
        // passed-in operation -- ApplyAsync's real work (ApplyValueAsync + history Add) happens
        // inside that callback, so this must actually run it for the tests below to exercise
        // anything at all. Same established pattern as VersionServiceTests.
        unitOfWork.ExecuteInTransactionAsync(Arg.Any<Func<Task>>(), Arg.Any<CancellationToken>())
            .Returns(async callInfo => await callInfo.Arg<Func<Task>>()());

        return new(
            repository,
            fontPairingDefinitionRepository ?? Substitute.For<IFontPairingDefinitionRepository>(),
            fontSizeDefinitionRepository ?? Substitute.For<IFontSizeDefinitionRepository>(),
            // Story 6.5: yet another SettingsService constructor dependency -- same NSubstitute
            // most-recently-configured-wins gotcha Stories 6.3/6.4 already hit in this exact
            // helper applies again here, nothing new.
            typographyCombinationDefinitionRepository ?? Substitute.For<ITypographyCombinationDefinitionRepository>(),
            historyRepository ?? Substitute.For<ISettingChangeHistoryRepository>(),
            currentUserService ?? Substitute.For<ICurrentUserService>(),
            idGenerator ?? Substitute.For<IIdGenerator>(),
            unitOfWork,
            // Code-review patch (2026-08-16): SettingsService now takes an ILogger<SettingsService>
            // (GetEffectiveFontsAsync logs a genuine resolution failure instead of swallowing it
            // silently) -- a plain substitute is enough here, no test asserts on log calls.
            Substitute.For<ILogger<SettingsService>>());
    }

    [Fact]
    public async Task GetAllAsync_returns_mapped_dtos_for_every_row()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeSetting("font.pairing", "Font"), MakeSetting("logo.url", "Branding")]);
        var sut = CreateSut(repository);

        var result = await sut.GetAllAsync();

        Assert.Equal(2, result.Count);
        Assert.Contains(result, dto => dto.Key == "font.pairing" && dto.KeyType == "Font");
        Assert.Contains(result, dto => dto.Key == "logo.url" && dto.KeyType == "Branding");
    }

    [Fact]
    public async Task GetEffectiveValueAsync_returns_the_stored_Value_when_an_active_Setting_matches()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeSetting(value: "warm-editorial", isActive: true)]);
        var sut = CreateSut(repository);

        var result = await sut.GetEffectiveValueAsync("font.pairing", "Font");

        Assert.Equal("warm-editorial", result);
    }

    [Fact]
    public async Task GetEffectiveValueAsync_reverts_to_the_hardcoded_default_when_the_matching_Setting_IsActive_is_false()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeSetting(value: "warm-editorial", isActive: false)]);
        var sut = CreateSut(repository);

        var result = await sut.GetEffectiveValueAsync("font.pairing", "Font");

        Assert.Equal("default", result);
    }

    [Fact]
    public async Task GetEffectiveValueAsync_reverts_to_the_hardcoded_default_when_no_Setting_exists_for_the_pair()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        var sut = CreateSut(repository);

        var result = await sut.GetEffectiveValueAsync("font.pairing", "Font");

        Assert.Equal("default", result);
    }

    [Fact]
    public async Task GetFontPairingsAsync_returns_only_IsActive_rows()
    {
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakePairing("default", isActive: true), MakePairing("retired", isActive: false)]);
        var sut = CreateSut(fontPairingDefinitionRepository: fontPairingDefinitionRepository);

        var result = await sut.GetFontPairingsAsync();

        var dto = Assert.Single(result);
        Assert.Equal("default", dto.Slug);
    }

    [Fact]
    public async Task GetEffectiveFontsAsync_resolves_the_active_Font_settings_curated_pairing()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeSetting(value: "editorial", isActive: true)]);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("editorial", Arg.Any<CancellationToken>())
            .Returns(new FontPairingDefinition { Id = "fpd_editorial", Slug = "editorial", DisplayFont = "\"Merriweather\", serif", BodyFont = "\"Lato\", sans-serif", MonoFont = "\"Fira Code\", monospace", IsActive = true });
        var sut = CreateSut(repository, fontPairingDefinitionRepository);

        var result = await sut.GetEffectiveFontsAsync();

        Assert.Equal("\"Merriweather\", serif", result.DisplayFont);
        Assert.Equal("\"Lato\", sans-serif", result.BodyFont);
        Assert.Equal("\"Fira Code\", monospace", result.MonoFont);
    }

    [Fact]
    public async Task GetEffectiveFontsAsync_falls_back_to_hardcoded_literals_when_no_active_Setting_exists()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        var sut = CreateSut(repository);

        var result = await sut.GetEffectiveFontsAsync();

        Assert.Equal("\"Fraunces\", Georgia, serif", result.DisplayFont);
        Assert.Equal("\"Outfit\", system-ui, sans-serif", result.BodyFont);
        Assert.Equal("\"JetBrains Mono\", monospace", result.MonoFont);
    }

    [Fact]
    public async Task GetEffectiveFontsAsync_falls_back_to_hardcoded_literals_when_the_resolved_slug_has_no_matching_pairing()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeSetting(value: "vanished", isActive: true)]);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("vanished", Arg.Any<CancellationToken>()).Returns((FontPairingDefinition?)null);
        var sut = CreateSut(repository, fontPairingDefinitionRepository);

        var result = await sut.GetEffectiveFontsAsync();

        Assert.Equal("\"Fraunces\", Georgia, serif", result.DisplayFont);
    }

    [Fact]
    public async Task GetFontSizesAsync_returns_only_active_rows()
    {
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        fontSizeDefinitionRepository.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakeSize("default", isActive: true), MakeSize("retired", isActive: false)]);
        var sut = CreateSut(fontSizeDefinitionRepository: fontSizeDefinitionRepository);

        var result = await sut.GetFontSizesAsync();

        var dto = Assert.Single(result);
        Assert.Equal("default", dto.Slug);
    }

    [Fact]
    public async Task GetEffectiveFontsAsync_resolves_the_active_FontSize_settings_curated_scale()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakeSetting(key: "font.size", keyType: "FontSize", value: "comfortable", isActive: true)]);
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        fontSizeDefinitionRepository.GetBySlugAsync("comfortable", Arg.Any<CancellationToken>())
            .Returns(MakeSize("comfortable", rootFontScale: "112%"));
        var sut = CreateSut(repository, fontSizeDefinitionRepository: fontSizeDefinitionRepository);

        var result = await sut.GetEffectiveFontsAsync();

        Assert.Equal("112%", result.RootFontScale);
    }

    [Fact]
    public async Task GetEffectiveFontsAsync_falls_back_to_the_hardcoded_RootFontScale_when_no_active_FontSize_Setting_exists()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([]);
        var sut = CreateSut(repository);

        var result = await sut.GetEffectiveFontsAsync();

        Assert.Equal("100%", result.RootFontScale);
    }

    [Fact]
    public async Task GetEffectiveFontsAsync_falls_back_to_hardcoded_defaults_when_the_resolved_FontPairingDefinition_is_decurated()
    {
        // Code-review patch (2026-08-16): GetFontPairingsAsync/ApplyAsync's curation check both
        // already exclude/reject a decurated (IsActive=false) row -- GetEffectiveFontsAsync had
        // been missing the same check, so a decurated-but-not-deleted row would still be served
        // to every visitor. Proves the fix: a match that resolves but is IsActive=false falls back.
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakeSetting(key: "font.pairing", keyType: "Font", value: "retired", isActive: true)]);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("retired", Arg.Any<CancellationToken>()).Returns(MakePairing("retired", isActive: false));
        var sut = CreateSut(repository, fontPairingDefinitionRepository);

        var result = await sut.GetEffectiveFontsAsync();

        Assert.Equal("\"Fraunces\", Georgia, serif", result.DisplayFont);
    }

    [Fact]
    public async Task GetEffectiveFontsAsync_falls_back_to_the_hardcoded_RootFontScale_when_the_resolved_FontSizeDefinition_is_decurated()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakeSetting(key: "font.size", keyType: "FontSize", value: "retired", isActive: true)]);
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        fontSizeDefinitionRepository.GetBySlugAsync("retired", Arg.Any<CancellationToken>()).Returns(MakeSize("retired", isActive: false));
        var sut = CreateSut(fontSizeDefinitionRepository: fontSizeDefinitionRepository);

        var result = await sut.GetEffectiveFontsAsync();

        Assert.Equal("100%", result.RootFontScale);
    }

    [Fact]
    public async Task GetEffectiveFontsAsync_a_font_pairing_resolution_failure_does_not_suppress_a_successful_font_size_resolution()
    {
        // Font Pairing resolution fails (no Setting rows at all -- GetEffectiveValueAsync falls
        // through to its own hardcoded default, "default", which then fails to resolve against an
        // empty FontPairingDefinition repository too), while Font Size resolution succeeds. Proves
        // the two try/catch blocks in GetEffectiveFontsAsync are genuinely independent (AC #3).
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakeSetting(key: "font.size", keyType: "FontSize", value: "comfortable", isActive: true)]);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("default", Arg.Any<CancellationToken>()).Returns((FontPairingDefinition?)null);
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        fontSizeDefinitionRepository.GetBySlugAsync("comfortable", Arg.Any<CancellationToken>())
            .Returns(MakeSize("comfortable", rootFontScale: "112%"));
        var sut = CreateSut(repository, fontPairingDefinitionRepository, fontSizeDefinitionRepository);

        var result = await sut.GetEffectiveFontsAsync();

        Assert.Equal("\"Fraunces\", Georgia, serif", result.DisplayFont); // fell back
        Assert.Equal("112%", result.RootFontScale); // still resolved
    }

    [Fact]
    public async Task GetEffectiveFontsAsync_a_font_size_resolution_failure_does_not_suppress_a_successful_font_pairing_resolution()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakeSetting(key: "font.pairing", keyType: "Font", value: "editorial", isActive: true)]);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("editorial", Arg.Any<CancellationToken>()).Returns(MakePairing("editorial"));
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        fontSizeDefinitionRepository.GetBySlugAsync("default", Arg.Any<CancellationToken>()).Returns((FontSizeDefinition?)null);
        var sut = CreateSut(repository, fontPairingDefinitionRepository, fontSizeDefinitionRepository);

        var result = await sut.GetEffectiveFontsAsync();

        Assert.Equal("\"Fraunces\", Georgia, serif", result.DisplayFont); // still resolved
        Assert.Equal("100%", result.RootFontScale); // fell back
    }

    [Fact]
    public async Task GetEffectiveFontsAsync_resolves_both_font_pairing_and_font_size_when_both_succeed_simultaneously()
    {
        // The test that actually proves GetEffectiveFontsAsync's early-return trap was avoided --
        // a naive implementation that returns immediately inside the font-pairing try block would
        // pass every other test above (each forces one half to fail) but silently never resolve
        // Font Size here, since font-pairing resolution succeeds first.
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([
            MakeSetting(key: "font.pairing", keyType: "Font", value: "editorial", isActive: true),
            MakeSetting(key: "font.size", keyType: "FontSize", value: "comfortable", isActive: true),
        ]);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("editorial", Arg.Any<CancellationToken>()).Returns(MakePairing("editorial"));
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        fontSizeDefinitionRepository.GetBySlugAsync("comfortable", Arg.Any<CancellationToken>())
            .Returns(MakeSize("comfortable", rootFontScale: "112%"));
        var sut = CreateSut(repository, fontPairingDefinitionRepository, fontSizeDefinitionRepository);

        var result = await sut.GetEffectiveFontsAsync();

        Assert.Equal("112%", result.RootFontScale);
        await fontPairingDefinitionRepository.Received(1).GetBySlugAsync("editorial", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ApplyAsync_FontSize_happy_path_updates_Value_and_sets_IsActive_true()
    {
        var setting = MakeSetting(key: "font.size", keyType: "FontSize", isActive: false);
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(setting.Id, Arg.Any<CancellationToken>()).Returns(setting);
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        fontSizeDefinitionRepository.GetBySlugAsync("comfortable", Arg.Any<CancellationToken>()).Returns(MakeSize("comfortable"));
        var sut = CreateSut(repository, fontSizeDefinitionRepository: fontSizeDefinitionRepository);

        var result = await sut.ApplyAsync(setting.Id, "comfortable");

        Assert.Equal("comfortable", result.Value);
        Assert.True(result.IsActive);
    }

    [Fact]
    public async Task ApplyAsync_rejects_a_non_curated_FontSize_slug()
    {
        var setting = MakeSetting(key: "font.size", keyType: "FontSize");
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(setting.Id, Arg.Any<CancellationToken>()).Returns(setting);
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        fontSizeDefinitionRepository.GetBySlugAsync("made-up", Arg.Any<CancellationToken>()).Returns((FontSizeDefinition?)null);
        var sut = CreateSut(repository, fontSizeDefinitionRepository: fontSizeDefinitionRepository);

        await Assert.ThrowsAsync<ValidationException>(() => sut.ApplyAsync(setting.Id, "made-up"));
    }

    [Fact]
    public async Task ApplyAsync_rejects_a_slug_belonging_to_a_decurated_FontSize_scale()
    {
        var setting = MakeSetting(key: "font.size", keyType: "FontSize");
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(setting.Id, Arg.Any<CancellationToken>()).Returns(setting);
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        fontSizeDefinitionRepository.GetBySlugAsync("retired", Arg.Any<CancellationToken>()).Returns(MakeSize("retired", isActive: false));
        var sut = CreateSut(repository, fontSizeDefinitionRepository: fontSizeDefinitionRepository);

        await Assert.ThrowsAsync<ValidationException>(() => sut.ApplyAsync(setting.Id, "retired"));
    }

    [Fact]
    public async Task ApplyAsync_Font_and_FontSize_Settings_are_completely_independent()
    {
        // AC #3: applying a Font Setting must never touch FontSize curation, and vice versa --
        // a real orchestration test, not just an assertion by code inspection.
        var fontSetting = MakeSetting(key: "font.pairing", keyType: "Font", isActive: false);
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(fontSetting.Id, Arg.Any<CancellationToken>()).Returns(fontSetting);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("editorial", Arg.Any<CancellationToken>()).Returns(MakePairing("editorial"));
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        var sut = CreateSut(repository, fontPairingDefinitionRepository, fontSizeDefinitionRepository);

        var result = await sut.ApplyAsync(fontSetting.Id, "editorial");

        Assert.Equal("editorial", result.Value);
        await fontSizeDefinitionRepository.DidNotReceive().GetBySlugAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ApplyAsync_FontSize_Settings_are_completely_independent_of_Font_Pairing_curation()
    {
        // Code-review patch (2026-08-16): the reciprocal half of the test above -- Task 4 requires
        // both directions ("vice versa"), and only Font-touches-FontSize was originally covered.
        var sizeSetting = MakeSetting(key: "font.size", keyType: "FontSize", isActive: false);
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(sizeSetting.Id, Arg.Any<CancellationToken>()).Returns(sizeSetting);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        fontSizeDefinitionRepository.GetBySlugAsync("comfortable", Arg.Any<CancellationToken>()).Returns(MakeSize("comfortable"));
        var sut = CreateSut(repository, fontPairingDefinitionRepository, fontSizeDefinitionRepository);

        var result = await sut.ApplyAsync(sizeSetting.Id, "comfortable");

        Assert.Equal("comfortable", result.Value);
        await fontPairingDefinitionRepository.DidNotReceive().GetBySlugAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("")]
    [InlineData(null)]
    public async Task ApplyAsync_rejects_a_null_or_empty_Value_for_any_KeyType(string? value)
    {
        var setting = MakeSetting(key: "logo.url", keyType: "Branding");
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(setting.Id, Arg.Any<CancellationToken>()).Returns(setting);
        var sut = CreateSut(repository);

        await Assert.ThrowsAsync<ValidationException>(() => sut.ApplyAsync(setting.Id, value!));
    }

    [Fact]
    public async Task ApplyAsync_rejects_a_Value_over_256_characters_for_any_KeyType()
    {
        var setting = MakeSetting(key: "logo.url", keyType: "Branding");
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(setting.Id, Arg.Any<CancellationToken>()).Returns(setting);
        var sut = CreateSut(repository);

        await Assert.ThrowsAsync<ValidationException>(() => sut.ApplyAsync(setting.Id, new string('x', 257)));
    }

    [Fact]
    public async Task ApplyAsync_happy_path_updates_Value_and_sets_IsActive_true()
    {
        var setting = MakeSetting(isActive: false);
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(setting.Id, Arg.Any<CancellationToken>()).Returns(setting);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("editorial", Arg.Any<CancellationToken>()).Returns(MakePairing("editorial"));
        var sut = CreateSut(repository, fontPairingDefinitionRepository);

        var result = await sut.ApplyAsync(setting.Id, "editorial");

        Assert.Equal("editorial", result.Value);
        Assert.True(result.IsActive);
    }

    [Fact]
    public async Task ApplyAsync_rejects_a_non_curated_slug()
    {
        var setting = MakeSetting();
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(setting.Id, Arg.Any<CancellationToken>()).Returns(setting);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("made-up", Arg.Any<CancellationToken>()).Returns((FontPairingDefinition?)null);
        var sut = CreateSut(repository, fontPairingDefinitionRepository);

        await Assert.ThrowsAsync<ValidationException>(() => sut.ApplyAsync(setting.Id, "made-up"));
    }

    [Fact]
    public async Task ApplyAsync_rejects_a_slug_belonging_to_a_decurated_pairing()
    {
        var setting = MakeSetting();
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(setting.Id, Arg.Any<CancellationToken>()).Returns(setting);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("retired", Arg.Any<CancellationToken>()).Returns(MakePairing("retired", isActive: false));
        var sut = CreateSut(repository, fontPairingDefinitionRepository);

        await Assert.ThrowsAsync<ValidationException>(() => sut.ApplyAsync(setting.Id, "retired"));
    }

    [Fact]
    public async Task ApplyAsync_on_a_missing_Setting_id_throws_NotFoundException()
    {
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Setting?)null);
        var sut = CreateSut(repository);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.ApplyAsync("missing", "default"));
    }

    [Fact]
    public async Task ApplyAsync_reactivating_a_Value_whose_pairing_was_since_decurated_is_rejected()
    {
        var setting = MakeSetting(value: "retired", isActive: false);
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(setting.Id, Arg.Any<CancellationToken>()).Returns(setting);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("retired", Arg.Any<CancellationToken>()).Returns(MakePairing("retired", isActive: false));
        var sut = CreateSut(repository, fontPairingDefinitionRepository);

        // Reactivation is just an Apply call with the Setting's existing (now-decurated) Value --
        // the curation check runs unconditionally and rejects it, same as any other Apply.
        await Assert.ThrowsAsync<ValidationException>(() => sut.ApplyAsync(setting.Id, "retired"));
    }

    [Fact]
    public async Task ApplyAsync_on_a_non_Font_KeyType_skips_the_curation_check()
    {
        var setting = MakeSetting(key: "logo.url", keyType: "Branding", value: "/old-logo.svg");
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(setting.Id, Arg.Any<CancellationToken>()).Returns(setting);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        var sut = CreateSut(repository, fontPairingDefinitionRepository);

        var result = await sut.ApplyAsync(setting.Id, "/new-logo.svg");

        Assert.Equal("/new-logo.svg", result.Value);
        await fontPairingDefinitionRepository.DidNotReceive().GetBySlugAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ApplyAsync_calls_ApplyValueAsync_with_the_id_value_and_current_user()
    {
        var setting = MakeSetting(isActive: false);
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(setting.Id, Arg.Any<CancellationToken>()).Returns(setting);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("editorial", Arg.Any<CancellationToken>()).Returns(MakePairing("editorial"));
        var currentUserService = Substitute.For<ICurrentUserService>();
        currentUserService.UserId.Returns("admin_1");
        var sut = CreateSut(repository, fontPairingDefinitionRepository, currentUserService: currentUserService);

        await sut.ApplyAsync(setting.Id, "editorial");

        await repository.Received(1).ApplyValueAsync(setting.Id, "editorial", "admin_1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ApplyAsync_stages_exactly_one_SettingChangeHistory_via_ExecuteInTransactionAsync()
    {
        var setting = MakeSetting(isActive: false);
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(setting.Id, Arg.Any<CancellationToken>()).Returns(setting);
        repository.ApplyValueAsync(setting.Id, "editorial", Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(("warm-editorial", DateTimeOffset.UtcNow));
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("editorial", Arg.Any<CancellationToken>()).Returns(MakePairing("editorial"));
        var historyRepository = Substitute.For<ISettingChangeHistoryRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var sut = CreateSut(repository, fontPairingDefinitionRepository, historyRepository: historyRepository, unitOfWork: unitOfWork);

        await sut.ApplyAsync(setting.Id, "editorial");

        historyRepository.Received(1).Add(Arg.Is<SettingChangeHistory>(h =>
            h.SettingId == setting.Id &&
            h.Key == setting.Key &&
            h.KeyType == setting.KeyType &&
            h.OldValue == "warm-editorial" &&
            h.NewValue == "editorial"));
        await unitOfWork.Received(1).ExecuteInTransactionAsync(Arg.Any<Func<Task>>(), Arg.Any<CancellationToken>());
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ApplyAsync_returns_a_SettingDto_whose_UpdatedAt_is_the_atomic_calls_returned_timestamp()
    {
        var setting = MakeSetting(isActive: false);
        var repository = Substitute.For<ISettingRepository>();
        repository.GetByIdAsync(setting.Id, Arg.Any<CancellationToken>()).Returns(setting);
        var freshTimestamp = DateTimeOffset.UtcNow;
        repository.ApplyValueAsync(setting.Id, "editorial", Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(("warm-editorial", freshTimestamp));
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("editorial", Arg.Any<CancellationToken>()).Returns(MakePairing("editorial"));
        var sut = CreateSut(repository, fontPairingDefinitionRepository);

        var result = await sut.ApplyAsync(setting.Id, "editorial");

        Assert.Equal(freshTimestamp, result.UpdatedAt);
        Assert.Equal("editorial", result.Value);
    }

    [Fact]
    public async Task GetHistoryAsync_maps_repository_results_to_dtos_with_ChangedAt_ChangedBy_from_CreatedAt_CreatedBy()
    {
        var entry = new SettingChangeHistory
        {
            Id = "history_1",
            SettingId = "setting_1",
            Key = "font.pairing",
            KeyType = "Font",
            OldValue = "default",
            NewValue = "editorial",
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = "admin_1",
        };
        var historyRepository = Substitute.For<ISettingChangeHistoryRepository>();
        historyRepository.GetBySettingIdAsync("setting_1", Arg.Any<CancellationToken>()).Returns([entry]);
        var sut = CreateSut(historyRepository: historyRepository);

        var result = await sut.GetHistoryAsync("setting_1");

        var dto = Assert.Single(result);
        Assert.Equal(entry.CreatedAt, dto.ChangedAt);
        Assert.Equal(entry.CreatedBy, dto.ChangedBy);
        Assert.Equal("default", dto.OldValue);
        Assert.Equal("editorial", dto.NewValue);
    }

    // -- Story 6.5: GetTypographyCombinationsAsync / ApplyTypographyCombinationAsync -----------

    [Fact]
    public async Task GetTypographyCombinationsAsync_returns_only_active_combos_whose_referenced_definitions_are_also_active()
    {
        var comboRepository = Substitute.For<ITypographyCombinationDefinitionRepository>();
        comboRepository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([
            MakeCombo("default", "default", "default"),
            MakeCombo("retired-combo", "default", "default", isActive: false),
            MakeCombo("dead-pairing-ref", "missing-pairing", "default"),
            MakeCombo("dead-size-ref", "default", "missing-size"),
        ]);
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakePairing("default")]);
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        fontSizeDefinitionRepository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([MakeSize("default")]);
        var sut = CreateSut(
            fontPairingDefinitionRepository: fontPairingDefinitionRepository,
            fontSizeDefinitionRepository: fontSizeDefinitionRepository,
            typographyCombinationDefinitionRepository: comboRepository);

        var result = await sut.GetTypographyCombinationsAsync();

        var dto = Assert.Single(result);
        Assert.Equal("default", dto.Slug);
    }

    [Fact]
    public async Task ApplyTypographyCombinationAsync_happy_path_updates_both_Settings_and_returns_both()
    {
        var fontSetting = MakeSetting(key: "font.pairing", keyType: "Font", value: "old-pairing");
        var sizeSetting = MakeSetting(key: "font.size", keyType: "FontSize", value: "old-size");
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([fontSetting, sizeSetting]);
        repository.ApplyValueAsync(fontSetting.Id, "default", Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(("old-pairing", DateTimeOffset.UtcNow));
        repository.ApplyValueAsync(sizeSetting.Id, "comfortable", Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(("old-size", DateTimeOffset.UtcNow));
        var comboRepository = Substitute.For<ITypographyCombinationDefinitionRepository>();
        comboRepository.GetBySlugAsync("comfortable", Arg.Any<CancellationToken>())
            .Returns(MakeCombo("comfortable", "default", "comfortable"));
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("default", Arg.Any<CancellationToken>()).Returns(MakePairing("default"));
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        fontSizeDefinitionRepository.GetBySlugAsync("comfortable", Arg.Any<CancellationToken>()).Returns(MakeSize("comfortable", "112%"));
        var sut = CreateSut(
            repository: repository,
            fontPairingDefinitionRepository: fontPairingDefinitionRepository,
            fontSizeDefinitionRepository: fontSizeDefinitionRepository,
            typographyCombinationDefinitionRepository: comboRepository);

        var result = await sut.ApplyTypographyCombinationAsync("comfortable");

        Assert.Equal("default", result.Font.Value);
        Assert.Equal("comfortable", result.FontSize.Value);
        Assert.True(result.Font.IsActive);
        Assert.True(result.FontSize.IsActive);
    }

    [Fact]
    public async Task ApplyTypographyCombinationAsync_rejects_an_unknown_combo_slug()
    {
        var comboRepository = Substitute.For<ITypographyCombinationDefinitionRepository>();
        comboRepository.GetBySlugAsync("nonexistent", Arg.Any<CancellationToken>()).Returns((TypographyCombinationDefinition?)null);
        var sut = CreateSut(typographyCombinationDefinitionRepository: comboRepository);

        await Assert.ThrowsAsync<ValidationException>(() => sut.ApplyTypographyCombinationAsync("nonexistent"));
    }

    [Fact]
    public async Task ApplyTypographyCombinationAsync_rejects_a_decurated_combo()
    {
        var comboRepository = Substitute.For<ITypographyCombinationDefinitionRepository>();
        comboRepository.GetBySlugAsync("retired", Arg.Any<CancellationToken>()).Returns(MakeCombo("retired", isActive: false));
        var sut = CreateSut(typographyCombinationDefinitionRepository: comboRepository);

        await Assert.ThrowsAsync<ValidationException>(() => sut.ApplyTypographyCombinationAsync("retired"));
    }

    [Fact]
    public async Task ApplyTypographyCombinationAsync_rejects_a_combo_whose_referenced_FontPairing_has_been_decurated()
    {
        var comboRepository = Substitute.For<ITypographyCombinationDefinitionRepository>();
        comboRepository.GetBySlugAsync("comfortable", Arg.Any<CancellationToken>())
            .Returns(MakeCombo("comfortable", "default", "comfortable"));
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("default", Arg.Any<CancellationToken>()).Returns(MakePairing("default", isActive: false));
        var sut = CreateSut(
            fontPairingDefinitionRepository: fontPairingDefinitionRepository,
            typographyCombinationDefinitionRepository: comboRepository);

        await Assert.ThrowsAsync<ValidationException>(() => sut.ApplyTypographyCombinationAsync("comfortable"));
    }

    [Fact]
    public async Task ApplyTypographyCombinationAsync_rejects_a_combo_whose_referenced_FontSize_has_been_decurated()
    {
        var comboRepository = Substitute.For<ITypographyCombinationDefinitionRepository>();
        comboRepository.GetBySlugAsync("comfortable", Arg.Any<CancellationToken>())
            .Returns(MakeCombo("comfortable", "default", "comfortable"));
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("default", Arg.Any<CancellationToken>()).Returns(MakePairing("default"));
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        fontSizeDefinitionRepository.GetBySlugAsync("comfortable", Arg.Any<CancellationToken>()).Returns(MakeSize("comfortable", isActive: false));
        var sut = CreateSut(
            fontPairingDefinitionRepository: fontPairingDefinitionRepository,
            fontSizeDefinitionRepository: fontSizeDefinitionRepository,
            typographyCombinationDefinitionRepository: comboRepository);

        await Assert.ThrowsAsync<ValidationException>(() => sut.ApplyTypographyCombinationAsync("comfortable"));
    }

    [Fact]
    public async Task ApplyTypographyCombinationAsync_is_atomic_nothing_commits_if_the_second_write_fails()
    {
        // Code-review patch (2026-08-16): this test's own name and an earlier version of its
        // comment overstated what a mocked-service-level test can actually prove. What this DOES
        // verify: forcing the second ApplyValueAsync call (for FontSize) to throw stops
        // orchestration immediately -- the FontSize history entry is never staged, and
        // SaveChangesAsync (which would only ever have committed the two staged history rows) is
        // never reached. What this does NOT and structurally CANNOT verify: whether the Font
        // row's raw-SQL UPDATE, already executed against the mocked repository before the
        // failure, is actually rolled back in a real database. That guarantee rests entirely on
        // IUnitOfWork.ExecuteInTransactionAsync's real transaction-rollback behavior -- verified
        // once by direct code reading (UnitOfWork.cs genuinely wraps the callback in
        // BeginTransactionAsync/Commit/Rollback), not by any test, since EF Core's InMemory
        // provider can't execute the raw SqlQuery<T> ApplyValueAsync depends on at all. See this
        // story's Review Findings / deferred-work.md for the standing gap (no
        // WebApplicationFactory/Testcontainers-based integration-test infrastructure exists in
        // this codebase to close it for real).
        var fontSetting = MakeSetting(key: "font.pairing", keyType: "Font", value: "old-pairing");
        var sizeSetting = MakeSetting(key: "font.size", keyType: "FontSize", value: "old-size");
        var repository = Substitute.For<ISettingRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([fontSetting, sizeSetting]);
        repository.ApplyValueAsync(fontSetting.Id, "default", Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(("old-pairing", DateTimeOffset.UtcNow));
        repository.ApplyValueAsync(sizeSetting.Id, "comfortable", Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns<(string OldValue, DateTimeOffset UpdatedAt)>(_ => throw new InvalidOperationException("simulated failure on the second write"));
        var comboRepository = Substitute.For<ITypographyCombinationDefinitionRepository>();
        comboRepository.GetBySlugAsync("comfortable", Arg.Any<CancellationToken>())
            .Returns(MakeCombo("comfortable", "default", "comfortable"));
        var fontPairingDefinitionRepository = Substitute.For<IFontPairingDefinitionRepository>();
        fontPairingDefinitionRepository.GetBySlugAsync("default", Arg.Any<CancellationToken>()).Returns(MakePairing("default"));
        var fontSizeDefinitionRepository = Substitute.For<IFontSizeDefinitionRepository>();
        fontSizeDefinitionRepository.GetBySlugAsync("comfortable", Arg.Any<CancellationToken>()).Returns(MakeSize("comfortable", "112%"));
        var historyRepository = Substitute.For<ISettingChangeHistoryRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        unitOfWork.ExecuteInTransactionAsync(Arg.Any<Func<Task>>(), Arg.Any<CancellationToken>())
            .Returns(async callInfo => await callInfo.Arg<Func<Task>>()());
        var sut = CreateSut(
            repository: repository,
            fontPairingDefinitionRepository: fontPairingDefinitionRepository,
            fontSizeDefinitionRepository: fontSizeDefinitionRepository,
            typographyCombinationDefinitionRepository: comboRepository,
            historyRepository: historyRepository,
            unitOfWork: unitOfWork);

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.ApplyTypographyCombinationAsync("comfortable"));

        historyRepository.Received(1).Add(Arg.Is<SettingChangeHistory>(h => h.SettingId == fontSetting.Id));
        // The second Add for FontSize is never reached -- ApplyValueAsync for the size row throws
        // before historyRepository.Add for it is called, so only the font-side stage happened.
        historyRepository.DidNotReceive().Add(Arg.Is<SettingChangeHistory>(h => h.SettingId == sizeSetting.Id));
        await unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

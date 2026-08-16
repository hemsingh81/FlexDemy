using FlexDemy.Api.Authorization;
using FlexDemy.Api.Controllers;
using FlexDemy.Application.Common;
using FlexDemy.Application.Permissions;
using FlexDemy.Application.Settings;
using FlexDemy.Domain.Settings;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Xunit;

namespace FlexDemy.Api.Tests.Controllers;

// [Authorize(Policy = FeatureKeys.SettingsManage)] is a class-level attribute enforced by ASP.NET
// Core's own AuthorizeFilter, so it can't be exercised by directly constructing/calling the
// controller the way the action-body tests below do -- see ErrorsControllerTests' identical note.
// This is the first Master+Support (not Master-only) class-level policy gate in the codebase, so
// it needs its own coverage rather than assuming it behaves like ErrorsManage/AiConfigManage.
public class SettingsControllerTests
{
    private static SettingDto MakeDto(string key = "font.pairing", string keyType = "Font") => new(
        $"setting_{key}", key, "warm-editorial", keyType, true, DateTimeOffset.UtcNow, null, null, null);

    private static SettingChangeHistoryDto MakeHistoryDto(string id = "history_1", string settingId = "setting_font.pairing") => new(
        id, settingId, "font.pairing", "Font", "default", "editorial", DateTimeOffset.UtcNow, "admin_1");

    [Fact]
    public async Task GetAllSettings_returns_the_service_result_wrapped_in_200()
    {
        var settingsService = Substitute.For<ISettingsService>();
        var settings = new List<SettingDto> { MakeDto() };
        settingsService.GetAllAsync(Arg.Any<CancellationToken>()).Returns(settings);
        var controller = new SettingsController(settingsService);

        var result = await controller.GetAllSettings(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(settings, ok.Value);
    }

    [Fact]
    public async Task GetFontPairings_returns_the_service_result_wrapped_in_200()
    {
        var settingsService = Substitute.For<ISettingsService>();
        var pairings = new List<FontPairingDefinitionDto> { new("default", "\"Fraunces\", Georgia, serif", "\"Outfit\", system-ui, sans-serif", "\"JetBrains Mono\", monospace", true) };
        settingsService.GetFontPairingsAsync(Arg.Any<CancellationToken>()).Returns(pairings);
        var controller = new SettingsController(settingsService);

        var result = await controller.GetFontPairings(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(pairings, ok.Value);
    }

    [Fact]
    public async Task GetFontSizes_returns_the_service_result_wrapped_in_200()
    {
        var settingsService = Substitute.For<ISettingsService>();
        var sizes = new List<FontSizeDefinitionDto> { new("default", "100%", true) };
        settingsService.GetFontSizesAsync(Arg.Any<CancellationToken>()).Returns(sizes);
        var controller = new SettingsController(settingsService);

        var result = await controller.GetFontSizes(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(sizes, ok.Value);
    }

    [Fact]
    public async Task ApplySetting_returns_200_with_the_updated_DTO_on_success()
    {
        var settingsService = Substitute.For<ISettingsService>();
        var updated = MakeDto();
        settingsService.ApplyAsync("setting_font.pairing", "editorial", Arg.Any<CancellationToken>()).Returns(updated);
        var controller = new SettingsController(settingsService);

        var result = await controller.ApplySetting("setting_font.pairing", new ApplySettingRequest("editorial"), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(updated, ok.Value);
    }

    [Fact]
    public async Task ApplySetting_propagates_ValidationException_from_the_service()
    {
        var settingsService = Substitute.For<ISettingsService>();
        settingsService.ApplyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns<SettingDto>(_ => throw new ValidationException("'made-up' is not a currently curated font pairing."));
        var controller = new SettingsController(settingsService);

        await Assert.ThrowsAsync<ValidationException>(() => controller.ApplySetting("setting_font.pairing", new ApplySettingRequest("made-up"), CancellationToken.None));
    }

    [Fact]
    public async Task ApplySetting_propagates_NotFoundException_from_the_service()
    {
        var settingsService = Substitute.For<ISettingsService>();
        settingsService.ApplyAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns<SettingDto>(_ => throw new NotFoundException(nameof(Setting), "missing"));
        var controller = new SettingsController(settingsService);

        await Assert.ThrowsAsync<NotFoundException>(() => controller.ApplySetting("missing", new ApplySettingRequest("default"), CancellationToken.None));
    }

    [Fact]
    public async Task GetEffectiveFonts_returns_the_service_result_wrapped_in_200()
    {
        var settingsService = Substitute.For<ISettingsService>();
        var fonts = new EffectiveFontsDto("\"Fraunces\", Georgia, serif", "\"Outfit\", system-ui, sans-serif", "\"JetBrains Mono\", monospace", "100%");
        settingsService.GetEffectiveFontsAsync(Arg.Any<CancellationToken>()).Returns(fonts);
        var controller = new SettingsController(settingsService);

        var result = await controller.GetEffectiveFonts(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(fonts, ok.Value);
    }

    // Code-review patch (2026-08-16): this is the test that would have caught the original bug.
    // SettingsController carries a class-level [Authorize(SettingsManage)] -- the fix relies on
    // [AllowAnonymous] on ONE action to override it, per ASP.NET Core's real authorization-filter
    // behavior. No WebApplicationFactory/TestServer integration-test infrastructure exists
    // anywhere in this codebase yet (a pre-existing, already-tracked gap -- see Story 4.1's
    // deferred-work entry), so this asserts directly on the actual attribute metadata ASP.NET
    // Core's AuthorizeFilter reads at runtime: the controller class still carries [Authorize], but
    // GetEffectiveFonts specifically also carries [AllowAnonymous] and no redundant [Authorize] of
    // its own. This is a genuine, precise proof that the endpoint is reachable with zero auth --
    // not a mocked-service test that would pass even if the attribute were missing entirely.
    [Fact]
    public void SettingsController_carries_a_class_level_Authorize_attribute()
    {
        var attribute = typeof(SettingsController).GetCustomAttributes(typeof(AuthorizeAttribute), inherit: false)
            .Cast<AuthorizeAttribute>()
            .SingleOrDefault();

        Assert.NotNull(attribute);
        Assert.Equal(FeatureKeys.SettingsManage, attribute!.Policy);
    }

    [Fact]
    public void GetEffectiveFonts_action_carries_AllowAnonymous_overriding_the_class_level_Authorize()
    {
        var method = typeof(SettingsController).GetMethod(nameof(SettingsController.GetEffectiveFonts));

        Assert.NotNull(method);
        var allowAnonymous = method!.GetCustomAttributes(typeof(AllowAnonymousAttribute), inherit: false);
        var redundantAuthorize = method.GetCustomAttributes(typeof(AuthorizeAttribute), inherit: false);

        Assert.Single(allowAnonymous);
        Assert.Empty(redundantAuthorize);
    }

    [Theory]
    [InlineData(nameof(SettingsController.GetAllSettings))]
    [InlineData(nameof(SettingsController.GetFontPairings))]
    [InlineData(nameof(SettingsController.GetFontSizes))]
    [InlineData(nameof(SettingsController.ApplySetting))]
    [InlineData(nameof(SettingsController.GetSettingHistory))]
    [InlineData(nameof(SettingsController.GetTypographyCombinations))]
    [InlineData(nameof(SettingsController.ApplyTypographyCombination))]
    public void Every_other_action_does_NOT_carry_AllowAnonymous(string methodName)
    {
        var method = typeof(SettingsController).GetMethods().First(m => m.Name == methodName);

        Assert.Empty(method.GetCustomAttributes(typeof(AllowAnonymousAttribute), inherit: false));
    }

    [Fact]
    public async Task GetSettingHistory_returns_the_service_result_wrapped_in_200()
    {
        var settingsService = Substitute.For<ISettingsService>();
        var history = new List<SettingChangeHistoryDto> { MakeHistoryDto() };
        settingsService.GetHistoryAsync("setting_font.pairing", Arg.Any<CancellationToken>()).Returns(history);
        var controller = new SettingsController(settingsService);

        var result = await controller.GetSettingHistory("setting_font.pairing", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(history, ok.Value);
    }

    private static TypographyCombinationDefinitionDto MakeComboDto(string slug = "comfortable") => new(
        slug, "Comfortable Reading", "default", "comfortable", true);

    [Fact]
    public async Task GetTypographyCombinations_returns_the_service_result_wrapped_in_200()
    {
        var settingsService = Substitute.For<ISettingsService>();
        var combinations = new List<TypographyCombinationDefinitionDto> { MakeComboDto() };
        settingsService.GetTypographyCombinationsAsync(Arg.Any<CancellationToken>()).Returns(combinations);
        var controller = new SettingsController(settingsService);

        var result = await controller.GetTypographyCombinations(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(combinations, ok.Value);
    }

    [Fact]
    public async Task ApplyTypographyCombination_returns_200_with_the_result_DTO_on_success()
    {
        var settingsService = Substitute.For<ISettingsService>();
        var fontDto = MakeDto(key: "font.pairing", keyType: "Font");
        var sizeDto = MakeDto(key: "font.size", keyType: "FontSize");
        var applyResult = new TypographyApplyResultDto(fontDto, sizeDto);
        settingsService.ApplyTypographyCombinationAsync("comfortable", Arg.Any<CancellationToken>()).Returns(applyResult);
        var controller = new SettingsController(settingsService);

        var result = await controller.ApplyTypographyCombination("comfortable", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(applyResult, ok.Value);
    }

    [Fact]
    public async Task ApplyTypographyCombination_propagates_ValidationException_from_the_service()
    {
        var settingsService = Substitute.For<ISettingsService>();
        settingsService.ApplyTypographyCombinationAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns<TypographyApplyResultDto>(_ => throw new ValidationException("'made-up' is not a currently curated typography combination."));
        var controller = new SettingsController(settingsService);

        await Assert.ThrowsAsync<ValidationException>(() => controller.ApplyTypographyCombination("made-up", CancellationToken.None));
    }

    private static IAuthorizationService BuildRealAuthorizationService(IRolePermissionCache cache)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAuthorization();
        services.AddSingleton<IAuthorizationPolicyProvider, FeaturePolicyProvider>();
        services.AddScoped<IAuthorizationHandler, FeatureAuthorizationHandler>();
        services.AddSingleton(cache);
        return services.BuildServiceProvider().GetRequiredService<IAuthorizationService>();
    }

    private static System.Security.Claims.ClaimsPrincipal MakePrincipal(UserRole role)
    {
        var identity = new System.Security.Claims.ClaimsIdentity(authenticationType: "TestAuth");
        identity.AddClaim(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, role.ToString()));
        return new System.Security.Claims.ClaimsPrincipal(identity);
    }

    [Fact]
    public async Task A_Master_user_is_authorized_for_SettingsManage()
    {
        // No explicit true row needed -- FeatureAuthorizationHandler's Master bypass succeeds
        // unconditionally, before any cache lookup (the real seeded matrix works the same way).
        var cache = Substitute.For<IRolePermissionCache>();
        cache.IsVisibleAsync(Arg.Any<UserRole>(), Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(false);
        var authorizationService = BuildRealAuthorizationService(cache);

        var result = await authorizationService.AuthorizeAsync(MakePrincipal(UserRole.Master), null, FeatureKeys.SettingsManage);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task A_Support_user_is_authorized_for_SettingsManage_unlike_AiConfigManage_or_MasterDataManage()
    {
        // Unlike ErrorsManage/AiConfigManage (Master-only), settings.manage is seeded true for
        // Support too (AD-27, mirroring tutor.approve) -- the cache lookup must return true here.
        var cache = Substitute.For<IRolePermissionCache>();
        cache.IsVisibleAsync(UserRole.Support, FeatureKeys.SettingsManage, Arg.Any<CancellationToken>()).Returns(true);
        var authorizationService = BuildRealAuthorizationService(cache);

        var result = await authorizationService.AuthorizeAsync(MakePrincipal(UserRole.Support), null, FeatureKeys.SettingsManage);

        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData(UserRole.Student)]
    [InlineData(UserRole.Tutor)]
    public async Task A_Student_or_Tutor_is_not_authorized_for_SettingsManage(UserRole role)
    {
        // Neither role has an explicit true row in RolePermissionSeedData for settings.manage --
        // falls through to the fail-closed default, same as every other admin-only feature key.
        var cache = Substitute.For<IRolePermissionCache>();
        cache.IsVisibleAsync(Arg.Any<UserRole>(), Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(false);
        var authorizationService = BuildRealAuthorizationService(cache);

        var result = await authorizationService.AuthorizeAsync(MakePrincipal(role), null, FeatureKeys.SettingsManage);

        Assert.False(result.Succeeded);
    }

    [Fact]
    public async Task A_Support_user_is_not_authorized_when_the_cache_has_no_explicit_true_row()
    {
        // Proves Support's access comes from the seeded row, not a Support-wide bypass the way
        // Master gets one -- if the cache says false, Support is denied same as anyone else.
        var cache = Substitute.For<IRolePermissionCache>();
        cache.IsVisibleAsync(UserRole.Support, FeatureKeys.SettingsManage, Arg.Any<CancellationToken>()).Returns(false);
        var authorizationService = BuildRealAuthorizationService(cache);

        var result = await authorizationService.AuthorizeAsync(MakePrincipal(UserRole.Support), null, FeatureKeys.SettingsManage);

        Assert.False(result.Succeeded);
    }
}

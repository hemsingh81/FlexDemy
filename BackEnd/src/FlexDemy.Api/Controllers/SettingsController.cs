using FlexDemy.Application.Permissions;
using FlexDemy.Application.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller. AD-27: Master AND Support (settings.manage), not Master-only --
// mirrors TutorApprove's access tier, not AiConfigManage's/MasterDataManage's.
[ApiController]
[Route("api/v1/settings")]
[Authorize(Policy = FeatureKeys.SettingsManage)]
public class SettingsController(ISettingsService settingsService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SettingDto>>> GetAllSettings(CancellationToken cancellationToken)
    {
        var settings = await settingsService.GetAllAsync(cancellationToken);
        return Ok(settings);
    }

    // AC #1: the curated catalog a Font Setting's Value must be picked from.
    [HttpGet("font-pairings")]
    public async Task<ActionResult<IReadOnlyList<FontPairingDefinitionDto>>> GetFontPairings(CancellationToken cancellationToken)
    {
        var pairings = await settingsService.GetFontPairingsAsync(cancellationToken);
        return Ok(pairings);
    }

    // Story 6.4/AC #1: the curated catalog a FontSize Setting's Value must be picked from.
    [HttpGet("font-sizes")]
    public async Task<ActionResult<IReadOnlyList<FontSizeDefinitionDto>>> GetFontSizes(CancellationToken cancellationToken)
    {
        var sizes = await settingsService.GetFontSizesAsync(cancellationToken);
        return Ok(sizes);
    }

    // Code-review patch (2026-08-16): [AllowAnonymous] on this ONE action deliberately overrides
    // the controller's class-level [Authorize(SettingsManage)] -- ASP.NET Core's AllowAnonymous
    // filter always short-circuits authorization for the action it's applied to, regardless of any
    // controller-level Authorize attribute. This is the fix for the bug where SiteSettingsContext
    // (mounted above auth gating, applying the site-wide font on every page load including the
    // login screen) called the two admin-gated endpoints above and got 401/403 for every
    // non-Master/Support visitor -- silently swallowed by its own fail-safe catch, so the applied
    // font never reached a real site visitor. This endpoint returns only three resolved
    // font-family strings (EffectiveFontsDto) -- never the admin Settings list or curated catalog
    // those two endpoints expose -- keeping the anonymous surface minimal.
    [HttpGet("effective-fonts")]
    [AllowAnonymous]
    public async Task<ActionResult<EffectiveFontsDto>> GetEffectiveFonts(CancellationToken cancellationToken)
    {
        var fonts = await settingsService.GetEffectiveFontsAsync(cancellationToken);
        return Ok(fonts);
    }

    // AD-25: the exclusive mutation path for a Setting's Value.
    [HttpPut("{id}/apply")]
    public async Task<ActionResult<SettingDto>> ApplySetting(string id, ApplySettingRequest request, CancellationToken cancellationToken)
    {
        var result = await settingsService.ApplyAsync(id, request.Value, cancellationToken);
        return Ok(result);
    }

    // AC #2: a given Setting's change history, reverse-chronological.
    [HttpGet("{id}/history")]
    public async Task<ActionResult<IReadOnlyList<SettingChangeHistoryDto>>> GetSettingHistory(string id, CancellationToken cancellationToken)
    {
        var history = await settingsService.GetHistoryAsync(id, cancellationToken);
        return Ok(history);
    }

    // Story 6.5/AC #1: the curated preset catalog for one-click Font Pairing + Font Size
    // selection. Admin-gated like every other route on this controller (unlike effective-fonts).
    [HttpGet("typography-combinations")]
    public async Task<ActionResult<IReadOnlyList<TypographyCombinationDefinitionDto>>> GetTypographyCombinations(CancellationToken cancellationToken)
    {
        var combinations = await settingsService.GetTypographyCombinationsAsync(cancellationToken);
        return Ok(combinations);
    }

    // Story 6.5/AC #2, #4, #5: a new, additive composed operation -- atomically applies a
    // curated combo's Font Pairing AND Font Size together. Does not replace ApplySetting above,
    // which remains the exclusive single-Setting mutation path.
    [HttpPut("typography-combinations/{slug}/apply")]
    public async Task<ActionResult<TypographyApplyResultDto>> ApplyTypographyCombination(string slug, CancellationToken cancellationToken)
    {
        var result = await settingsService.ApplyTypographyCombinationAsync(slug, cancellationToken);
        return Ok(result);
    }

    // The Advanced composer's save -- the same atomic Font + FontSize write as the route above, but
    // for a pair chosen independently rather than one drawn from a curated combination. Separate
    // from ApplySetting (single Setting) precisely so a custom pair gets the same all-or-nothing
    // guarantee a preset does, instead of the client issuing two ApplySetting calls that can fail
    // between them.
    [HttpPut("typography/apply")]
    public async Task<ActionResult<TypographyApplyResultDto>> ApplyTypography(ApplyTypographyRequest request, CancellationToken cancellationToken)
    {
        var result = await settingsService.ApplyTypographyAsync(request.FontPairingSlug, request.FontSizeSlug, cancellationToken);
        return Ok(result);
    }
}

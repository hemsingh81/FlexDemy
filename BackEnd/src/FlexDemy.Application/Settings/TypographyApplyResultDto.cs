namespace FlexDemy.Application.Settings;

// Story 6.5: the two Setting rows ApplyTypographyCombinationAsync updated atomically, so the
// caller can update local state for both without a second fetch.
public sealed record TypographyApplyResultDto(SettingDto Font, SettingDto FontSize);

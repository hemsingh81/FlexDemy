namespace FlexDemy.Application.ErrorObservability;

public sealed record ErrorRetentionSettingsDto(int RetentionDays);

public sealed record UpdateRetentionSettingsRequest(int RetentionDays);

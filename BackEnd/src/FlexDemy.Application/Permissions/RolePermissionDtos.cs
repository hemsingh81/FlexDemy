namespace FlexDemy.Application.Permissions;

// AD-10: services accept/return DTOs only at their public boundary. Role is a plain string
// here (mirrors UserDto.Role) rather than the Domain UserRole enum -- Domain types never cross
// out of Application.
public record RolePermissionRowDto(string Role, string FeatureKey, bool IsVisible);

public record UpdatePermissionRequest(string Role, string FeatureKey, bool IsVisible);

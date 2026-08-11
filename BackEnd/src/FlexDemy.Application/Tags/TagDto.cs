namespace FlexDemy.Application.Tags;

// Field names/shape deliberately mirror TagManagement.tsx's existing Tag/CreateTagRequest/
// UpdateTagRequest interfaces exactly (Story 1.3).
public sealed record TagDto(string Id, string Name, bool IsActive);

public sealed record CreateTagRequest(string Name);

public sealed record UpdateTagRequest(string Name, bool IsActive);

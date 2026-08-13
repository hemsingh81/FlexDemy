namespace FlexDemy.Application.AdaptiveLearning;

// Story 3.8/Task 5: shaped to match Story 3.4's ChecklistRow contract exactly (nodeKind/title/
// statusKind/statusText) so that story's frontend needs no reshaping once live-wired. IsPublishing
// is a separate flag from LifecycleState (matches Story 3.4's own design -- LifecycleState stays
// "ReviewConfirmed" for the whole publishing duration; it only becomes "Published" once the batch
// actually finishes).
public sealed record PublishStatusDto(
    string LifecycleState,
    bool IsPublishing,
    IReadOnlyList<ChecklistRowDto>? Checklist);

public sealed record ChecklistRowDto(string NodeId, string NodeKind, string Title, string StatusKind, string StatusText);

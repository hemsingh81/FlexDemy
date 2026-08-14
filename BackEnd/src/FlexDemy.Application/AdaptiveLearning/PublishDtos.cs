namespace FlexDemy.Application.AdaptiveLearning;

// Publish is now a single synchronous transition (no batch/checklist -- see PublishService's own
// header comment) -- this DTO is just the course's current lifecycle state.
public sealed record PublishStatusDto(string LifecycleState);

namespace FlexDemy.Application.AdaptiveLearning;

public interface IAdaptiveLearningService
{
    // Always calls the AI Task Gateway and (re)persists GeneratedContentJson -- never touches
    // OverrideContentJson. Returns override-if-present-else-generated (AC#3), same as every
    // other read path.
    Task<DrilldownLevelDto> GenerateLevelAsync(string courseId, string nodeId, int level, CancellationToken cancellationToken = default);
    Task<WayContentDto> GenerateWayAsync(string courseId, string nodeId, int wayNumber, CancellationToken cancellationToken = default);

    // Student-facing on-demand-fallback read path (AC#4): a cache hit (generated or override
    // already exists) returns directly, no AI call; otherwise generates+persists synchronously.
    // Requires Course.LifecycleState == Published.
    Task<DrilldownLevelDto> GetOrGenerateLevelAsync(string courseId, string nodeId, int level, CancellationToken cancellationToken = default);
    Task<WayContentDto> GetOrGenerateWayAsync(string courseId, string nodeId, int wayNumber, CancellationToken cancellationToken = default);

    // Tutor-only (ownership, not Draft-only -- ICourseService.EnsureOwnedAsync). Writes
    // OverrideContentJson, leaving GeneratedContentJson untouched.
    Task SetLevelOverrideAsync(string courseId, string nodeId, int level, DrilldownLevelContent content, CancellationToken cancellationToken = default);
    Task SetWayOverrideAsync(string courseId, string nodeId, int wayNumber, WayContentData content, CancellationToken cancellationToken = default);
}

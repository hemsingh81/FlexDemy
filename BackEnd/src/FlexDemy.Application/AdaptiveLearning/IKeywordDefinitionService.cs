namespace FlexDemy.Application.AdaptiveLearning;

public interface IKeywordDefinitionService
{
    // Student-facing. Cache hit (override or generated) returns immediately; otherwise generates
    // via the AI Service Layer and persists. A generation-availability failure (gateway down /
    // budget exceeded) returns Definition: null rather than propagating -- never breaks the
    // reading experience. Any other failure (e.g. an unusable AI response) propagates as a
    // genuine bug signal.
    Task<KeywordDefinitionDto> DefineAsync(string courseId, string keyword, CancellationToken cancellationToken = default);

    // Tutor-only.
    Task SetOverrideAsync(string courseId, string keyword, string definitionText, CancellationToken cancellationToken = default);
}

namespace FlexDemy.Application.AdaptiveLearning;

// Story 3.5/Task 3: public read shapes -- override-if-present-else-generated already resolved
// (AC#3), so every caller gets the right content for free rather than having to check
// IsOverridden itself and pick a source. Field names/shape mirror the frontend's DrillLevelData/
// WayData/ExampleItem shapes (Stories 3.1/3.2) so the eventual frontend swap-in needs no reshaping.
public sealed record DrilldownLevelDto(
    string NodeId,
    int LevelNumber,
    string Title,
    string Subtitle,
    string Content,
    IReadOnlyList<string> KeyPoints,
    IReadOnlyList<string>? MathFormulas,
    IReadOnlyList<ExampleItemDto> Examples,
    bool IsOverridden);

public sealed record WayContentDto(
    string NodeId,
    int WayNumber,
    string Explanation,
    ExampleItemDto Example,
    bool IsOverridden);

public sealed record ExampleItemDto(
    string Id,
    string Title,
    string Problem,
    IReadOnlyList<string> StepByStepSolution,
    string FinalAnswer,
    string Difficulty);

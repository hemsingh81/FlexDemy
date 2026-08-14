namespace FlexDemy.Domain.AiConfig;

// The AI Tasks routed through the AI Service Layer (PRD FR-27; AD-14). Exact casing matches
// the frontend's AiTaskId union (FrontEnd/src/features/Admin/AiConfiguration/useAiTaskConfig.ts).
// extractStructure/explainTopic/rewriteExplanation/generateExercise/describeNotation were removed
// along with the Chapter/Topic/Subtopic tree, Adaptive Learning Drill-Down, and Exercises -- the
// only two tasks with a real caller left are DefineKeyword (KeywordDefinitionService) and
// Embeddings (reserved, not yet wired to a caller).
public static class AiTaskIds
{
    public const string DefineKeyword = "defineKeyword";
    public const string Embeddings = "embeddings";

    public static readonly IReadOnlyList<string> All =
    [
        DefineKeyword, Embeddings,
    ];
}

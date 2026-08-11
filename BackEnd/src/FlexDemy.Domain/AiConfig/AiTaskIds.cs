namespace FlexDemy.Domain.AiConfig;

// The 7 AI Tasks routed through the AI Service Layer (PRD FR-27; AD-14). Exact casing matches
// the frontend's AiTaskId union (FrontEnd/src/features/Admin/AiConfiguration/useAiTaskConfig.ts).
public static class AiTaskIds
{
    public const string ExtractStructure = "extractStructure";
    public const string ExplainTopic = "explainTopic";
    public const string RewriteExplanation = "rewriteExplanation";
    public const string GenerateExercise = "generateExercise";
    public const string DefineKeyword = "defineKeyword";
    public const string DescribeNotation = "describeNotation";
    public const string Embeddings = "embeddings";

    public static readonly IReadOnlyList<string> All =
    [
        ExtractStructure, ExplainTopic, RewriteExplanation, GenerateExercise, DefineKeyword, DescribeNotation, Embeddings,
    ];
}

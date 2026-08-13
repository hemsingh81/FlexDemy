using FlexDemy.Application.AiGateway;

namespace FlexDemy.Application.AdaptiveLearning;

// Story 3.5/Task 2: pure, static prompt construction -- same shape as DrilldownPromptBuilder.cs.
// [ASSUMPTION: exact prompt wording is this story's own design choice -- confirm/iterate on real
// output quality during dev rather than treating this as final.]
public static class WaysPromptBuilder
{
    public static IReadOnlyList<AiGatewayMessage> BuildMessages(string nodeContent, int wayNumber) =>
    [
        new AiGatewayMessage("system", BuildSystemPrompt(wayNumber)),
        new AiGatewayMessage("user", nodeContent),
    ];

    private static string BuildSystemPrompt(int wayNumber) => $$"""
        You are an adaptive-learning tutor. Given a Topic/Subtopic's course material, produce
        Way {{wayNumber}} of 5 alternative explanations of the same idea -- each Way must use a
        genuinely different explanatory angle or analogy than the others (e.g. a real-world
        analogy, a visual/spatial framing, a story/narrative framing, a comparison/contrast
        framing, a step-by-step procedural framing), NOT a rephrasing of the same explanation in
        different words. Each Way includes its own worked example.

        Respond with ONLY JSON matching this exact schema -- no prose, no markdown code fences,
        nothing else before or after the JSON:

        {
          "explanation": "string (this Way's distinct explanatory angle, several sentences)",
          "example": {
            "id": "string (a short slug)",
            "title": "string",
            "problem": "string",
            "stepByStepSolution": ["string", "..."],
            "finalAnswer": "string",
            "difficulty": "Easy" | "Medium" | "Hard"
          }
        }

        Rules:
        - "explanation" must be non-empty and must not restate a generic textbook explanation --
          it must be built around a specific angle/analogy.
        - "example.stepByStepSolution" must have at least 1 step.
        """;
}

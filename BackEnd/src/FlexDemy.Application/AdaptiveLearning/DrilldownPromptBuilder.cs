using FlexDemy.Application.AiGateway;

namespace FlexDemy.Application.AdaptiveLearning;

// Story 3.5/Task 2: pure, static prompt construction -- no I/O, no DI, same shape as
// ExtractionPromptBuilder.cs/NotationDescriptionPromptBuilder.cs.
// [ASSUMPTION: exact prompt wording is this story's own design choice, not specified anywhere in
// the PRD/epics -- confirm/iterate on real output quality during dev rather than treating this as
// final.]
public static class DrilldownPromptBuilder
{
    public static IReadOnlyList<AiGatewayMessage> BuildMessages(string nodeContent, int level) =>
    [
        new AiGatewayMessage("system", BuildSystemPrompt(level)),
        new AiGatewayMessage("user", nodeContent),
    ];

    private static string BuildSystemPrompt(int level) => $$"""
        You are an adaptive-learning tutor. Given a Topic/Subtopic's course material, produce
        Level {{level}} of a 5-level progressive explanation of the same idea -- Level 1 is the
        simplest possible explanation (plain language, no jargon), Level 5 is the most rigorous
        (full technical/mathematical precision). This is Level {{level}} of 5: {{LevelGuidance(level)}}

        Respond with ONLY JSON matching this exact schema -- no prose, no markdown code fences,
        nothing else before or after the JSON:

        {
          "title": "string (a short label for this level, e.g. 'Level {{level}}')",
          "subtitle": "string (one-line summary of this level's angle)",
          "content": "string (the explanation itself, several sentences)",
          "keyPoints": ["string", "..."],
          "mathFormulas": ["string (LaTeX, only if genuinely relevant at this level)"],
          "examples": [
            {
              "id": "string (a short slug)",
              "title": "string",
              "problem": "string",
              "stepByStepSolution": ["string", "..."],
              "finalAnswer": "string",
              "difficulty": "Easy" | "Medium" | "Hard"
            }
          ]
        }

        Rules:
        - "keyPoints" must have at least 1 entry.
        - "examples" must have at least 1 worked example.
        - "mathFormulas" may be an empty array when no formula is relevant at this level.
        - Never omit "content" -- it must be non-empty.
        """;

    private static string LevelGuidance(int level) => level switch
    {
        1 => "the simplest possible framing, everyday language, no formulas.",
        2 => "a slightly more precise framing, introducing basic vocabulary.",
        3 => "a standard textbook-level explanation with the core formula(s).",
        4 => "a more rigorous explanation with the derivation/reasoning behind the formula(s).",
        5 => "the most rigorous, technically precise explanation appropriate for this subject.",
        _ => "a progressively deeper explanation than the previous level.",
    };
}

using FlexDemy.Application.AiGateway;
using FlexDemy.Domain.AdaptiveLearning;

namespace FlexDemy.Application.AdaptiveLearning;

// Story 3.6/Task 2: pure, static prompt construction -- same shape as Story 3.5's
// DrilldownPromptBuilder.cs/WaysPromptBuilder.cs. Takes the real AnswerType enum (not a raw
// string, deviating slightly from the story's own literal suggested signature) so this and
// AdaptiveLearningResponseParser.TryParseExercise agree on one type-checked source of truth for
// "which answer type," rather than both independently trusting a caller-supplied string to use
// the same casing/spelling.
// [ASSUMPTION: exact prompt wording is this story's own design choice -- confirm/iterate on real
// output quality during dev rather than treating this as final.]
public static class ExerciseGenerationPromptBuilder
{
    public static IReadOnlyList<AiGatewayMessage> BuildMessages(string nodeContent, AnswerType answerType) =>
    [
        new AiGatewayMessage("system", BuildSystemPrompt(answerType)),
        new AiGatewayMessage("user", nodeContent),
    ];

    private static string BuildSystemPrompt(AnswerType answerType) => $$"""
        You are an adaptive-learning tutor. Given a Topic/Subtopic's course material, propose one
        subject-appropriate practice question whose answer type is "{{answerType}}", plus a
        worked-solution/feedback text a student sees after submitting (correct or not). If the
        answer type is "MultipleChoice", also propose 3-4 plausible options, exactly one of which
        is correct.

        Respond with ONLY JSON matching this exact schema -- no prose, no markdown code fences,
        nothing else before or after the JSON:

        {
          "questionText": "string",
          "correctAnswer": "string (the reference answer used for grading -- for MultipleChoice, this must be one of the \"options\" values verbatim)",
          "feedbackText": "string (the worked solution, shown after submission regardless of correctness)",
          "options": ["string", "..."] // only when answerType is "MultipleChoice"; omit otherwise
        }

        Rules:
        - "questionText" and "correctAnswer" and "feedbackText" must all be non-empty.
        - When answerType is "MultipleChoice", "options" must have 3-4 entries and must include
          "correctAnswer" verbatim as one of them.
        - When answerType is "Numeric", "correctAnswer" must be a plain number (no units, no
          extra text).
        """;
}

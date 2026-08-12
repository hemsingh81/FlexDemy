using FlexDemy.Application.AiGateway;

namespace FlexDemy.Application.Courses;

// Story 2.10/Task 1: pure, static prompt construction -- no I/O, no DI, same shape as Story 2.8's
// ExtractionPromptBuilder. [ASSUMPTION: exact prompt wording is this story's own design choice,
// same precedent as ExtractionPromptBuilder's own header comment -- iterate on real output quality
// during dev rather than treating this as final.]
public static class NotationDescriptionPromptBuilder
{
    public static IReadOnlyList<AiGatewayMessage> BuildMessages(string notation) =>
    [
        new AiGatewayMessage("system", SystemPrompt),
        new AiGatewayMessage("user", notation),
    ];

    private const string SystemPrompt = """
        You describe math/chemistry notation (KaTeX/mhchem syntax) in plain language for a screen
        reader. Given the notation, respond with ONLY a short, single-sentence, screen-reader-
        friendly description suitable for use as alt-text/aria-label -- no markdown, no LaTeX
        echoed back, no prose beyond the one sentence itself.

        Examples:
        - "v = f\\lambda" -> "v equals f times lambda."
        - "\\ce{2H2 + O2 -> 2H2O}" -> "Two hydrogen molecules plus one oxygen molecule react to form two water molecules."
        """;
}

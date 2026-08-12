using FlexDemy.Application.AiGateway;

namespace FlexDemy.Application.Courses;

// Story 2.8/Task 2: pure, static prompt construction -- no I/O, no DI, easily unit-testable.
// [ASSUMPTION: exact prompt wording is this story's own design choice, not specified anywhere in
// the PRD/epics -- confirm/iterate on real output quality during dev rather than treating this as final.]
public static class ExtractionPromptBuilder
{
    public static IReadOnlyList<AiGatewayMessage> BuildMessages(string parsedContent) =>
    [
        new AiGatewayMessage("system", SystemPrompt),
        new AiGatewayMessage("user", parsedContent),
    ];

    private const string SystemPrompt = """
        You are a curriculum-structuring assistant. Given raw course material, propose a nested
        Chapter -> Topic -> Subtopic -> Content structure that a tutor can review and edit.

        Respond with ONLY JSON matching this exact schema -- no prose, no markdown code fences,
        nothing else before or after the JSON:

        {
          "chapters": [
            {
              "title": "string",
              "topics": [
                {
                  "title": "string",
                  "contentBlocks": [
                    { "format": "text" | "math", "text": "string", "lang": "en" | "hi", "notation": "string (only when format is math)" }
                  ],
                  "subtopics": [
                    {
                      "title": "string",
                      "contentBlocks": [
                        { "format": "text" | "math", "text": "string", "lang": "en" | "hi", "notation": "string (only when format is math)" }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }

        Rules:
        - Every chapter, topic, and subtopic must have a non-empty "title".
        - Every content block must set "lang" to "en" or "hi" -- default to "en" unless the
          content is clearly Hindi/Devanagari.
        - Every content block with "format": "math" must include "notation" -- a plain-text or
          LaTeX approximation of the equation is fine if you cannot produce exact markup, but
          never omit it entirely.
        - A "format": "text" content block must include non-empty "text".
        - Never use "format": "image".
        - A chapter's own content lives entirely under its topics/subtopics -- a chapter has no
          content blocks of its own.
        """;
}

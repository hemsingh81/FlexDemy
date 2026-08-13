using FlexDemy.Application.AiGateway;

namespace FlexDemy.Application.AdaptiveLearning;

// Story 3.7/Task 2: pure, static prompt construction. Unlike Drilldown/Ways/Exercise, a keyword
// definition is a single short string, not a nested schema -- follows
// NotationDescriptionPromptBuilder.cs's own established precedent (Story 2.10) of asking for a
// raw plain-text sentence rather than wrapping a one-sentence answer in JSON only to immediately
// unwrap it.
// [ASSUMPTION: FR20/AC#1's "language-aware" requirement would need the course's own instructional
// language (English/Hindi, this platform's stated v1 scope) -- no such field exists yet on the
// real Course entity (confirmed by direct read of Domain/Courses/Course.cs: Subject/Level/
// TargetGradeTag/Tags/InstructorName/LifecycleState/TutorId/Thumbnails/TagIds/CountryId/StateId/
// CityId/BoardId/ClassLevelId/SubjectId -- no language field among them). This prompt always
// requests an English-language definition as a result. This is a real, currently-unaddressed gap
// in FR20, not a silent guess -- flagged here and in this story's own Completion Notes rather
// than hidden; adding a Course-level language field is out of this story's own stated scope.]
public static class KeywordDefinitionPromptBuilder
{
    public static IReadOnlyList<AiGatewayMessage> BuildMessages(string keyword, string courseSubject) =>
    [
        new AiGatewayMessage("system", BuildSystemPrompt(courseSubject)),
        new AiGatewayMessage("user", keyword),
    ];

    private static string BuildSystemPrompt(string courseSubject) => $$"""
        You define keywords for students taking a course on "{{courseSubject}}". Given a keyword
        or short phrase, respond with ONLY a short, one-to-two-sentence definition appropriate to
        that subject's context, in English -- no markdown, no JSON, no prose beyond the definition
        itself.
        """;
}

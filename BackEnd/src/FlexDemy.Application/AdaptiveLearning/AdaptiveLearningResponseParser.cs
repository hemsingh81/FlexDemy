using System.Text.Json;
using System.Text.Json.Serialization;
using FlexDemy.Domain.AdaptiveLearning;

namespace FlexDemy.Application.AdaptiveLearning;

// Story 3.5/Task 2: pure, static response validation -- no I/O, no DI. Mirrors
// ExtractionResponseParser's own validated-parse-not-blind-deserialize discipline: a malformed or
// schema-incomplete AI response fails closed (returns false), never silently saved as a broken
// level/way.
public static class AdaptiveLearningResponseParser
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static bool TryParseLevel(string aiContent, out DrilldownLevelContent? content, out string? parseError)
    {
        content = null;
        var stripped = StripCodeFence(aiContent);

        RawLevel? raw;
        try
        {
            raw = JsonSerializer.Deserialize<RawLevel>(stripped, JsonOptions);
        }
        catch (JsonException ex)
        {
            parseError = $"AI response was not valid JSON: {ex.Message}";
            return false;
        }

        if (raw is null)
        {
            parseError = "AI response was empty.";
            return false;
        }
        if (string.IsNullOrWhiteSpace(raw.Title))
        {
            parseError = "Response is missing a title.";
            return false;
        }
        if (string.IsNullOrWhiteSpace(raw.Subtitle))
        {
            parseError = "Response is missing a subtitle.";
            return false;
        }
        if (string.IsNullOrWhiteSpace(raw.Content))
        {
            parseError = "Response is missing its explanation content.";
            return false;
        }
        if (raw.KeyPoints is not { Count: > 0 })
        {
            parseError = "Response has no key points.";
            return false;
        }
        if (!TryValidateExamples(raw.Examples, out var examples, out parseError))
            return false;

        content = new DrilldownLevelContent(raw.Title, raw.Subtitle, raw.Content, raw.KeyPoints, raw.MathFormulas, examples);
        parseError = null;
        return true;
    }

    public static bool TryParseWay(string aiContent, out WayContentData? content, out string? parseError)
    {
        content = null;
        var stripped = StripCodeFence(aiContent);

        RawWay? raw;
        try
        {
            raw = JsonSerializer.Deserialize<RawWay>(stripped, JsonOptions);
        }
        catch (JsonException ex)
        {
            parseError = $"AI response was not valid JSON: {ex.Message}";
            return false;
        }

        if (raw is null)
        {
            parseError = "AI response was empty.";
            return false;
        }
        if (string.IsNullOrWhiteSpace(raw.Explanation))
        {
            parseError = "Response is missing its explanation.";
            return false;
        }
        if (raw.Example is null)
        {
            parseError = "Response is missing its worked example.";
            return false;
        }
        if (!TryValidateExample(raw.Example, out var example, out parseError))
            return false;

        content = new WayContentData(raw.Explanation, example);
        parseError = null;
        return true;
    }

    // Story 3.6/Task 2: added to this shared parser (not a third parallel parser file) --
    // `answerType` (the real AnswerType enum, not a raw string) drives conditional validation: a
    // MultipleChoice response must include 3-4 options that contain `correctAnswer` verbatim; a
    // Numeric response's `correctAnswer` must itself parse as a plain number.
    public static bool TryParseExercise(string aiContent, AnswerType answerType, out ExerciseProposalContent? content, out string? parseError)
    {
        content = null;
        var stripped = StripCodeFence(aiContent);

        RawExerciseProposal? raw;
        try
        {
            raw = JsonSerializer.Deserialize<RawExerciseProposal>(stripped, JsonOptions);
        }
        catch (JsonException ex)
        {
            parseError = $"AI response was not valid JSON: {ex.Message}";
            return false;
        }

        if (raw is null)
        {
            parseError = "AI response was empty.";
            return false;
        }
        if (string.IsNullOrWhiteSpace(raw.QuestionText))
        {
            parseError = "Response is missing its question text.";
            return false;
        }
        if (string.IsNullOrWhiteSpace(raw.CorrectAnswer))
        {
            parseError = "Response is missing its correct answer.";
            return false;
        }
        if (string.IsNullOrWhiteSpace(raw.FeedbackText))
        {
            parseError = "Response is missing its feedback text.";
            return false;
        }

        if (answerType == AnswerType.MultipleChoice)
        {
            if (raw.Options is not { Count: >= 3 and <= 4 })
            {
                parseError = "A MultipleChoice response must include 3-4 options.";
                return false;
            }
            if (!raw.Options.Contains(raw.CorrectAnswer))
            {
                parseError = "A MultipleChoice response's correctAnswer must be one of its options.";
                return false;
            }
        }
        else if (answerType == AnswerType.Numeric && !double.TryParse(raw.CorrectAnswer.Trim(), out _))
        {
            parseError = "A Numeric response's correctAnswer must be a plain number.";
            return false;
        }

        content = new ExerciseProposalContent(raw.QuestionText, raw.CorrectAnswer, raw.FeedbackText, raw.Options);
        parseError = null;
        return true;
    }

    // Story 3.7/Task 2: unlike TryParseLevel/TryParseWay/TryParseExercise, a keyword definition is
    // a single short string, not a nested JSON schema -- matches
    // NotationDescriptionPromptBuilder.cs's own established precedent (Story 2.10) of a raw
    // plain-text AI response, so this just trims and length-caps rather than deserializing JSON.
    private const int MaxDefinitionLength = 1000;

    public static bool TryParseKeywordDefinition(string aiContent, out string? definition, out string? parseError)
    {
        var trimmed = aiContent?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            definition = null;
            parseError = "AI response was empty.";
            return false;
        }

        definition = trimmed.Length > MaxDefinitionLength ? trimmed[..MaxDefinitionLength] : trimmed;
        parseError = null;
        return true;
    }

    private static bool TryValidateExamples(IReadOnlyList<RawExample?>? rawExamples, out IReadOnlyList<ExampleItemContent> examples, out string? parseError)
    {
        if (rawExamples is not { Count: > 0 })
        {
            examples = [];
            parseError = "Response has no worked examples.";
            return false;
        }

        var validated = new List<ExampleItemContent>();
        foreach (var rawExample in rawExamples)
        {
            if (rawExample is null)
            {
                examples = [];
                parseError = "An example entry was null.";
                return false;
            }
            if (!TryValidateExample(rawExample, out var example, out parseError))
            {
                examples = [];
                return false;
            }
            validated.Add(example);
        }

        examples = validated;
        parseError = null;
        return true;
    }

    private static bool TryValidateExample(RawExample raw, out ExampleItemContent example, out string? parseError)
    {
        example = null!;

        if (string.IsNullOrWhiteSpace(raw.Id) || string.IsNullOrWhiteSpace(raw.Title))
        {
            parseError = "An example is missing its id or title.";
            return false;
        }
        if (string.IsNullOrWhiteSpace(raw.Problem) || string.IsNullOrWhiteSpace(raw.FinalAnswer))
        {
            parseError = "An example is missing its problem or final answer.";
            return false;
        }
        if (raw.StepByStepSolution is not { Count: > 0 })
        {
            parseError = "An example has no step-by-step solution.";
            return false;
        }
        if (raw.Difficulty is not ("Easy" or "Medium" or "Hard"))
        {
            parseError = $"An example has an unsupported difficulty '{raw.Difficulty}'.";
            return false;
        }

        example = new ExampleItemContent(raw.Id, raw.Title, raw.Problem, raw.StepByStepSolution, raw.FinalAnswer, raw.Difficulty);
        parseError = null;
        return true;
    }

    // Byte-for-byte the same fence-stripping behavior as ExtractionResponseParser's own helper --
    // duplicated rather than shared, matching this codebase's established per-parser-file
    // self-containment (ExtractionResponseParser/NotationDescriptionPromptBuilder don't share a
    // common base either).
    private static string StripCodeFence(string content)
    {
        var trimmed = content.Trim();
        var fenceStart = trimmed.IndexOf("```", StringComparison.Ordinal);
        if (fenceStart < 0)
            return trimmed;

        var afterOpeningMarker = trimmed[(fenceStart + 3)..];
        var firstNewline = afterOpeningMarker.IndexOf('\n');
        var fencedContent = firstNewline >= 0 ? afterOpeningMarker[(firstNewline + 1)..] : afterOpeningMarker;

        var closingFenceIndex = fencedContent.LastIndexOf("```", StringComparison.Ordinal);
        return (closingFenceIndex >= 0 ? fencedContent[..closingFenceIndex] : fencedContent).Trim();
    }

    private sealed record RawLevel(
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("subtitle")] string? Subtitle,
        [property: JsonPropertyName("content")] string? Content,
        [property: JsonPropertyName("keyPoints")] IReadOnlyList<string>? KeyPoints,
        [property: JsonPropertyName("mathFormulas")] IReadOnlyList<string>? MathFormulas,
        [property: JsonPropertyName("examples")] IReadOnlyList<RawExample?>? Examples);

    private sealed record RawWay(
        [property: JsonPropertyName("explanation")] string? Explanation,
        [property: JsonPropertyName("example")] RawExample? Example);

    private sealed record RawExample(
        [property: JsonPropertyName("id")] string? Id,
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("problem")] string? Problem,
        [property: JsonPropertyName("stepByStepSolution")] IReadOnlyList<string>? StepByStepSolution,
        [property: JsonPropertyName("finalAnswer")] string? FinalAnswer,
        [property: JsonPropertyName("difficulty")] string? Difficulty);

    private sealed record RawExerciseProposal(
        [property: JsonPropertyName("questionText")] string? QuestionText,
        [property: JsonPropertyName("correctAnswer")] string? CorrectAnswer,
        [property: JsonPropertyName("feedbackText")] string? FeedbackText,
        [property: JsonPropertyName("options")] IReadOnlyList<string>? Options);
}

// Public, validated output shapes -- match the JSON schema (and the frontend's DrillLevelData/
// WayData/ExampleItem shapes from Stories 3.1/3.2) exactly.
public sealed record DrilldownLevelContent(
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("subtitle")] string Subtitle,
    [property: JsonPropertyName("content")] string Content,
    [property: JsonPropertyName("keyPoints")] IReadOnlyList<string> KeyPoints,
    [property: JsonPropertyName("mathFormulas")] IReadOnlyList<string>? MathFormulas,
    [property: JsonPropertyName("examples")] IReadOnlyList<ExampleItemContent> Examples);

public sealed record WayContentData(
    [property: JsonPropertyName("explanation")] string Explanation,
    [property: JsonPropertyName("example")] ExampleItemContent Example);

public sealed record ExampleItemContent(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("problem")] string Problem,
    [property: JsonPropertyName("stepByStepSolution")] IReadOnlyList<string> StepByStepSolution,
    [property: JsonPropertyName("finalAnswer")] string FinalAnswer,
    [property: JsonPropertyName("difficulty")] string Difficulty);

// Story 3.6: match's Story 3.3's frontend Exercise shape's proposal-relevant fields exactly
// (questionText/correctAnswer/feedbackText/options).
public sealed record ExerciseProposalContent(
    [property: JsonPropertyName("questionText")] string QuestionText,
    [property: JsonPropertyName("correctAnswer")] string CorrectAnswer,
    [property: JsonPropertyName("feedbackText")] string FeedbackText,
    [property: JsonPropertyName("options")] IReadOnlyList<string>? Options);

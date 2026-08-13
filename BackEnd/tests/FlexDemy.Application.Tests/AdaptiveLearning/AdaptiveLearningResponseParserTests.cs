using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Domain.AdaptiveLearning;
using Xunit;

namespace FlexDemy.Application.Tests.AdaptiveLearning;

public class AdaptiveLearningResponseParserTests
{
    private const string ValidLevelJson = """
        {
          "title": "Level 1",
          "subtitle": "The simplest framing",
          "content": "A wave carries energy without carrying matter.",
          "keyPoints": ["Energy transfer", "No matter transfer"],
          "mathFormulas": ["v = f\\lambda"],
          "examples": [
            {
              "id": "ex_1",
              "title": "Worked example",
              "problem": "Find wavelength given v and f.",
              "stepByStepSolution": ["Start from v = f * lambda", "Solve for lambda"],
              "finalAnswer": "lambda = v / f",
              "difficulty": "Easy"
            }
          ]
        }
        """;

    private const string ValidWayJson = """
        {
          "explanation": "Picture a stadium wave -- each seat only moves up and down.",
          "example": {
            "id": "way_ex_1",
            "title": "Worked example",
            "problem": "Find wavelength given v and f.",
            "stepByStepSolution": ["Start from v = f * lambda", "Solve for lambda"],
            "finalAnswer": "lambda = v / f",
            "difficulty": "Medium"
          }
        }
        """;

    [Fact]
    public void TryParseLevel_valid_schema_conforming_JSON_parses_correctly()
    {
        var ok = AdaptiveLearningResponseParser.TryParseLevel(ValidLevelJson, out var content, out var parseError);

        Assert.True(ok);
        Assert.Null(parseError);
        Assert.NotNull(content);
        Assert.Equal("Level 1", content!.Title);
        Assert.Equal(2, content.KeyPoints.Count);
        Assert.Single(content.Examples);
        Assert.Equal("Easy", content.Examples[0].Difficulty);
    }

    [Fact]
    public void TryParseLevel_JSON_wrapped_in_a_markdown_code_fence_still_parses()
    {
        var fenced = $"```json\n{ValidLevelJson}\n```";

        var ok = AdaptiveLearningResponseParser.TryParseLevel(fenced, out var content, out var parseError);

        Assert.True(ok);
        Assert.Null(parseError);
        Assert.NotNull(content);
    }

    [Fact]
    public void TryParseLevel_malformed_JSON_fails_with_a_descriptive_parseError()
    {
        var ok = AdaptiveLearningResponseParser.TryParseLevel("not json at all", out var content, out var parseError);

        Assert.False(ok);
        Assert.Null(content);
        Assert.NotNull(parseError);
    }

    [Fact]
    public void TryParseLevel_missing_content_field_fails()
    {
        const string json = """{"title":"L1","subtitle":"S","keyPoints":["a"],"examples":[{"id":"e","title":"t","problem":"p","stepByStepSolution":["s"],"finalAnswer":"f","difficulty":"Easy"}]}""";

        var ok = AdaptiveLearningResponseParser.TryParseLevel(json, out var content, out var parseError);

        Assert.False(ok);
        Assert.Null(content);
        Assert.NotNull(parseError);
    }

    [Fact]
    public void TryParseLevel_no_examples_fails()
    {
        const string json = """{"title":"L1","subtitle":"S","content":"C","keyPoints":["a"],"examples":[]}""";

        var ok = AdaptiveLearningResponseParser.TryParseLevel(json, out var content, out var parseError);

        Assert.False(ok);
        Assert.Null(content);
        Assert.NotNull(parseError);
    }

    [Fact]
    public void TryParseLevel_no_key_points_fails()
    {
        const string json = """{"title":"L1","subtitle":"S","content":"C","keyPoints":[],"examples":[{"id":"e","title":"t","problem":"p","stepByStepSolution":["s"],"finalAnswer":"f","difficulty":"Easy"}]}""";

        var ok = AdaptiveLearningResponseParser.TryParseLevel(json, out var content, out var parseError);

        Assert.False(ok);
        Assert.Null(content);
    }

    [Fact]
    public void TryParseLevel_an_example_with_unsupported_difficulty_fails()
    {
        const string json = """{"title":"L1","subtitle":"S","content":"C","keyPoints":["a"],"examples":[{"id":"e","title":"t","problem":"p","stepByStepSolution":["s"],"finalAnswer":"f","difficulty":"Impossible"}]}""";

        var ok = AdaptiveLearningResponseParser.TryParseLevel(json, out var content, out var parseError);

        Assert.False(ok);
        Assert.Null(content);
        Assert.NotNull(parseError);
    }

    [Fact]
    public void TryParseWay_valid_schema_conforming_JSON_parses_correctly()
    {
        var ok = AdaptiveLearningResponseParser.TryParseWay(ValidWayJson, out var content, out var parseError);

        Assert.True(ok);
        Assert.Null(parseError);
        Assert.NotNull(content);
        Assert.Contains("stadium wave", content!.Explanation);
        Assert.Equal("Medium", content.Example.Difficulty);
    }

    [Fact]
    public void TryParseWay_JSON_wrapped_in_a_markdown_code_fence_still_parses()
    {
        var fenced = $"```json\n{ValidWayJson}\n```";

        var ok = AdaptiveLearningResponseParser.TryParseWay(fenced, out var content, out var parseError);

        Assert.True(ok);
        Assert.Null(parseError);
        Assert.NotNull(content);
    }

    [Fact]
    public void TryParseWay_malformed_JSON_fails_with_a_descriptive_parseError()
    {
        var ok = AdaptiveLearningResponseParser.TryParseWay("not json at all", out var content, out var parseError);

        Assert.False(ok);
        Assert.Null(content);
        Assert.NotNull(parseError);
    }

    [Fact]
    public void TryParseWay_missing_example_fails()
    {
        const string json = """{"explanation":"Some explanation"}""";

        var ok = AdaptiveLearningResponseParser.TryParseWay(json, out var content, out var parseError);

        Assert.False(ok);
        Assert.Null(content);
        Assert.NotNull(parseError);
    }

    [Fact]
    public void TryParseWay_missing_explanation_fails()
    {
        const string json = """{"example":{"id":"e","title":"t","problem":"p","stepByStepSolution":["s"],"finalAnswer":"f","difficulty":"Easy"}}""";

        var ok = AdaptiveLearningResponseParser.TryParseWay(json, out var content, out var parseError);

        Assert.False(ok);
        Assert.Null(content);
        Assert.NotNull(parseError);
    }

    [Fact]
    public void TryParseWay_example_with_no_solution_steps_fails()
    {
        const string json = """{"explanation":"Some explanation","example":{"id":"e","title":"t","problem":"p","stepByStepSolution":[],"finalAnswer":"f","difficulty":"Easy"}}""";

        var ok = AdaptiveLearningResponseParser.TryParseWay(json, out var content, out var parseError);

        Assert.False(ok);
        Assert.Null(content);
        Assert.NotNull(parseError);
    }

    // -- TryParseExercise (Story 3.6) ----------------------------------------------------------------

    [Fact]
    public void TryParseExercise_valid_shortText_response_parses_correctly()
    {
        const string json = """{"questionText":"Why?","correctAnswer":"energy","feedbackText":"Because..."}""";

        var ok = AdaptiveLearningResponseParser.TryParseExercise(json, AnswerType.ShortText, out var content, out var parseError);

        Assert.True(ok);
        Assert.Null(parseError);
        Assert.Equal("energy", content!.CorrectAnswer);
        Assert.Null(content.Options);
    }

    [Fact]
    public void TryParseExercise_valid_multipleChoice_response_with_correctAnswer_among_options_parses()
    {
        const string json = """{"questionText":"Which?","correctAnswer":"B","feedbackText":"B is right.","options":["A","B","C"]}""";

        var ok = AdaptiveLearningResponseParser.TryParseExercise(json, AnswerType.MultipleChoice, out var content, out var parseError);

        Assert.True(ok);
        Assert.Null(parseError);
        Assert.Equal(3, content!.Options!.Count);
    }

    [Fact]
    public void TryParseExercise_multipleChoice_with_fewer_than_3_options_fails()
    {
        const string json = """{"questionText":"Which?","correctAnswer":"B","feedbackText":"B is right.","options":["A","B"]}""";

        var ok = AdaptiveLearningResponseParser.TryParseExercise(json, AnswerType.MultipleChoice, out var content, out var parseError);

        Assert.False(ok);
        Assert.Null(content);
        Assert.NotNull(parseError);
    }

    [Fact]
    public void TryParseExercise_multipleChoice_whose_correctAnswer_is_not_among_options_fails()
    {
        const string json = """{"questionText":"Which?","correctAnswer":"D","feedbackText":"...","options":["A","B","C"]}""";

        var ok = AdaptiveLearningResponseParser.TryParseExercise(json, AnswerType.MultipleChoice, out var content, out var parseError);

        Assert.False(ok);
        Assert.Null(content);
        Assert.NotNull(parseError);
    }

    [Fact]
    public void TryParseExercise_numeric_with_a_non_numeric_correctAnswer_fails()
    {
        const string json = """{"questionText":"How far?","correctAnswer":"three meters","feedbackText":"..."}""";

        var ok = AdaptiveLearningResponseParser.TryParseExercise(json, AnswerType.Numeric, out var content, out var parseError);

        Assert.False(ok);
        Assert.Null(content);
        Assert.NotNull(parseError);
    }

    [Fact]
    public void TryParseExercise_numeric_with_a_plain_numeric_correctAnswer_parses()
    {
        const string json = """{"questionText":"How far?","correctAnswer":"3.5","feedbackText":"..."}""";

        var ok = AdaptiveLearningResponseParser.TryParseExercise(json, AnswerType.Numeric, out var content, out var parseError);

        Assert.True(ok);
        Assert.Null(parseError);
        Assert.Equal("3.5", content!.CorrectAnswer);
    }

    [Fact]
    public void TryParseExercise_missing_questionText_fails()
    {
        const string json = """{"correctAnswer":"a","feedbackText":"f"}""";

        var ok = AdaptiveLearningResponseParser.TryParseExercise(json, AnswerType.ShortText, out var content, out var parseError);

        Assert.False(ok);
        Assert.Null(content);
        Assert.NotNull(parseError);
    }

    [Fact]
    public void TryParseExercise_malformed_JSON_fails_with_a_descriptive_parseError()
    {
        var ok = AdaptiveLearningResponseParser.TryParseExercise("not json at all", AnswerType.ShortText, out var content, out var parseError);

        Assert.False(ok);
        Assert.Null(content);
        Assert.NotNull(parseError);
    }

    // -- TryParseKeywordDefinition (Story 3.7) ---------------------------------------------------

    [Fact]
    public void TryParseKeywordDefinition_a_plain_text_response_parses_trimmed()
    {
        var ok = AdaptiveLearningResponseParser.TryParseKeywordDefinition("  A wave transfers energy.  \n", out var definition, out var parseError);

        Assert.True(ok);
        Assert.Null(parseError);
        Assert.Equal("A wave transfers energy.", definition);
    }

    [Fact]
    public void TryParseKeywordDefinition_empty_response_fails()
    {
        var ok = AdaptiveLearningResponseParser.TryParseKeywordDefinition("   ", out var definition, out var parseError);

        Assert.False(ok);
        Assert.Null(definition);
        Assert.NotNull(parseError);
    }

    [Fact]
    public void TryParseKeywordDefinition_truncates_a_response_longer_than_the_max_length()
    {
        var longResponse = new string('a', 2000);

        var ok = AdaptiveLearningResponseParser.TryParseKeywordDefinition(longResponse, out var definition, out var parseError);

        Assert.True(ok);
        Assert.Null(parseError);
        Assert.Equal(1000, definition!.Length);
    }
}

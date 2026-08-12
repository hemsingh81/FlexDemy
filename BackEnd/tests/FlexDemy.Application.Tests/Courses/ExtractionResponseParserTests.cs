using FlexDemy.Application.Courses;
using Xunit;

namespace FlexDemy.Application.Tests.Courses;

public class ExtractionResponseParserTests
{
    private const string ValidJson = """
        {
          "chapters": [
            {
              "title": "Chapter 1",
              "topics": [
                {
                  "title": "Topic 1",
                  "contentBlocks": [
                    { "format": "text", "text": "Some explanation", "lang": "en" },
                    { "format": "math", "text": "An equation", "lang": "en", "notation": "x^2 + y^2 = z^2" }
                  ],
                  "subtopics": [
                    { "title": "Subtopic 1", "contentBlocks": [{ "format": "text", "text": "Sub content", "lang": "hi" }] }
                  ]
                }
              ]
            }
          ]
        }
        """;

    [Fact]
    public void TryParse_valid_schema_conforming_JSON_parses_into_the_expected_ProposedStructure()
    {
        var ok = ExtractionResponseParser.TryParse(ValidJson, out var structure, out var parseError);

        Assert.True(ok);
        Assert.Null(parseError);
        Assert.NotNull(structure);
        var chapter = Assert.Single(structure!.Chapters);
        Assert.Equal("Chapter 1", chapter.Title);
        var topic = Assert.Single(chapter.Topics);
        Assert.Equal("Topic 1", topic.Title);
        Assert.Equal(2, topic.ContentBlocks.Count);
        Assert.Equal("math", topic.ContentBlocks[1].Format);
        Assert.Equal("x^2 + y^2 = z^2", topic.ContentBlocks[1].Notation);
        var subtopic = Assert.Single(topic.Subtopics);
        Assert.Equal("Subtopic 1", subtopic.Title);
        Assert.Equal("hi", subtopic.ContentBlocks[0].Lang);
    }

    [Fact]
    public void TryParse_JSON_wrapped_in_a_markdown_code_fence_still_parses()
    {
        var fenced = $"```json\n{ValidJson}\n```";

        var ok = ExtractionResponseParser.TryParse(fenced, out var structure, out var parseError);

        Assert.True(ok);
        Assert.Null(parseError);
        Assert.NotNull(structure);
    }

    [Fact]
    public void TryParse_a_content_block_with_no_lang_defaults_to_en()
    {
        const string json = """{"chapters":[{"title":"C1","topics":[{"title":"T1","contentBlocks":[{"format":"text","text":"hi"}],"subtopics":[]}]}]}""";

        var ok = ExtractionResponseParser.TryParse(json, out var structure, out _);

        Assert.True(ok);
        Assert.Equal("en", structure!.Chapters[0].Topics[0].ContentBlocks[0].Lang);
    }

    [Fact]
    public void TryParse_malformed_JSON_fails_with_a_descriptive_parseError()
    {
        var ok = ExtractionResponseParser.TryParse("not json at all", out var structure, out var parseError);

        Assert.False(ok);
        Assert.Null(structure);
        Assert.NotNull(parseError);
    }

    [Fact]
    public void TryParse_an_empty_chapters_array_fails()
    {
        var ok = ExtractionResponseParser.TryParse("""{"chapters":[]}""", out var structure, out var parseError);

        Assert.False(ok);
        Assert.Null(structure);
        Assert.NotNull(parseError);
    }

    [Fact]
    public void TryParse_a_chapter_missing_title_fails()
    {
        var ok = ExtractionResponseParser.TryParse("""{"chapters":[{"topics":[]}]}""", out var structure, out var parseError);

        Assert.False(ok);
        Assert.Null(structure);
        Assert.Contains("title", parseError, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void TryParse_a_format_text_block_with_no_text_fails()
    {
        const string json = """{"chapters":[{"title":"C1","topics":[{"title":"T1","contentBlocks":[{"format":"text"}],"subtopics":[]}]}]}""";

        var ok = ExtractionResponseParser.TryParse(json, out var structure, out var parseError);

        Assert.False(ok);
        Assert.Null(structure);
        Assert.Contains("text", parseError, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void TryParse_a_format_math_block_with_no_notation_fails()
    {
        const string json = """{"chapters":[{"title":"C1","topics":[{"title":"T1","contentBlocks":[{"format":"math","text":"eq"}],"subtopics":[]}]}]}""";

        var ok = ExtractionResponseParser.TryParse(json, out var structure, out var parseError);

        Assert.False(ok);
        Assert.Null(structure);
        Assert.Contains("notation", parseError, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void TryParse_a_format_image_block_fails_since_this_story_never_produces_image_blocks()
    {
        const string json = """{"chapters":[{"title":"C1","topics":[{"title":"T1","contentBlocks":[{"format":"image"}],"subtopics":[]}]}]}""";

        var ok = ExtractionResponseParser.TryParse(json, out var structure, out var parseError);

        Assert.False(ok);
        Assert.Null(structure);
    }

    [Fact]
    public void TryParse_a_topic_missing_title_fails()
    {
        const string json = """{"chapters":[{"title":"C1","topics":[{"contentBlocks":[],"subtopics":[]}]}]}""";

        var ok = ExtractionResponseParser.TryParse(json, out var structure, out var parseError);

        Assert.False(ok);
        Assert.Null(structure);
    }

    // -- Code-review patch coverage -------------------------------------------------------------

    [Fact]
    public void TryParse_a_whitespace_only_text_content_block_fails_the_same_as_an_empty_one()
    {
        const string json = """{"chapters":[{"title":"C1","topics":[{"title":"T1","contentBlocks":[{"format":"text","text":"   "}],"subtopics":[]}]}]}""";

        var ok = ExtractionResponseParser.TryParse(json, out var structure, out var parseError);

        Assert.False(ok);
        Assert.Null(structure);
        Assert.Contains("text", parseError, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void TryParse_a_whitespace_only_math_notation_fails_the_same_as_an_empty_one()
    {
        const string json = """{"chapters":[{"title":"C1","topics":[{"title":"T1","contentBlocks":[{"format":"math","notation":"  "}],"subtopics":[]}]}]}""";

        var ok = ExtractionResponseParser.TryParse(json, out var structure, out var parseError);

        Assert.False(ok);
        Assert.Null(structure);
    }

    [Fact]
    public void TryParse_titles_only_with_no_content_blocks_anywhere_fails()
    {
        const string json = """{"chapters":[{"title":"C1","topics":[{"title":"T1","contentBlocks":[],"subtopics":[{"title":"S1","contentBlocks":[]}]}]}]}""";

        var ok = ExtractionResponseParser.TryParse(json, out var structure, out var parseError);

        Assert.False(ok);
        Assert.Null(structure);
        Assert.Contains("no actual content", parseError, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void TryParse_JSON_with_leading_prose_before_the_code_fence_still_parses()
    {
        var withLeadingProse = $"Here's the proposed structure:\n```json\n{ValidJson}\n```";

        var ok = ExtractionResponseParser.TryParse(withLeadingProse, out var structure, out var parseError);

        Assert.True(ok);
        Assert.Null(parseError);
        Assert.NotNull(structure);
    }

    [Theory]
    [InlineData("""{"chapters":[null]}""")]
    [InlineData("""{"chapters":[{"title":"C1","topics":[null]}]}""")]
    [InlineData("""{"chapters":[{"title":"C1","topics":[{"title":"T1","contentBlocks":[],"subtopics":[null]}]}]}""")]
    [InlineData("""{"chapters":[{"title":"C1","topics":[{"title":"T1","contentBlocks":[null],"subtopics":[]}]}]}""")]
    public void TryParse_a_null_array_element_fails_cleanly_instead_of_throwing(string json)
    {
        var ok = ExtractionResponseParser.TryParse(json, out var structure, out var parseError);

        Assert.False(ok);
        Assert.Null(structure);
        Assert.NotNull(parseError);
    }
}

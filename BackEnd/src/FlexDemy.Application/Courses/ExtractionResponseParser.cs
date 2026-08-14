using System.Text.Json;
using System.Text.Json.Serialization;
using FlexDemy.Application.Common;

namespace FlexDemy.Application.Courses;

// Story 2.8/Task 2: pure, static response validation -- no I/O, no DI. A malformed or
// schema-incomplete AI response is this story's own "low-confidence output" analog to Story
// 2.7's AC#2 and must route to Failed, not a silent empty/broken structure being saved.
public static class ExtractionResponseParser
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static bool TryParse(string aiContent, out ProposedStructure? structure, out string? parseError)
    {
        structure = null;

        var stripped = AiResponseTextUtils.StripCodeFence(aiContent);

        RawStructure? raw;
        try
        {
            raw = JsonSerializer.Deserialize<RawStructure>(stripped, JsonOptions);
        }
        catch (JsonException ex)
        {
            parseError = $"AI response was not valid JSON: {ex.Message}";
            return false;
        }

        if (raw?.Chapters is not { Count: > 0 })
        {
            parseError = "AI response had no chapters.";
            return false;
        }

        // Code-review patch: tracked across the whole tree -- a response where every
        // chapter/topic/subtopic has a title but nothing under it contains any actual content
        // must not pass as a "validated" structure. Checked once, after the tree is fully built.
        var hasAnyContentBlock = false;

        var chapters = new List<ProposedChapter>();
        foreach (var rawChapter in raw.Chapters)
        {
            // Code-review patch: an AI response with a null array element ("chapters":[null])
            // must fail cleanly here, not throw a NullReferenceException on rawChapter.Title below.
            if (rawChapter is null)
            {
                parseError = "A chapter entry was null.";
                return false;
            }
            if (string.IsNullOrWhiteSpace(rawChapter.Title))
            {
                parseError = "A chapter is missing a title.";
                return false;
            }

            var topics = new List<ProposedTopic>();
            foreach (var rawTopic in rawChapter.Topics ?? [])
            {
                if (rawTopic is null)
                {
                    parseError = "A topic entry was null.";
                    return false;
                }
                if (string.IsNullOrWhiteSpace(rawTopic.Title))
                {
                    parseError = "A topic is missing a title.";
                    return false;
                }
                if (!TryValidateContentBlocks(rawTopic.ContentBlocks, out var topicBlocks, out parseError))
                    return false;
                hasAnyContentBlock |= topicBlocks.Count > 0;

                var subtopics = new List<ProposedSubtopic>();
                foreach (var rawSubtopic in rawTopic.Subtopics ?? [])
                {
                    if (rawSubtopic is null)
                    {
                        parseError = "A subtopic entry was null.";
                        return false;
                    }
                    if (string.IsNullOrWhiteSpace(rawSubtopic.Title))
                    {
                        parseError = "A subtopic is missing a title.";
                        return false;
                    }
                    if (!TryValidateContentBlocks(rawSubtopic.ContentBlocks, out var subtopicBlocks, out parseError))
                        return false;
                    hasAnyContentBlock |= subtopicBlocks.Count > 0;

                    subtopics.Add(new ProposedSubtopic(rawSubtopic.Title, subtopicBlocks));
                }

                topics.Add(new ProposedTopic(rawTopic.Title, topicBlocks, subtopics));
            }

            chapters.Add(new ProposedChapter(rawChapter.Title, topics));
        }

        if (!hasAnyContentBlock)
        {
            parseError = "Extraction produced titles but no actual content blocks anywhere in the structure.";
            return false;
        }

        structure = new ProposedStructure(chapters);
        parseError = null;
        return true;
    }

    // A format-conditional check, not just "is this field present": a format="text" block with
    // no text, or a format="math" block with no notation, is exactly as unusable as one that
    // fails to parse at all -- passing it through as "validated" would undercut the whole
    // re-serialization guarantee this parser exists to provide.
    private static bool TryValidateContentBlocks(IReadOnlyList<RawContentBlock?>? rawBlocks, out IReadOnlyList<ProposedContentBlock> blocks, out string? parseError)
    {
        var validated = new List<ProposedContentBlock>();
        foreach (var rawBlock in rawBlocks ?? [])
        {
            if (rawBlock is null)
            {
                blocks = [];
                parseError = "A content block entry was null.";
                return false;
            }

            switch (rawBlock.Format)
            {
                // Code-review patch: IsNullOrWhiteSpace, not IsNullOrEmpty -- a whitespace-only
                // "text"/"notation" value (e.g. " ") is functionally blank and must fail the same
                // way a genuinely empty one does.
                case "text" when string.IsNullOrWhiteSpace(rawBlock.Text):
                    blocks = [];
                    parseError = "A 'text' content block is missing its text.";
                    return false;
                case "math" when string.IsNullOrWhiteSpace(rawBlock.Notation):
                    blocks = [];
                    parseError = "A 'math' content block is missing its notation.";
                    return false;
                case not ("text" or "math"):
                    blocks = [];
                    parseError = $"Unsupported content block format '{rawBlock.Format}'.";
                    return false;
            }

            var lang = rawBlock.Lang is "en" or "hi" ? rawBlock.Lang : "en";
            validated.Add(new ProposedContentBlock(rawBlock.Format, rawBlock.Text, lang, rawBlock.Notation));
        }

        blocks = validated;
        parseError = null;
        return true;
    }

    // Wire-shape DTOs for deserialization only -- deliberately nullable/loose so a malformed
    // response fails TryParse's own validation, not JSON deserialization itself.
    private sealed record RawStructure([property: JsonPropertyName("chapters")] IReadOnlyList<RawChapter?>? Chapters);
    private sealed record RawChapter(
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("topics")] IReadOnlyList<RawTopic?>? Topics);
    private sealed record RawTopic(
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("contentBlocks")] IReadOnlyList<RawContentBlock?>? ContentBlocks,
        [property: JsonPropertyName("subtopics")] IReadOnlyList<RawSubtopic?>? Subtopics);
    private sealed record RawSubtopic(
        [property: JsonPropertyName("title")] string? Title,
        [property: JsonPropertyName("contentBlocks")] IReadOnlyList<RawContentBlock?>? ContentBlocks);
    private sealed record RawContentBlock(
        [property: JsonPropertyName("format")] string Format,
        [property: JsonPropertyName("text")] string? Text,
        [property: JsonPropertyName("lang")] string? Lang,
        [property: JsonPropertyName("notation")] string? Notation);
}

// Public, validated output shape -- matches the JSON schema exactly (not the real Domain/Courses
// entities, which don't exist as EF-mapped types with this shape until Story 2.9). No IDs, no
// confirmation state -- both are Story 2.9's concern at materialization time.
public sealed record ProposedStructure([property: JsonPropertyName("chapters")] IReadOnlyList<ProposedChapter> Chapters);

public sealed record ProposedChapter(
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("topics")] IReadOnlyList<ProposedTopic> Topics);

public sealed record ProposedTopic(
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("contentBlocks")] IReadOnlyList<ProposedContentBlock> ContentBlocks,
    [property: JsonPropertyName("subtopics")] IReadOnlyList<ProposedSubtopic> Subtopics);

public sealed record ProposedSubtopic(
    [property: JsonPropertyName("title")] string Title,
    [property: JsonPropertyName("contentBlocks")] IReadOnlyList<ProposedContentBlock> ContentBlocks);

public sealed record ProposedContentBlock(
    [property: JsonPropertyName("format")] string Format,
    [property: JsonPropertyName("text")] string? Text,
    [property: JsonPropertyName("lang")] string? Lang,
    [property: JsonPropertyName("notation")] string? Notation);

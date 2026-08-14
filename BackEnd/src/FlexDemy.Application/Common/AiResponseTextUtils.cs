namespace FlexDemy.Application.Common;

// Shared by AdaptiveLearningResponseParser and ExtractionResponseParser -- both parsers had a
// byte-for-byte identical private StripCodeFence helper (each stripping a ```/```json fence a
// real-world AI response wraps its JSON/text payload in, even when it isn't the very first thing
// in the response, e.g. a model prepending "Here's the JSON:" before the fence). Extracted here
// once rather than kept duplicated per-parser.
public static class AiResponseTextUtils
{
    public static string StripCodeFence(string content)
    {
        var trimmed = content.Trim();
        var fenceStart = trimmed.IndexOf("```", StringComparison.Ordinal);
        if (fenceStart < 0)
            return trimmed;

        var afterOpeningMarker = trimmed[(fenceStart + 3)..];
        // A language tag ("json") may follow the opening marker on the same line -- skip past it
        // if a newline follows; otherwise treat everything after the marker as the fenced content
        // itself (a same-line fence with no language tag/newline).
        var firstNewline = afterOpeningMarker.IndexOf('\n');
        var fencedContent = firstNewline >= 0 ? afterOpeningMarker[(firstNewline + 1)..] : afterOpeningMarker;

        var closingFenceIndex = fencedContent.LastIndexOf("```", StringComparison.Ordinal);
        return (closingFenceIndex >= 0 ? fencedContent[..closingFenceIndex] : fencedContent).Trim();
    }
}

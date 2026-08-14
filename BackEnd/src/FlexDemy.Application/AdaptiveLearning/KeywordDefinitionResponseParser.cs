namespace FlexDemy.Application.AdaptiveLearning;

// Extracted from the former AdaptiveLearningResponseParser (Drill-Down/Ways/Exercises removed
// along with the Chapter/Topic/Subtopic tree) -- the one parser KeywordDefinitionService still
// needs. A keyword definition is a single short string, not a nested JSON schema, so this just
// trims and length-caps rather than deserializing JSON.
public static class KeywordDefinitionResponseParser
{
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
}

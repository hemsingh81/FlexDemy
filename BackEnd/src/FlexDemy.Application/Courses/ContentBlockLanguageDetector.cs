namespace FlexDemy.Application.Courses;

// Story 2.10/Task 1: a plain code heuristic, deliberately NOT an AI Task -- no gateway call, no
// cost/availability failure mode, no budget reservation. Script detection (is there a Devanagari
// code point anywhere in this text?), not language-model inference.
public static class ContentBlockLanguageDetector
{
    // Unicode Devanagari block (U+0900-U+097F) -- expressed as numeric code points, not literal
    // characters, so the range is unambiguous regardless of this source file's own encoding.
    private const char DevanagariBlockStart = (char)0x0900;
    private const char DevanagariBlockEnd = (char)0x097F;

    // [ASSUMPTION: a single Devanagari code point anywhere in the text is enough to classify the
    // whole block as "hi", not a majority-of-characters threshold -- reasonable for this project's
    // stated v1 scope (English and Hindi only, PRD §6.2), where a mixed-script content block is
    // more realistically "this is the Hindi block" than "mostly English with a stray character";
    // confirm during dev if real content proves this too aggressive.]
    public static bool DetectsHindi(string? text)
    {
        if (string.IsNullOrEmpty(text))
            return false;

        foreach (var c in text)
        {
            if (c is >= DevanagariBlockStart and <= DevanagariBlockEnd)
                return true;
        }

        return false;
    }
}

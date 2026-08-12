using FlexDemy.Application.Courses;
using Xunit;

namespace FlexDemy.Application.Tests.Courses;

public class ContentBlockLanguageDetectorTests
{
    [Fact]
    public void DetectsHindi_returns_false_for_pure_English_text()
    {
        Assert.False(ContentBlockLanguageDetector.DetectsHindi("A wave transfers energy without transferring matter."));
    }

    [Fact]
    public void DetectsHindi_returns_true_when_text_contains_a_Devanagari_character()
    {
        Assert.True(ContentBlockLanguageDetector.DetectsHindi("तरंग ऊर्जा को स्थानांतरित करती है, पदार्थ को नहीं।"));
    }

    [Fact]
    public void DetectsHindi_returns_true_for_mixed_English_and_Devanagari_text()
    {
        Assert.True(ContentBlockLanguageDetector.DetectsHindi("This wave (तरंग) transfers energy."));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void DetectsHindi_returns_false_for_empty_or_null_text(string? text)
    {
        Assert.False(ContentBlockLanguageDetector.DetectsHindi(text));
    }

    [Fact]
    public void DetectsHindi_returns_false_for_a_different_Unicode_script_block()
    {
        // Bengali ("অ", U+0985) and Gurmukhi ("ਅ", U+0A05) both sit outside U+0900-U+097F --
        // confirms the range check is exact, not a loose "looks non-Latin" heuristic.
        Assert.False(ContentBlockLanguageDetector.DetectsHindi("অ"));
        Assert.False(ContentBlockLanguageDetector.DetectsHindi("ਅ"));
    }
}

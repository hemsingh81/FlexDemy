using FlexDemy.Application.Courses;
using Xunit;

namespace FlexDemy.Application.Tests.Courses;

public class ExtractionPromptBuilderTests
{
    [Fact]
    public void BuildMessages_includes_the_supplied_parsedContent_verbatim_in_the_user_message()
    {
        var messages = ExtractionPromptBuilder.BuildMessages("# Chapter 1\nSome parsed course content.");

        var userMessage = Assert.Single(messages, m => m.Role == "user");
        Assert.Equal("# Chapter 1\nSome parsed course content.", userMessage.Content);
    }

    [Fact]
    public void BuildMessages_produces_a_system_message_describing_the_schema()
    {
        var messages = ExtractionPromptBuilder.BuildMessages("content");

        var systemMessage = Assert.Single(messages, m => m.Role == "system");
        Assert.Contains("chapters", systemMessage.Content);
        Assert.Contains("topics", systemMessage.Content);
        Assert.Contains("subtopics", systemMessage.Content);
        Assert.Contains("contentBlocks", systemMessage.Content);
        Assert.Contains("notation", systemMessage.Content);
    }

    [Fact]
    public void BuildMessages_returns_exactly_two_messages_system_then_user()
    {
        var messages = ExtractionPromptBuilder.BuildMessages("content");

        Assert.Equal(2, messages.Count);
        Assert.Equal("system", messages[0].Role);
        Assert.Equal("user", messages[1].Role);
    }
}

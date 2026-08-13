using FlexDemy.Application.AdaptiveLearning;
using Xunit;

namespace FlexDemy.Application.Tests.AdaptiveLearning;

public class DrilldownPromptBuilderTests
{
    [Fact]
    public void BuildMessages_includes_the_supplied_nodeContent_verbatim_in_the_user_message()
    {
        var messages = DrilldownPromptBuilder.BuildMessages("A wave transfers energy without transferring matter.", 1);

        var userMessage = Assert.Single(messages, m => m.Role == "user");
        Assert.Equal("A wave transfers energy without transferring matter.", userMessage.Content);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(5)]
    public void BuildMessages_includes_the_level_number_in_the_system_message(int level)
    {
        var messages = DrilldownPromptBuilder.BuildMessages("content", level);

        var systemMessage = Assert.Single(messages, m => m.Role == "system");
        Assert.Contains($"Level {level}", systemMessage.Content);
    }

    [Fact]
    public void BuildMessages_describes_the_expected_JSON_schema()
    {
        var messages = DrilldownPromptBuilder.BuildMessages("content", 1);

        var systemMessage = Assert.Single(messages, m => m.Role == "system");
        Assert.Contains("title", systemMessage.Content);
        Assert.Contains("subtitle", systemMessage.Content);
        Assert.Contains("keyPoints", systemMessage.Content);
        Assert.Contains("mathFormulas", systemMessage.Content);
        Assert.Contains("examples", systemMessage.Content);
    }

    [Fact]
    public void BuildMessages_returns_exactly_two_messages_system_then_user()
    {
        var messages = DrilldownPromptBuilder.BuildMessages("content", 1);

        Assert.Equal(2, messages.Count);
        Assert.Equal("system", messages[0].Role);
        Assert.Equal("user", messages[1].Role);
    }
}

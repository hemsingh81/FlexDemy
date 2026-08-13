using FlexDemy.Application.AdaptiveLearning;
using Xunit;

namespace FlexDemy.Application.Tests.AdaptiveLearning;

public class WaysPromptBuilderTests
{
    [Fact]
    public void BuildMessages_includes_the_supplied_nodeContent_verbatim_in_the_user_message()
    {
        var messages = WaysPromptBuilder.BuildMessages("A wave transfers energy without transferring matter.", 1);

        var userMessage = Assert.Single(messages, m => m.Role == "user");
        Assert.Equal("A wave transfers energy without transferring matter.", userMessage.Content);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(5)]
    public void BuildMessages_includes_the_way_number_in_the_system_message(int wayNumber)
    {
        var messages = WaysPromptBuilder.BuildMessages("content", wayNumber);

        var systemMessage = Assert.Single(messages, m => m.Role == "system");
        Assert.Contains($"Way {wayNumber}", systemMessage.Content);
    }

    [Fact]
    public void BuildMessages_describes_the_expected_JSON_schema()
    {
        var messages = WaysPromptBuilder.BuildMessages("content", 1);

        var systemMessage = Assert.Single(messages, m => m.Role == "system");
        Assert.Contains("explanation", systemMessage.Content);
        Assert.Contains("example", systemMessage.Content);
        Assert.Contains("stepByStepSolution", systemMessage.Content);
    }

    [Fact]
    public void BuildMessages_returns_exactly_two_messages_system_then_user()
    {
        var messages = WaysPromptBuilder.BuildMessages("content", 1);

        Assert.Equal(2, messages.Count);
        Assert.Equal("system", messages[0].Role);
        Assert.Equal("user", messages[1].Role);
    }
}

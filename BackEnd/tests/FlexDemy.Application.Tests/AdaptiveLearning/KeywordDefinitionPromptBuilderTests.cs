using FlexDemy.Application.AdaptiveLearning;
using Xunit;

namespace FlexDemy.Application.Tests.AdaptiveLearning;

public class KeywordDefinitionPromptBuilderTests
{
    [Fact]
    public void BuildMessages_includes_the_keyword_verbatim_in_the_user_message()
    {
        var messages = KeywordDefinitionPromptBuilder.BuildMessages("wavelength", "Physics");

        var userMessage = Assert.Single(messages, m => m.Role == "user");
        Assert.Equal("wavelength", userMessage.Content);
    }

    [Fact]
    public void BuildMessages_includes_the_courseSubject_in_the_system_message()
    {
        var messages = KeywordDefinitionPromptBuilder.BuildMessages("wavelength", "Chemistry");

        var systemMessage = Assert.Single(messages, m => m.Role == "system");
        Assert.Contains("Chemistry", systemMessage.Content);
    }

    [Fact]
    public void BuildMessages_produces_a_different_system_message_for_a_different_subject_so_the_same_keyword_can_diverge()
    {
        var physicsMessages = KeywordDefinitionPromptBuilder.BuildMessages("wavelength", "Physics");
        var chemistryMessages = KeywordDefinitionPromptBuilder.BuildMessages("wavelength", "Chemistry");

        var physicsSystem = physicsMessages.Single(m => m.Role == "system").Content;
        var chemistrySystem = chemistryMessages.Single(m => m.Role == "system").Content;

        Assert.NotEqual(physicsSystem, chemistrySystem);
    }

    [Fact]
    public void BuildMessages_returns_exactly_two_messages_system_then_user()
    {
        var messages = KeywordDefinitionPromptBuilder.BuildMessages("wavelength", "Physics");

        Assert.Equal(2, messages.Count);
        Assert.Equal("system", messages[0].Role);
        Assert.Equal("user", messages[1].Role);
    }
}

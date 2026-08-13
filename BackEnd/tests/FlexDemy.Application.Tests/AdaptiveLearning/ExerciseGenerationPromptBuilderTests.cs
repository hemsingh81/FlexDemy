using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Domain.AdaptiveLearning;
using Xunit;

namespace FlexDemy.Application.Tests.AdaptiveLearning;

public class ExerciseGenerationPromptBuilderTests
{
    [Fact]
    public void BuildMessages_includes_the_supplied_nodeContent_verbatim_in_the_user_message()
    {
        var messages = ExerciseGenerationPromptBuilder.BuildMessages("A wave transfers energy.", AnswerType.Numeric);

        var userMessage = Assert.Single(messages, m => m.Role == "user");
        Assert.Equal("A wave transfers energy.", userMessage.Content);
    }

    [Theory]
    [InlineData(AnswerType.MultipleChoice)]
    [InlineData(AnswerType.Numeric)]
    [InlineData(AnswerType.ShortText)]
    public void BuildMessages_includes_the_requested_answerType_in_the_system_message(AnswerType answerType)
    {
        var messages = ExerciseGenerationPromptBuilder.BuildMessages("content", answerType);

        var systemMessage = Assert.Single(messages, m => m.Role == "system");
        Assert.Contains(answerType.ToString(), systemMessage.Content);
    }

    [Fact]
    public void BuildMessages_describes_the_expected_JSON_schema()
    {
        var messages = ExerciseGenerationPromptBuilder.BuildMessages("content", AnswerType.MultipleChoice);

        var systemMessage = Assert.Single(messages, m => m.Role == "system");
        Assert.Contains("questionText", systemMessage.Content);
        Assert.Contains("correctAnswer", systemMessage.Content);
        Assert.Contains("feedbackText", systemMessage.Content);
        Assert.Contains("options", systemMessage.Content);
    }

    [Fact]
    public void BuildMessages_returns_exactly_two_messages_system_then_user()
    {
        var messages = ExerciseGenerationPromptBuilder.BuildMessages("content", AnswerType.ShortText);

        Assert.Equal(2, messages.Count);
        Assert.Equal("system", messages[0].Role);
        Assert.Equal("user", messages[1].Role);
    }
}

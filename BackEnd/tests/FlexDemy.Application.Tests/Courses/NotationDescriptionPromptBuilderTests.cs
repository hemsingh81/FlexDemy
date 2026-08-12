using FlexDemy.Application.Courses;
using Xunit;

namespace FlexDemy.Application.Tests.Courses;

public class NotationDescriptionPromptBuilderTests
{
    [Fact]
    public void BuildMessages_includes_the_supplied_notation_in_the_user_message()
    {
        var messages = NotationDescriptionPromptBuilder.BuildMessages("v = f\\lambda");

        Assert.Contains(messages, m => m.Role == "user" && m.Content == "v = f\\lambda");
    }

    [Fact]
    public void BuildMessages_includes_a_system_message()
    {
        var messages = NotationDescriptionPromptBuilder.BuildMessages("\\ce{2H2 + O2 -> 2H2O}");

        Assert.Contains(messages, m => m.Role == "system");
    }
}

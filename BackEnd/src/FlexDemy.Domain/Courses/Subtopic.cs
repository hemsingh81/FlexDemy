using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Courses;

// AD-20: explicit typed entity with a real FK, same shape as Topic/Chapter. Exact spelling
// "Subtopic" (one word, not "SubTopic") is the pinned wire contract -- FrontEnd/src/types.ts's
// ContentOwnerType union (introduced by Story 7.3) must match this class name verbatim.
public class Subtopic : AuditableEntity
{
    public const int TitleMaxLength = 200;
    public const int DescriptionMaxLength = 2000;

    public required string TopicId { get; set; }
    public required string Title { get; set; }
    public string Description { get; set; } = string.Empty;
    public int Order { get; set; }
    public bool IsConfirmed { get; set; }
}

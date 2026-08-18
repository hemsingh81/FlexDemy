using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Courses;

// AD-20: explicit typed entity with a real FK, same shape as Chapter (Story 7.1) -- only
// Page/Resource (Story 7.3/8.1) use polymorphic OwnerType/OwnerId ownership.
public class Topic : AuditableEntity
{
    public const int TitleMaxLength = 200;
    public const int DescriptionMaxLength = 2000;

    public required string ChapterId { get; set; }
    public required string Title { get; set; }
    public string Description { get; set; } = string.Empty;
    public int Order { get; set; }
    public bool IsConfirmed { get; set; }
}

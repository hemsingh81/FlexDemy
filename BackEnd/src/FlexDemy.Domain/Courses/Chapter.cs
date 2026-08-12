using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Courses;

// Persistence-ignorant POCO (AD-4). AD-20: one of the four explicit Chapter/Topic/Subtopic/
// ContentBlock entity types.
public class Chapter : AuditableEntity
{
    public required string CourseId { get; set; }
    public required string Title { get; set; }
    public NodeConfirmation Confirmation { get; set; } = NodeConfirmation.Unconfirmed;
    // Explicit sibling-ordering column, not implicit array position -- a real EF-mapped List<T>
    // navigation has no guaranteed persisted order unless a column drives it. Mirrors
    // CourseThumbnail.Order's already-established pattern (Story 2.4).
    public int Order { get; set; }
    public List<Topic> Topics { get; set; } = [];
}

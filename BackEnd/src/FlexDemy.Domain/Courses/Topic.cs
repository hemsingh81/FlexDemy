using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Courses;

public class Topic : AuditableEntity
{
    public required string ChapterId { get; set; }
    public required string Title { get; set; }
    public NodeConfirmation Confirmation { get; set; } = NodeConfirmation.Unconfirmed;
    public int Order { get; set; }
    public List<Subtopic> Subtopics { get; set; } = [];
    // AD-20 explicitly allows a Content Block to parent directly under a Topic, not only under a
    // Subtopic (matching useCourseContentTree.ts's own Topic.contentBlocks field).
    public List<ContentBlock> ContentBlocks { get; set; } = [];
}

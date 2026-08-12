using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Courses;

public class Subtopic : AuditableEntity
{
    public required string TopicId { get; set; }
    public required string Title { get; set; }
    public NodeConfirmation Confirmation { get; set; } = NodeConfirmation.Unconfirmed;
    public int Order { get; set; }
    public List<ContentBlock> ContentBlocks { get; set; } = [];
}

using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Courses;

public class ContentBlock : AuditableEntity
{
    // Exactly one of these two must be set, never both, never neither -- an app-level invariant
    // enforced in ContentTreeService, not a DB constraint (see that service's own validation).
    public string? TopicId { get; set; }
    public string? SubtopicId { get; set; }
    public ContentBlockFormat Format { get; set; } = ContentBlockFormat.Text;
    public NodeConfirmation Confirmation { get; set; } = NodeConfirmation.Unconfirmed;
    public int Order { get; set; }
    // Every field nullable/optional exactly matching ContentBlock's real TypeScript shape --
    // which fields are populated depends on Format.
    public string? Text { get; set; }
    public string? Lang { get; set; }
    public string? Notation { get; set; }
    public string? ImageUrl { get; set; }
    public string? AltText { get; set; }
}

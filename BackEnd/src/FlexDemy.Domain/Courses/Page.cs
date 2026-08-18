using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Courses;

// AD-20's explicit trade-off: Page (and later Resource) use a polymorphic OwnerType/OwnerId
// instead of a real FK -- a Page can attach to a Chapter, Topic, or Subtopic (FR-2), which a
// single typed FK can't express. Cascade-delete is a service-layer responsibility, never
// ON DELETE CASCADE, same as Topic/Subtopic's own service-layer cascade.
public class Page : AuditableEntity
{
    public const int TitleMaxLength = 200;

    public required ContentOwnerType OwnerType { get; set; }
    public required string OwnerId { get; set; }
    public required string Title { get; set; }
    // DD-3's existing posture: unvalidated `text` passthrough, not re-validated server-side
    // beyond length bounds (there are none here -- Markdown body size is unbounded by design).
    public string BodyMarkdown { get; set; } = string.Empty;
    public int Order { get; set; }
    public bool IsConfirmed { get; set; }
}

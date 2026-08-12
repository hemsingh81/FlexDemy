namespace FlexDemy.Domain.Courses;

// Plain POCO, persistence-ignorant (AD-4). Not an AuditableEntity -- a thumbnail has no
// independent audit trail; its lifecycle is entirely scoped to its parent Course.
public class CourseThumbnail
{
    public required string Id { get; set; }
    public required string CourseId { get; set; }
    public required string Url { get; set; }
    public bool IsPrimary { get; set; }
    public int Order { get; set; }
    public decimal CropX { get; set; }
    public decimal CropY { get; set; }
    public decimal CropZoom { get; set; }
}

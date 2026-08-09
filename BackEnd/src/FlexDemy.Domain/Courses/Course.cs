namespace FlexDemy.Domain.Courses;

// Persistence-ignorant POCO (ARCHITECTURE-SPINE.md AD-4) -- no EF Core attributes here.
// Table/column mapping lives in Infrastructure/Persistence/Configurations/CourseConfiguration.cs.
public class Course
{
    public required string Id { get; set; }
    public required string Title { get; set; }
    public string ShortDescription { get; set; } = string.Empty;
    public string FullDescription { get; set; } = string.Empty;
    public required string Subject { get; set; }
    public required string Level { get; set; }
    public required string TargetGradeTag { get; set; }
    public List<string> Tags { get; set; } = [];
    public required string InstructorName { get; set; }
    public string? InstructorRole { get; set; }
    public string? InstructorAvatar { get; set; }
    public decimal Rating { get; set; } = 5.0m;
    public int EnrolledCount { get; set; }
    public int EstimatedHours { get; set; } = 1;
    public string? ThumbnailUrl { get; set; }
    public string? BadgeIcon { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

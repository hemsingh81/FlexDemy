using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Courses;

// Persistence-ignorant POCO (ARCHITECTURE-SPINE.md AD-4) -- no EF Core attributes here.
// Table/column mapping lives in Infrastructure/Persistence/Configurations/CourseConfiguration.cs.
// Id/IsActive/CreatedAt/CreatedBy/UpdatedAt/UpdatedBy/IsDeleted come from AuditableEntity.
public class Course : AuditableEntity
{
    // FR-6/AC#2 (Story 2.4): server-side twin of the frontend's COURSE_TITLE_MAX_LENGTH.
    public const int TitleMaxLength = 120;

    public required string Title { get; set; }
    public string ShortDescription { get; set; } = string.Empty;
    public string FullDescription { get; set; } = string.Empty;
    // Deliberately relaxed from `required` (Story 2.4): a wizard-created Draft has none of
    // these values yet -- Subject/Level come from Story 2.5's Taxonomy wiring, InstructorName
    // isn't collected by the wizard at all. The DB column stays NOT NULL (CourseConfiguration.cs
    // .IsRequired()); only this compile-time constraint is relaxed. CreateCourseRequest's
    // ToEntity mapper (the original, still-unused-by-any-frontend full-catalog path) is
    // unaffected -- it always supplies these fields anyway.
    public string Subject { get; set; } = string.Empty;
    public string Level { get; set; } = string.Empty;
    public string TargetGradeTag { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = [];
    public string InstructorName { get; set; } = string.Empty;
    public string? InstructorRole { get; set; }
    public string? InstructorAvatar { get; set; }
    public decimal Rating { get; set; } = 5.0m;
    public int EnrolledCount { get; set; }
    public int EstimatedHours { get; set; } = 1;
    // Legacy single-URL field, kept for pre-Story-2.4 seeded rows. CourseMapper.ToDto derives
    // the DTO's ThumbnailUrl from the primary Thumbnails entry when one exists, else falls back
    // to this value -- existing catalog consumers of CourseDto.ThumbnailUrl are unaffected.
    public string? ThumbnailUrl { get; set; }
    public string? BadgeIcon { get; set; }

    // Story 2.4 additions --
    public LifecycleState LifecycleState { get; set; } = LifecycleState.Draft;
    // Owning tutor's User.Id (ICurrentUserService.UserId). Nullable: pre-existing seeded
    // catalog courses have no tutor.
    public string? TutorId { get; set; }
    public List<CourseThumbnail> Thumbnails { get; set; } = [];

    // Story 2.5 additions -- the wizard's real Tag/Taxonomy selections. Deliberately new,
    // parallel fields, NOT a repurposing of the legacy `Tags`/`Subject`/`Level` strings above
    // (those belong to the old pre-Epic-2 catalog shape and its still-untouched
    // CreateCourseRequest path; see this story's Dev Notes for why they coexist unreconciled).
    // No EF navigation/FK relationship -- loosely-coupled reference ids only, matching the
    // existing, unenforced TutorId convention.
    public List<string> TagIds { get; set; } = [];
    public string? CountryId { get; set; }
    public string? StateId { get; set; }
    public string? CityId { get; set; }
    public string? BoardId { get; set; }
    public string? ClassLevelId { get; set; }
    public string? SubjectId { get; set; }
}

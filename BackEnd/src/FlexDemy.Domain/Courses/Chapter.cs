using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.Courses;

// Persistence-ignorant POCO (ARCHITECTURE-SPINE.md AD-4) -- no EF Core attributes here.
// Table/column mapping lives in Infrastructure/Persistence/Configurations/ChapterConfiguration.cs.
// AD-20: Chapter is an explicit typed entity with a real FK to Course -- only Page/Resource
// (introduced by later stories) use polymorphic OwnerType/OwnerId ownership.
public class Chapter : AuditableEntity
{
    // FR-4: node Name field, ≤200 chars.
    public const int TitleMaxLength = 200;
    // FR-4: node Description field, ≤2000 chars, Markdown-lite (paragraphs and bullets only).
    public const int DescriptionMaxLength = 2000;

    public required string CourseId { get; set; }
    public required string Title { get; set; }
    // Populated by a later story (the Description-zone editor UI) -- the column exists now so
    // this story's DTO shape doesn't need to change when that UI lands.
    public string Description { get; set; } = string.Empty;
    public int Order { get; set; }
    // FR-44/Story 7.4 owns the reset-to-false-on-structural-edit semantics -- this story only
    // needs the column to exist and default correctly for a newly-created Chapter.
    public bool IsConfirmed { get; set; }
}

using FlexDemy.Domain.Courses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity. AD-20: Chapter is an explicit typed entity
// with a real FK to Course (not polymorphic OwnerType/OwnerId -- that's Page/Resource only).
public class ChapterConfiguration : IEntityTypeConfiguration<Chapter>
{
    public void Configure(EntityTypeBuilder<Chapter> builder)
    {
        builder.ToTable("chapters");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id).HasMaxLength(64);
        builder.Property(c => c.CourseId).HasMaxLength(64).IsRequired();
        builder.Property(c => c.Title).HasMaxLength(Chapter.TitleMaxLength).IsRequired();
        builder.Property(c => c.Description).HasMaxLength(Chapter.DescriptionMaxLength).IsRequired();

        builder.HasIndex(c => c.CourseId);

        // Matches every other AuditableEntity-backed configuration in this codebase
        // (CourseConfiguration, CourseFileConfiguration, etc.) -- soft-deleted rows are excluded
        // globally, no repository/service needs to remember to filter them itself.
        builder.HasQueryFilter(c => !c.IsDeleted);
    }
}

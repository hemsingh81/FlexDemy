using FlexDemy.Domain.Courses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class ChapterConfiguration : IEntityTypeConfiguration<Chapter>
{
    public void Configure(EntityTypeBuilder<Chapter> builder)
    {
        builder.ToTable("chapters");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id).HasMaxLength(64);
        builder.Property(c => c.CourseId).HasMaxLength(64).IsRequired();
        builder.Property(c => c.Title).HasMaxLength(255).IsRequired();
        builder.Property(c => c.Confirmation).HasConversion<string>().HasMaxLength(32).IsRequired();

        // A tutor deleting a Chapter must cascade-delete every Topic/Subtopic/ContentBlock
        // beneath it at the database level, matching useCourseContentTree.ts's own comment.
        builder.HasOne<Course>().WithMany().HasForeignKey(c => c.CourseId).OnDelete(DeleteBehavior.Cascade);
        builder.HasMany(c => c.Topics).WithOne().HasForeignKey(t => t.ChapterId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(c => c.CourseId);
        builder.HasQueryFilter(c => !c.IsDeleted);
    }
}

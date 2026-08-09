using FlexDemy.Domain.Courses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity; table/column names come from the
// EFCore.NamingConventions snake_case convention registered on the DbContext, matching
// BACKEND_PRD.md's courses table -- no per-property .HasColumnName() needed here.
public class CourseConfiguration : IEntityTypeConfiguration<Course>
{
    public void Configure(EntityTypeBuilder<Course> builder)
    {
        builder.ToTable("courses");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id).HasMaxLength(64);
        builder.Property(c => c.Title).HasMaxLength(255).IsRequired();
        builder.Property(c => c.Subject).HasMaxLength(64).IsRequired();
        builder.Property(c => c.Level).HasMaxLength(32).IsRequired();
        builder.Property(c => c.TargetGradeTag).HasMaxLength(64).IsRequired();
        builder.Property(c => c.InstructorName).HasMaxLength(255).IsRequired();
        builder.Property(c => c.InstructorRole).HasMaxLength(255);
        builder.Property(c => c.Rating).HasPrecision(3, 2);
        builder.Property(c => c.BadgeIcon).HasMaxLength(64);
    }
}

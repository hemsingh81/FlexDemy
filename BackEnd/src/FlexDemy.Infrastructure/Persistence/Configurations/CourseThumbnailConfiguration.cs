using FlexDemy.Domain.Courses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity. The Course <-> CourseThumbnail relationship
// itself is configured on CourseConfiguration.cs's side (HasMany/WithOne).
public class CourseThumbnailConfiguration : IEntityTypeConfiguration<CourseThumbnail>
{
    public void Configure(EntityTypeBuilder<CourseThumbnail> builder)
    {
        builder.ToTable("course_thumbnails");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id).HasMaxLength(64);
        builder.Property(t => t.CourseId).HasMaxLength(64);
        builder.Property(t => t.Url).HasMaxLength(1024).IsRequired();
        builder.Property(t => t.CropX).HasPrecision(5, 2);
        builder.Property(t => t.CropY).HasPrecision(5, 2);
        builder.Property(t => t.CropZoom).HasPrecision(5, 2);
    }
}

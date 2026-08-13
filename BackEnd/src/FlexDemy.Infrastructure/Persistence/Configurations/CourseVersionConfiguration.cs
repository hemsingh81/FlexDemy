using FlexDemy.Domain.AdaptiveLearning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class CourseVersionConfiguration : IEntityTypeConfiguration<CourseVersion>
{
    public void Configure(EntityTypeBuilder<CourseVersion> builder)
    {
        builder.ToTable("course_versions");
        builder.HasKey(v => v.Id);

        builder.Property(v => v.Id).HasMaxLength(64);
        builder.Property(v => v.CourseId).HasMaxLength(64).IsRequired();
        // Deliberately unbounded (no HasMaxLength) -- a full content-tree + adaptive-content
        // snapshot has no natural cap, matching CourseFile.ExtractedStructureJson's precedent.
        builder.Property(v => v.SnapshotJson).IsRequired();
        builder.Property(v => v.PublishedAt).IsRequired();

        builder.HasIndex(v => v.CourseId);
        builder.HasQueryFilter(v => !v.IsDeleted);
    }
}

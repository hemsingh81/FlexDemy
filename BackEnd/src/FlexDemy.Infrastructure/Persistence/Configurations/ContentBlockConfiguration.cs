using FlexDemy.Domain.Courses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class ContentBlockConfiguration : IEntityTypeConfiguration<ContentBlock>
{
    public void Configure(EntityTypeBuilder<ContentBlock> builder)
    {
        builder.ToTable("content_blocks");
        builder.HasKey(cb => cb.Id);

        builder.Property(cb => cb.Id).HasMaxLength(64);
        builder.Property(cb => cb.TopicId).HasMaxLength(64);
        builder.Property(cb => cb.SubtopicId).HasMaxLength(64);
        builder.Property(cb => cb.Format).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(cb => cb.Confirmation).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(cb => cb.Lang).HasMaxLength(8);
        // Text/Notation/ImageUrl/AltText deliberately unbounded (no HasMaxLength) -- authored or
        // AI-extracted content has no natural cap, matching CourseFile.ParsedContent's precedent.

        // Two separate nullable-FK relationships to the same table -- a given row only ever
        // populates one of TopicId/SubtopicId (app-level invariant, see ContentTreeService).
        // The Topic/Subtopic sides of both cascades are configured on TopicConfiguration.cs/
        // SubtopicConfiguration.cs (AD-4's "the parent side owns the HasMany" convention, same as
        // CourseConfiguration.cs owning the Course<->CourseThumbnail relationship).

        builder.HasIndex(cb => cb.TopicId);
        builder.HasIndex(cb => cb.SubtopicId);
        builder.HasQueryFilter(cb => !cb.IsDeleted);
    }
}

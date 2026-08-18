using FlexDemy.Domain.Courses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class ResourceConfiguration : IEntityTypeConfiguration<Resource>
{
    public void Configure(EntityTypeBuilder<Resource> builder)
    {
        builder.ToTable("resources");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id).HasMaxLength(64);
        // .HasConversion<string>() -- not the EF numeric default -- sidesteps ordinal-drift
        // (same convention as Page.OwnerType, AD-20).
        builder.Property(r => r.OwnerType).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(r => r.OwnerId).HasMaxLength(64).IsRequired();
        builder.Property(r => r.CourseFileId).HasMaxLength(64);
        builder.Property(r => r.Label).HasMaxLength(Resource.LabelMaxLength).IsRequired();
        builder.Property(r => r.Caption).HasMaxLength(Resource.CaptionMaxLength);
        builder.Property(r => r.Role).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(r => r.FileName).HasMaxLength(Resource.FileNameMaxLength).IsRequired();
        builder.Property(r => r.ContentType).HasMaxLength(255).IsRequired();
        builder.Property(r => r.StoredUrl).IsRequired();
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(r => r.FailureReason).HasMaxLength(Resource.FailureReasonMaxLength);

        // Real query pattern this story exercises immediately (GetResourcesByOwnerAsync, the
        // 50-per-owner cap check) -- same reasoning as Page's own (OwnerType, OwnerId) index.
        builder.HasIndex(r => new { r.OwnerType, r.OwnerId });
        // Epic 10's FR-23 ("deleting a source file warns it will disappear from any page that
        // attached it") needs to find every Resource referencing a given CourseFileId quickly.
        builder.HasIndex(r => r.CourseFileId);

        builder.HasQueryFilter(r => !r.IsDeleted);
    }
}

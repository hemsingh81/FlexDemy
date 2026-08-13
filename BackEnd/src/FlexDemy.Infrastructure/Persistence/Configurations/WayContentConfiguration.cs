using FlexDemy.Domain.AdaptiveLearning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class WayContentConfiguration : IEntityTypeConfiguration<WayContent>
{
    public void Configure(EntityTypeBuilder<WayContent> builder)
    {
        builder.ToTable("way_contents");
        builder.HasKey(w => w.Id);

        builder.Property(w => w.Id).HasMaxLength(64);
        builder.Property(w => w.TopicId).HasMaxLength(64);
        builder.Property(w => w.SubtopicId).HasMaxLength(64);
        builder.Property(w => w.WayNumber).IsRequired();
        builder.Property(w => w.GeneratedContentJson);
        builder.Property(w => w.OverrideContentJson);

        // Same partial-unique-index reasoning as DrilldownLevelConfiguration.cs -- a plain
        // composite unique index on nullable TopicId/SubtopicId columns would not actually
        // enforce "at most one row per node per way" (NULLs are distinct from each other by
        // default), so this uses the equivalent Postgres partial-index pattern instead.
        builder.HasIndex(w => new { w.TopicId, w.WayNumber })
            .IsUnique()
            .HasFilter("topic_id IS NOT NULL")
            .HasDatabaseName("ix_way_contents_topic_id_way_number");
        builder.HasIndex(w => new { w.SubtopicId, w.WayNumber })
            .IsUnique()
            .HasFilter("subtopic_id IS NOT NULL")
            .HasDatabaseName("ix_way_contents_subtopic_id_way_number");

        builder.HasQueryFilter(w => !w.IsDeleted);
    }
}

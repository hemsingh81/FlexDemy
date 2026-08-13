using FlexDemy.Domain.AdaptiveLearning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class DrilldownLevelConfiguration : IEntityTypeConfiguration<DrilldownLevel>
{
    public void Configure(EntityTypeBuilder<DrilldownLevel> builder)
    {
        builder.ToTable("drilldown_levels");
        builder.HasKey(d => d.Id);

        builder.Property(d => d.Id).HasMaxLength(64);
        builder.Property(d => d.TopicId).HasMaxLength(64);
        builder.Property(d => d.SubtopicId).HasMaxLength(64);
        builder.Property(d => d.LevelNumber).IsRequired();
        // Deliberately unbounded (no HasMaxLength) -- AI-generated/tutor-authored structured
        // content has no natural cap, matching CourseFile.ExtractedStructureJson's precedent.
        builder.Property(d => d.GeneratedContentJson);
        builder.Property(d => d.OverrideContentJson);

        // A literal composite unique index on (TopicId, SubtopicId, LevelNumber) would NOT
        // actually enforce "at most one row per node per level": Postgres (and SQL generally)
        // treats NULL as distinct from every other NULL in a unique index by default, so two rows
        // with TopicId=NULL, SubtopicId='sub1', LevelNumber=1 would NOT collide -- the exact
        // scenario a Subtopic-scoped row hits every time, since its TopicId is always null.
        // Two partial unique indexes (Postgres's well-established pattern for "unique among rows
        // where this column is set") correctly enforce the story's actual stated intent instead.
        builder.HasIndex(d => new { d.TopicId, d.LevelNumber })
            .IsUnique()
            .HasFilter("topic_id IS NOT NULL")
            .HasDatabaseName("ix_drilldown_levels_topic_id_level_number");
        builder.HasIndex(d => new { d.SubtopicId, d.LevelNumber })
            .IsUnique()
            .HasFilter("subtopic_id IS NOT NULL")
            .HasDatabaseName("ix_drilldown_levels_subtopic_id_level_number");

        builder.HasQueryFilter(d => !d.IsDeleted);
    }
}

using FlexDemy.Domain.AdaptiveLearning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class ExerciseConfiguration : IEntityTypeConfiguration<Exercise>
{
    public void Configure(EntityTypeBuilder<Exercise> builder)
    {
        builder.ToTable("exercises");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id).HasMaxLength(64);
        builder.Property(e => e.TopicId).HasMaxLength(64);
        builder.Property(e => e.SubtopicId).HasMaxLength(64);
        builder.Property(e => e.AnswerType).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(e => e.QuestionText).IsRequired();
        builder.Property(e => e.OptionsJson);
        builder.Property(e => e.CorrectAnswer).IsRequired();
        builder.Property(e => e.FeedbackText).IsRequired();

        // Same partial-unique-index reasoning as DrilldownLevelConfiguration.cs/
        // WayContentConfiguration.cs (Story 3.5) -- a plain composite unique index on nullable
        // TopicId/SubtopicId columns would not actually enforce "at most one exercise per node"
        // (NULLs are distinct from each other by default). At most one row per node, no per-level/
        // per-way number component (Story 3.6's scope-correction: one exercise per node, not one
        // per node per level).
        builder.HasIndex(e => e.TopicId)
            .IsUnique()
            .HasFilter("topic_id IS NOT NULL")
            .HasDatabaseName("ix_exercises_topic_id");
        builder.HasIndex(e => e.SubtopicId)
            .IsUnique()
            .HasFilter("subtopic_id IS NOT NULL")
            .HasDatabaseName("ix_exercises_subtopic_id");

        builder.HasQueryFilter(e => !e.IsDeleted);
    }
}

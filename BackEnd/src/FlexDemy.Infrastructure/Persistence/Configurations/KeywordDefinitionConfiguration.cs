using FlexDemy.Domain.AdaptiveLearning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class KeywordDefinitionConfiguration : IEntityTypeConfiguration<KeywordDefinition>
{
    public void Configure(EntityTypeBuilder<KeywordDefinition> builder)
    {
        builder.ToTable("keyword_definitions");
        builder.HasKey(k => k.Id);

        builder.Property(k => k.Id).HasMaxLength(64);
        builder.Property(k => k.CourseId).HasMaxLength(64).IsRequired();
        builder.Property(k => k.Keyword).HasMaxLength(255).IsRequired();
        builder.Property(k => k.NormalizedKeyword).HasMaxLength(255).IsRequired();
        builder.Property(k => k.GeneratedDefinitionText);
        builder.Property(k => k.OverrideDefinitionText);

        // Both CourseId and NormalizedKeyword are non-nullable (unlike Story 3.5/3.6's
        // TopicId?/SubtopicId?), so a plain composite unique index works correctly here -- no
        // NULL-distinctness workaround needed.
        builder.HasIndex(k => new { k.CourseId, k.NormalizedKeyword })
            .IsUnique()
            .HasDatabaseName("ix_keyword_definitions_course_id_normalized_keyword");

        builder.HasQueryFilter(k => !k.IsDeleted);
    }
}

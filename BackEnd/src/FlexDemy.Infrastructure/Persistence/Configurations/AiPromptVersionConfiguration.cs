using FlexDemy.Domain.AiConfig;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class AiPromptVersionConfiguration : IEntityTypeConfiguration<AiPromptVersion>
{
    public void Configure(EntityTypeBuilder<AiPromptVersion> builder)
    {
        builder.ToTable("ai_prompt_versions");
        builder.HasKey(v => v.Id);

        builder.Property(v => v.Id).HasMaxLength(64);
        builder.Property(v => v.TaskId).HasMaxLength(64).IsRequired();
        builder.Property(v => v.PromptText).IsRequired();

        builder.HasIndex(v => new { v.TaskId, v.Version }).IsUnique();

        builder.HasQueryFilter(v => !v.IsDeleted);
    }
}

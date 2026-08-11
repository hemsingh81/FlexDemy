using FlexDemy.Domain.AiConfig;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4/AD-19: one IEntityTypeConfiguration<T> per entity; snake_case column names come from the
// EFCore.NamingConventions convention already registered on the DbContext.
public class AiTaskConfigConfiguration : IEntityTypeConfiguration<AiTaskConfig>
{
    public void Configure(EntityTypeBuilder<AiTaskConfig> builder)
    {
        builder.ToTable("ai_task_configs");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id).HasMaxLength(64);
        builder.Property(c => c.TaskId).HasMaxLength(64).IsRequired();
        builder.Property(c => c.Provider).HasMaxLength(64).IsRequired();
        builder.Property(c => c.Model).HasMaxLength(128).IsRequired();
        builder.Property(c => c.FallbackProvider).HasMaxLength(64).IsRequired();
        builder.Property(c => c.FallbackModel).HasMaxLength(128).IsRequired();
        builder.Property(c => c.BudgetThreshold).HasPrecision(12, 2);
        builder.Property(c => c.PricePerMillionInputTokens).HasPrecision(12, 4);
        builder.Property(c => c.PricePerMillionOutputTokens).HasPrecision(12, 4);
        builder.Property(c => c.FallbackPricePerMillionInputTokens).HasPrecision(12, 4);
        builder.Property(c => c.FallbackPricePerMillionOutputTokens).HasPrecision(12, 4);

        // One row per AI Task -- never a create endpoint, only seeded + updated.
        builder.HasIndex(c => c.TaskId).IsUnique();

        builder.HasQueryFilter(c => !c.IsDeleted);
    }
}

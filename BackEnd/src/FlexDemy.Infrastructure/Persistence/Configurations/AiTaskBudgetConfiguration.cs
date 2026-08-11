using FlexDemy.Domain.AiUsage;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4/AD-18: one IEntityTypeConfiguration<T> per entity; snake_case column names come from the
// EFCore.NamingConventions convention already registered on the DbContext.
public class AiTaskBudgetConfiguration : IEntityTypeConfiguration<AiTaskBudget>
{
    public void Configure(EntityTypeBuilder<AiTaskBudget> builder)
    {
        builder.ToTable("ai_task_budgets");
        builder.HasKey(b => b.Id);

        builder.Property(b => b.Id).HasMaxLength(64);
        builder.Property(b => b.TaskId).HasMaxLength(64).IsRequired();
        // Same precision as AiTaskUsage.Cost -- a single small-token-count invocation's cost can
        // be a small fraction of a cent at typical per-million-token rates.
        builder.Property(b => b.Spent).HasPrecision(12, 6);

        // One row per AI Task -- never a create endpoint, only seeded + adjusted.
        builder.HasIndex(b => b.TaskId).IsUnique();

        builder.HasQueryFilter(b => !b.IsDeleted);
    }
}

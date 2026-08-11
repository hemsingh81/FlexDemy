using FlexDemy.Domain.AiUsage;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4/AD-19: one IEntityTypeConfiguration<T> per entity; snake_case column names come from the
// EFCore.NamingConventions convention already registered on the DbContext.
public class AiTaskUsageConfiguration : IEntityTypeConfiguration<AiTaskUsage>
{
    public void Configure(EntityTypeBuilder<AiTaskUsage> builder)
    {
        builder.ToTable("ai_task_usages");
        builder.HasKey(u => u.Id);

        builder.Property(u => u.Id).HasMaxLength(64);
        builder.Property(u => u.TaskId).HasMaxLength(64).IsRequired();
        builder.Property(u => u.Provider).HasMaxLength(64).IsRequired();
        builder.Property(u => u.Model).HasMaxLength(128).IsRequired();
        builder.Property(u => u.CourseId).HasMaxLength(64);
        builder.Property(u => u.TutorId).HasMaxLength(64);
        // 6 decimal places -- a single small-token-count invocation's cost can be a small fraction
        // of a cent at typical $0.05-$5 per million tokens rates; 2 (BudgetThreshold's precision)
        // would round every cheap call to 0.00.
        builder.Property(u => u.Cost).HasPrecision(12, 6);

        // Many rows per task -- non-unique, unlike AiTaskConfig.TaskId's one-row-per-task index.
        builder.HasIndex(u => u.TaskId);
        // The date-range query (Application/AiUsage/AiUsageService.cs) filters/orders on this.
        builder.HasIndex(u => u.CreatedAt);

        builder.HasQueryFilter(u => !u.IsDeleted);
    }
}

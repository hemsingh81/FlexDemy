using FlexDemy.Domain.ErrorObservability;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity. Story 4.6: single-row table -- no unique
// business key beyond Id, since exactly one row is expected to ever exist (seeded by
// DatabaseSeeder, self-healed by the repository if somehow missing).
public class ErrorRetentionSettingsConfiguration : IEntityTypeConfiguration<ErrorRetentionSettings>
{
    public void Configure(EntityTypeBuilder<ErrorRetentionSettings> builder)
    {
        builder.ToTable("error_retention_settings");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id).HasMaxLength(64);
        builder.Property(s => s.RetentionDays).IsRequired();

        builder.HasQueryFilter(s => !s.IsDeleted);
    }
}

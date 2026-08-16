using FlexDemy.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AC #2: HasIndex(SettingId) supports the per-Setting reverse-chronological history-list query --
// not unique, a Setting has many history rows.
public class SettingChangeHistoryConfiguration : IEntityTypeConfiguration<SettingChangeHistory>
{
    public void Configure(EntityTypeBuilder<SettingChangeHistory> builder)
    {
        builder.ToTable("setting_change_histories");
        builder.HasKey(h => h.Id);

        builder.Property(h => h.Id).HasMaxLength(64);
        builder.Property(h => h.SettingId).HasMaxLength(64).IsRequired();
        builder.Property(h => h.Key).HasMaxLength(64).IsRequired();
        builder.Property(h => h.KeyType).HasMaxLength(64).IsRequired();
        builder.Property(h => h.OldValue).HasMaxLength(256).IsRequired();
        builder.Property(h => h.NewValue).HasMaxLength(256).IsRequired();

        builder.HasIndex(h => h.SettingId);

        builder.HasQueryFilter(h => !h.IsDeleted);
    }
}

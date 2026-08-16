using FlexDemy.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// Story 6.4: Slug is the curated-catalog identifier a FontSize Setting's Value must resolve
// against, mirroring FontPairingDefinitionConfiguration.
public class FontSizeDefinitionConfiguration : IEntityTypeConfiguration<FontSizeDefinition>
{
    public void Configure(EntityTypeBuilder<FontSizeDefinition> builder)
    {
        builder.ToTable("font_size_definitions");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.Id).HasMaxLength(64);
        builder.Property(f => f.Slug).HasMaxLength(64).IsRequired();
        builder.Property(f => f.RootFontScale).HasMaxLength(16).IsRequired();

        builder.HasIndex(f => f.Slug).IsUnique();

        builder.HasQueryFilter(f => !f.IsDeleted);
    }
}

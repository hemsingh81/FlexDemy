using FlexDemy.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-26: Slug is the curated-catalog identifier a Font Setting's Value must resolve against.
public class FontPairingDefinitionConfiguration : IEntityTypeConfiguration<FontPairingDefinition>
{
    public void Configure(EntityTypeBuilder<FontPairingDefinition> builder)
    {
        builder.ToTable("font_pairing_definitions");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.Id).HasMaxLength(64);
        builder.Property(f => f.Slug).HasMaxLength(64).IsRequired();
        builder.Property(f => f.DisplayFont).HasMaxLength(128).IsRequired();
        builder.Property(f => f.BodyFont).HasMaxLength(128).IsRequired();
        builder.Property(f => f.MonoFont).HasMaxLength(128).IsRequired();

        builder.HasIndex(f => f.Slug).IsUnique();

        builder.HasQueryFilter(f => !f.IsDeleted);
    }
}

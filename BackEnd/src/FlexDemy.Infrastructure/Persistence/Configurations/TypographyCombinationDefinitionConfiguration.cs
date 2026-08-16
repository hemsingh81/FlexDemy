using FlexDemy.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// Story 6.5: Slug is the curated-catalog identifier a combo Apply request must resolve against;
// FontPairingSlug/FontSizeSlug are the two referenced curated definitions. Mirrors
// FontPairingDefinitionConfiguration/FontSizeDefinitionConfiguration exactly.
public class TypographyCombinationDefinitionConfiguration : IEntityTypeConfiguration<TypographyCombinationDefinition>
{
    public void Configure(EntityTypeBuilder<TypographyCombinationDefinition> builder)
    {
        builder.ToTable("typography_combination_definitions");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id).HasMaxLength(64);
        builder.Property(t => t.Slug).HasMaxLength(64).IsRequired();
        builder.Property(t => t.Label).HasMaxLength(64).IsRequired();
        builder.Property(t => t.FontPairingSlug).HasMaxLength(64).IsRequired();
        builder.Property(t => t.FontSizeSlug).HasMaxLength(64).IsRequired();

        builder.HasIndex(t => t.Slug).IsUnique();

        builder.HasQueryFilter(t => !t.IsDeleted);
    }
}

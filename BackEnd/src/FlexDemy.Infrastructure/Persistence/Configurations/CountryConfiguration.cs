using FlexDemy.Domain.MasterData;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity; table/column names come from the
// EFCore.NamingConventions snake_case convention registered on the DbContext -- no
// per-property .HasColumnName() needed here.
public class CountryConfiguration : IEntityTypeConfiguration<Country>
{
    public void Configure(EntityTypeBuilder<Country> builder)
    {
        builder.ToTable("countries");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id).HasMaxLength(64);
        builder.Property(c => c.Name).HasMaxLength(255).IsRequired();
        builder.Property(c => c.IsoCode).HasMaxLength(8).IsRequired();

        builder.HasIndex(c => c.IsoCode).IsUnique();

        // Global soft-delete filter: no repository/service needs to remember to exclude
        // deleted rows itself.
        builder.HasQueryFilter(c => !c.IsDeleted);
    }
}

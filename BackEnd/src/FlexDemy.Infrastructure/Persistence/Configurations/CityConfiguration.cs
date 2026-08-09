using FlexDemy.Domain.MasterData;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity. Real DB-level FK to State -- no CLR
// navigation property on the Domain POCO (plan §1/§2).
public class CityConfiguration : IEntityTypeConfiguration<City>
{
    public void Configure(EntityTypeBuilder<City> builder)
    {
        builder.ToTable("cities");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id).HasMaxLength(64);
        builder.Property(c => c.StateId).HasMaxLength(64).IsRequired();
        builder.Property(c => c.Name).HasMaxLength(255).IsRequired();

        builder.HasIndex(c => c.StateId);

        builder.HasOne<State>()
            .WithMany()
            .HasForeignKey(c => c.StateId)
            .OnDelete(DeleteBehavior.Restrict);

        // Global soft-delete filter: no repository/service needs to remember to exclude
        // deleted rows itself.
        builder.HasQueryFilter(c => !c.IsDeleted);
    }
}

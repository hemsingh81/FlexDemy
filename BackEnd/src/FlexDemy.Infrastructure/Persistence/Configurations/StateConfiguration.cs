using FlexDemy.Domain.MasterData;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity. Real DB-level FK to Country -- no CLR
// navigation property on the Domain POCO (plan §1/§2).
public class StateConfiguration : IEntityTypeConfiguration<State>
{
    public void Configure(EntityTypeBuilder<State> builder)
    {
        builder.ToTable("states");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id).HasMaxLength(64);
        builder.Property(s => s.CountryId).HasMaxLength(64).IsRequired();
        builder.Property(s => s.Name).HasMaxLength(255).IsRequired();
        builder.Property(s => s.Code).HasMaxLength(16).IsRequired();

        builder.HasIndex(s => s.CountryId);

        builder.HasOne<Country>()
            .WithMany()
            .HasForeignKey(s => s.CountryId)
            .OnDelete(DeleteBehavior.Restrict);

        // Global soft-delete filter: no repository/service needs to remember to exclude
        // deleted rows itself.
        builder.HasQueryFilter(s => !s.IsDeleted);
    }
}

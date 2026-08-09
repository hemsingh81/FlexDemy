using FlexDemy.Domain.MasterData;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity. StateId is a nullable FK -- set only for
// "<State> State Board" rows, null for national/international boards (plan §1/§2).
public class BoardConfiguration : IEntityTypeConfiguration<Board>
{
    public void Configure(EntityTypeBuilder<Board> builder)
    {
        builder.ToTable("boards");
        builder.HasKey(b => b.Id);

        builder.Property(b => b.Id).HasMaxLength(64);
        builder.Property(b => b.Name).HasMaxLength(255).IsRequired();
        builder.Property(b => b.Code).HasMaxLength(32).IsRequired();
        builder.Property(b => b.StateId).HasMaxLength(64);

        builder.HasIndex(b => b.StateId);

        builder.HasOne<State>()
            .WithMany()
            .HasForeignKey(b => b.StateId)
            .OnDelete(DeleteBehavior.Restrict);

        // Global soft-delete filter: no repository/service needs to remember to exclude
        // deleted rows itself.
        builder.HasQueryFilter(b => !b.IsDeleted);
    }
}

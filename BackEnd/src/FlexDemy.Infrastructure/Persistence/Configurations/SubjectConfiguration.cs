using FlexDemy.Domain.MasterData;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity.
public class SubjectConfiguration : IEntityTypeConfiguration<Subject>
{
    public void Configure(EntityTypeBuilder<Subject> builder)
    {
        builder.ToTable("subjects");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id).HasMaxLength(64);
        builder.Property(s => s.Name).HasMaxLength(128).IsRequired();
        builder.Property(s => s.Stream).HasMaxLength(64);

        // Global soft-delete filter: no repository/service needs to remember to exclude
        // deleted rows itself.
        builder.HasQueryFilter(s => !s.IsDeleted);
    }
}

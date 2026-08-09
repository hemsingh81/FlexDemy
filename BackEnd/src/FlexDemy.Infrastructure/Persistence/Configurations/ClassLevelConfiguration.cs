using FlexDemy.Domain.MasterData;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity.
public class ClassLevelConfiguration : IEntityTypeConfiguration<ClassLevel>
{
    public void Configure(EntityTypeBuilder<ClassLevel> builder)
    {
        builder.ToTable("class_levels");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id).HasMaxLength(64);
        builder.Property(c => c.Name).HasMaxLength(64).IsRequired();

        // Global soft-delete filter: no repository/service needs to remember to exclude
        // deleted rows itself.
        builder.HasQueryFilter(c => !c.IsDeleted);
    }
}

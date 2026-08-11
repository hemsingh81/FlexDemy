using FlexDemy.Domain.Tags;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity; snake_case column names come from the
// EFCore.NamingConventions convention already registered on the DbContext.
public class TagConfiguration : IEntityTypeConfiguration<Tag>
{
    public void Configure(EntityTypeBuilder<Tag> builder)
    {
        builder.ToTable("tags");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id).HasMaxLength(64);
        builder.Property(t => t.Name).HasMaxLength(255).IsRequired();

        // No DB-level unique index on Name -- duplicate prevention is application-level
        // (TagService, via ITagRepository.GetByNameAsync's case-insensitive check). See Story 1.9
        // Dev Notes "Duplicate prevention is application-level, not a DB constraint."
        builder.HasQueryFilter(t => !t.IsDeleted);
    }
}

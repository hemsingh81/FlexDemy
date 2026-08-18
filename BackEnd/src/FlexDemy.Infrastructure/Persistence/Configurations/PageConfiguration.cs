using FlexDemy.Domain.Courses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class PageConfiguration : IEntityTypeConfiguration<Page>
{
    public void Configure(EntityTypeBuilder<Page> builder)
    {
        builder.ToTable("pages");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id).HasMaxLength(64);
        // .HasConversion<string>() -- not the EF numeric default -- sidesteps ordinal-drift
        // (AD-20). Stored as the literal member name ("Chapter"/"Topic"/"Subtopic"/"Page").
        builder.Property(p => p.OwnerType).HasConversion<string>().HasMaxLength(16).IsRequired();
        builder.Property(p => p.OwnerId).HasMaxLength(64).IsRequired();
        builder.Property(p => p.Title).HasMaxLength(Page.TitleMaxLength).IsRequired();
        builder.Property(p => p.BodyMarkdown).IsRequired();

        // No FK/navigation property to Chapter/Topic/Subtopic -- OwnerId is a plain indexed
        // column. Real query pattern this story exercises immediately (the sibling-listing query
        // GetPagesByOwnerAsync), not a speculative index.
        builder.HasIndex(p => new { p.OwnerType, p.OwnerId });

        builder.HasQueryFilter(p => !p.IsDeleted);
    }
}

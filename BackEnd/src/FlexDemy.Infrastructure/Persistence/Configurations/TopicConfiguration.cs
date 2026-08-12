using FlexDemy.Domain.Courses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class TopicConfiguration : IEntityTypeConfiguration<Topic>
{
    public void Configure(EntityTypeBuilder<Topic> builder)
    {
        builder.ToTable("topics");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id).HasMaxLength(64);
        builder.Property(t => t.ChapterId).HasMaxLength(64).IsRequired();
        builder.Property(t => t.Title).HasMaxLength(255).IsRequired();
        builder.Property(t => t.Confirmation).HasConversion<string>().HasMaxLength(32).IsRequired();

        builder.HasMany(t => t.Subtopics).WithOne().HasForeignKey(s => s.TopicId).OnDelete(DeleteBehavior.Cascade);
        // AD-20: a Content Block may parent directly under a Topic (not only under a Subtopic).
        builder.HasMany(t => t.ContentBlocks).WithOne().HasForeignKey(cb => cb.TopicId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(t => t.ChapterId);
        builder.HasQueryFilter(t => !t.IsDeleted);
    }
}

using FlexDemy.Domain.Courses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class SubtopicConfiguration : IEntityTypeConfiguration<Subtopic>
{
    public void Configure(EntityTypeBuilder<Subtopic> builder)
    {
        builder.ToTable("subtopics");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id).HasMaxLength(64);
        builder.Property(s => s.TopicId).HasMaxLength(64).IsRequired();
        builder.Property(s => s.Title).HasMaxLength(255).IsRequired();
        builder.Property(s => s.Confirmation).HasConversion<string>().HasMaxLength(32).IsRequired();

        builder.HasMany(s => s.ContentBlocks).WithOne().HasForeignKey(cb => cb.SubtopicId).OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(s => s.TopicId);
        builder.HasQueryFilter(s => !s.IsDeleted);
    }
}

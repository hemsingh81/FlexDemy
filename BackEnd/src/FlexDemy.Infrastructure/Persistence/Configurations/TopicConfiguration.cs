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
        builder.Property(t => t.Title).HasMaxLength(Topic.TitleMaxLength).IsRequired();
        builder.Property(t => t.Description).HasMaxLength(Topic.DescriptionMaxLength).IsRequired();

        builder.HasIndex(t => t.ChapterId);

        builder.HasQueryFilter(t => !t.IsDeleted);
    }
}

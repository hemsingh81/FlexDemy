using FlexDemy.Domain.AdaptiveLearning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class PublishBatchConfiguration : IEntityTypeConfiguration<PublishBatch>
{
    public void Configure(EntityTypeBuilder<PublishBatch> builder)
    {
        builder.ToTable("publish_batches");
        builder.HasKey(b => b.Id);

        builder.Property(b => b.Id).HasMaxLength(64);
        builder.Property(b => b.CourseId).HasMaxLength(64).IsRequired();
        builder.Property(b => b.TotalNodes).IsRequired();
        builder.Property(b => b.Remaining).IsRequired();

        builder.HasIndex(b => b.CourseId);
        builder.HasQueryFilter(b => !b.IsDeleted);
    }
}

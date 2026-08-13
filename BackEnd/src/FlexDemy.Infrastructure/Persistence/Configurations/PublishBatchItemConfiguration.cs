using FlexDemy.Domain.AdaptiveLearning;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class PublishBatchItemConfiguration : IEntityTypeConfiguration<PublishBatchItem>
{
    public void Configure(EntityTypeBuilder<PublishBatchItem> builder)
    {
        builder.ToTable("publish_batch_items");
        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id).HasMaxLength(64);
        builder.Property(i => i.BatchId).HasMaxLength(64).IsRequired();
        builder.Property(i => i.TopicId).HasMaxLength(64);
        builder.Property(i => i.SubtopicId).HasMaxLength(64);
        builder.Property(i => i.Status).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(i => i.ProgressText);
        builder.Property(i => i.DecrementCommitted).IsRequired();

        // Backs the checklist API's "every item for this batch" read, and the job's own per-item
        // lookup by id (its own primary key, no extra index needed for that).
        builder.HasIndex(i => i.BatchId);
        builder.HasQueryFilter(i => !i.IsDeleted);
    }
}

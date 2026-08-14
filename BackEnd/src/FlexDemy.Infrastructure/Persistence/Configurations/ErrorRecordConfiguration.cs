using FlexDemy.Domain.ErrorObservability;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity. AD-24: indexed on Fingerprint/Category/
// Priority/Status/LastOccurredAt for the admin list view's query shape (Story 4.5, NFR3).
public class ErrorRecordConfiguration : IEntityTypeConfiguration<ErrorRecord>
{
    public void Configure(EntityTypeBuilder<ErrorRecord> builder)
    {
        builder.ToTable("error_records");
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id).HasMaxLength(64);
        builder.Property(r => r.Fingerprint).HasMaxLength(128).IsRequired();
        builder.Property(r => r.Source).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(r => r.Category).HasConversion<string>().HasMaxLength(64).IsRequired();
        builder.Property(r => r.SecondaryCategory).HasConversion<string>().HasMaxLength(64);
        builder.Property(r => r.Priority).HasConversion<string>().HasMaxLength(8).IsRequired();
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(16).IsRequired();

        builder.Property(r => r.Message).HasMaxLength(2048).IsRequired();
        builder.Property(r => r.ExceptionType).HasMaxLength(255);
        // Deliberately unbounded (no HasMaxLength) -- a full stack trace has no natural cap,
        // matching CourseFile.ParsedContent's own unbounded-text precedent. Maps to Postgres `text`.
        builder.Property(r => r.StackTrace);
        builder.Property(r => r.OriginContext).HasMaxLength(255);

        builder.Property(r => r.RelatedEntityType).HasMaxLength(255);
        builder.Property(r => r.RelatedEntityId).HasMaxLength(64);

        builder.Property(r => r.UserId).HasMaxLength(64);
        builder.Property(r => r.RequestPath).HasMaxLength(255);
        builder.Property(r => r.CorrelationId).HasMaxLength(64);

        builder.Property(r => r.ResolvedByUserId).HasMaxLength(64);
        builder.Property(r => r.PriorityIncreasedByUserId).HasMaxLength(64);

        // Code-review patch: unique, not just indexed -- FR-8's "one row per distinct Fingerprint"
        // is a real invariant, not just a query-performance concern; without a DB-level
        // constraint, two concurrent captures of the same brand-new Fingerprint can both pass
        // ErrorCaptureService's read-then-write check and both insert. See
        // ErrorCaptureService.CaptureAsync's race-recovery catch for the corresponding handling.
        builder.HasIndex(r => r.Fingerprint).IsUnique();
        builder.HasIndex(r => r.Category);
        builder.HasIndex(r => r.Priority);
        builder.HasIndex(r => r.Status);
        builder.HasIndex(r => r.LastOccurredAt);
        // Code-review patch (Story 4.7): the trace-view filter (ErrorRecordRepository.QueryAsync's
        // new CorrelationId equality clause) queries this column the same way the indexes above
        // already cover Category/Priority/Status/LastOccurredAt for NFR3.
        builder.HasIndex(r => r.CorrelationId);

        builder.HasQueryFilter(r => !r.IsDeleted);
    }
}

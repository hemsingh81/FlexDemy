using FlexDemy.Domain.Courses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity.
public class CourseFileConfiguration : IEntityTypeConfiguration<CourseFile>
{
    public void Configure(EntityTypeBuilder<CourseFile> builder)
    {
        builder.ToTable("course_files");
        builder.HasKey(f => f.Id);

        builder.Property(f => f.Id).HasMaxLength(64);
        builder.Property(f => f.CourseId).HasMaxLength(64).IsRequired();
        builder.Property(f => f.FileName).HasMaxLength(255).IsRequired();
        builder.Property(f => f.ContentType).HasMaxLength(255).IsRequired();
        builder.Property(f => f.StoredUrl).HasMaxLength(1024).IsRequired();
        builder.Property(f => f.Status).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(f => f.FailureReason).HasMaxLength(1024);
        // Deliberately unbounded (no HasMaxLength) -- a parsed document's text has no natural cap,
        // unlike every other CourseFile column. Maps to Postgres `text`, not `character varying(n)`.
        builder.Property(f => f.ParsedContent);

        builder.HasIndex(f => f.CourseId);

        // Code-review patch: matches every other AuditableEntity-backed configuration in this
        // codebase (CourseConfiguration, UserConfiguration, TagConfiguration, etc.) -- no
        // repository/service needs to remember to exclude soft-deleted rows itself.
        builder.HasQueryFilter(f => !f.IsDeleted);
    }
}

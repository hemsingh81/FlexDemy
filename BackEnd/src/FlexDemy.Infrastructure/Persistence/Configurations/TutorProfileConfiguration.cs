using FlexDemy.Domain.Profiles;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity. SubjectIds is left unconfigured, same as
// Course.Tags (CourseConfiguration.cs) -- Npgsql maps a plain List<string> straight to a
// Postgres text[] column with no explicit mapping needed (plan §1).
public class TutorProfileConfiguration : IEntityTypeConfiguration<TutorProfile>
{
    public void Configure(EntityTypeBuilder<TutorProfile> builder)
    {
        builder.ToTable("tutor_profiles");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id).HasMaxLength(64);
        builder.Property(p => p.UserId).HasMaxLength(64).IsRequired();
        builder.Property(p => p.CountryId).HasMaxLength(64).IsRequired();
        builder.Property(p => p.StateId).HasMaxLength(64).IsRequired();
        builder.Property(p => p.CityId).HasMaxLength(64).IsRequired();
        builder.Property(p => p.ReviewedByUserId).HasMaxLength(64);

        builder.HasIndex(p => p.UserId).IsUnique();

        // Global soft-delete filter: no repository/service needs to remember to exclude
        // deleted rows itself.
        builder.HasQueryFilter(p => !p.IsDeleted);
    }
}

using FlexDemy.Domain.Courses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity; table/column names come from the
// EFCore.NamingConventions snake_case convention registered on the DbContext, matching
// BACKEND_PRD.md's courses table -- no per-property .HasColumnName() needed here.
public class CourseConfiguration : IEntityTypeConfiguration<Course>
{
    public void Configure(EntityTypeBuilder<Course> builder)
    {
        builder.ToTable("courses");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id).HasMaxLength(64);
        builder.Property(c => c.Title).HasMaxLength(255).IsRequired();
        builder.Property(c => c.Subject).HasMaxLength(64).IsRequired();
        builder.Property(c => c.Level).HasMaxLength(32).IsRequired();
        builder.Property(c => c.TargetGradeTag).HasMaxLength(64).IsRequired();
        builder.Property(c => c.InstructorName).HasMaxLength(255).IsRequired();
        builder.Property(c => c.InstructorRole).HasMaxLength(255);
        builder.Property(c => c.Rating).HasPrecision(3, 2);
        builder.Property(c => c.BadgeIcon).HasMaxLength(64);

        // Story 2.4: string conversion (same pattern as User.Role/RolePermission.Role) for a
        // human-legible persisted value. The explicit .HasDefaultValue() is required, not
        // cosmetic -- without it EF derives the migration's column default from default(
        // LifecycleState) (Draft, the enum's zero member, per this exact codebase's own
        // AddUserRole migration precedent for User.Role/UserRole.Student), which would backfill
        // every pre-existing seeded catalog course to Draft and vanish it from the public
        // catalog (GetAllAsync's new Published-only filter, CourseRepository.cs).
        builder.Property(c => c.LifecycleState).HasConversion<string>().HasMaxLength(32).IsRequired().HasDefaultValue(LifecycleState.Published);
        builder.Property(c => c.TutorId).HasMaxLength(64);

        // Story 2.5: the 6 id fields below are nullable, no .HasDefaultValue() -- they don't hit
        // the CLR-default/store-default INSERT-omission gotcha (nothing here configures a store
        // default to omit against). No FK/navigation, matching TutorId.
        //
        // TagIds is different: it's a NOT NULL `List<string>` (NRT-enabled, non-nullable
        // reference type), and this property genuinely does need a store default -- confirmed
        // by actually running this migration against a real Postgres instance with existing
        // course rows: without a default, the generated `ADD COLUMN tag_ids text[] NOT NULL`
        // (no DEFAULT clause) fails outright with "column tag_ids... contains null values" the
        // moment it hits a non-empty table. Unlike LifecycleState, TagIds's default CLR value
        // ([]) is NOT default(List<string>) (which is null, not []) -- the C# property
        // initializer isn't visible to EF's migration-default inference at all, so this needed
        // an explicit default regardless of which array member "looks like" a default, a
        // different root cause from LifecycleState's ordinal-0 issue even though the fix shape
        // looks similar.
        //
        // HasDefaultValueSql("'{}'"), NOT HasDefaultValue(new List<string>()) -- also confirmed
        // by actually running this against a real Postgres instance: HasDefaultValue with a
        // List<string> instance fails EF Core's own startup PendingModelChangesWarning check on
        // every single app start (an unhandled exception, app never comes up) because a *new*
        // List<string>() object is constructed every time OnModelCreating runs, and mutable
        // reference-type default values have no stable value-equality for EF's snapshot
        // comparer to recognize as "unchanged" -- the model looks different from its own
        // snapshot forever, even immediately after a successful migration. HasDefaultValueSql's
        // plain string value has ordinary string equality and doesn't hit this at all.
        builder.Property(c => c.TagIds).HasDefaultValueSql("'{}'");

        builder.Property(c => c.CountryId).HasMaxLength(64);
        builder.Property(c => c.StateId).HasMaxLength(64);
        builder.Property(c => c.CityId).HasMaxLength(64);
        builder.Property(c => c.BoardId).HasMaxLength(64);
        builder.Property(c => c.ClassLevelId).HasMaxLength(64);
        builder.Property(c => c.SubjectId).HasMaxLength(64);

        builder.HasMany(c => c.Thumbnails).WithOne().HasForeignKey(t => t.CourseId).OnDelete(DeleteBehavior.Cascade);

        // Global soft-delete filter: no repository/service needs to remember to exclude
        // deleted rows itself.
        builder.HasQueryFilter(c => !c.IsDeleted);
    }
}

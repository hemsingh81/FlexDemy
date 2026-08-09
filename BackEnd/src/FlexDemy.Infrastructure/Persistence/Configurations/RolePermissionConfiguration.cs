using FlexDemy.Domain.Permissions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

// AD-4: one IEntityTypeConfiguration<T> per entity; table/column names come from the
// EFCore.NamingConventions snake_case convention registered on the DbContext.
public class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> builder)
    {
        builder.ToTable("role_permissions");
        builder.HasKey(rp => rp.Id);

        builder.Property(rp => rp.Id).HasMaxLength(64);
        // Same conversion syntax as User.Role (UserConfiguration.cs) so both map to the same
        // string representation.
        builder.Property(rp => rp.Role).HasConversion<string>().HasMaxLength(32).IsRequired();
        builder.Property(rp => rp.FeatureKey).HasMaxLength(64).IsRequired();

        builder.HasIndex(rp => new { rp.Role, rp.FeatureKey }).IsUnique();

        // Global soft-delete filter: no repository/service needs to remember to exclude
        // deleted rows itself.
        builder.HasQueryFilter(rp => !rp.IsDeleted);
    }
}

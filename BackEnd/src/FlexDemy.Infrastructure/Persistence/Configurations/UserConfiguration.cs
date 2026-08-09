using FlexDemy.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FlexDemy.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");
        builder.HasKey(u => u.Id);

        builder.Property(u => u.Id).HasMaxLength(64);
        builder.Property(u => u.Email).HasMaxLength(255).IsRequired();
        builder.HasIndex(u => u.Email).IsUnique();
        builder.Property(u => u.PasswordHash).IsRequired();
        builder.Property(u => u.FirstName).HasMaxLength(255).IsRequired();
        builder.Property(u => u.LastName).HasMaxLength(255).IsRequired();
        builder.Property(u => u.Role).HasConversion<string>().HasMaxLength(32).IsRequired();

        // Global soft-delete filter: no repository/service needs to remember to exclude
        // deleted rows itself.
        builder.HasQueryFilter(u => !u.IsDeleted);
    }
}

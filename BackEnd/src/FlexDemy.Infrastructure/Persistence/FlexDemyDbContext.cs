using FlexDemy.Domain.Courses;
using FlexDemy.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Persistence;

public class FlexDemyDbContext(DbContextOptions<FlexDemyDbContext> options) : DbContext(options)
{
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(FlexDemyDbContext).Assembly);
    }
}

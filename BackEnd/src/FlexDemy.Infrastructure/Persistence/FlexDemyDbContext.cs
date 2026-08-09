using FlexDemy.Domain.Courses;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Persistence;

public class FlexDemyDbContext(DbContextOptions<FlexDemyDbContext> options) : DbContext(options)
{
    public DbSet<Course> Courses => Set<Course>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(FlexDemyDbContext).Assembly);
    }
}

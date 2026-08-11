using FlexDemy.Domain.AiConfig;
using FlexDemy.Domain.AiUsage;
using FlexDemy.Domain.Courses;
using FlexDemy.Domain.MasterData;
using FlexDemy.Domain.Permissions;
using FlexDemy.Domain.Profiles;
using FlexDemy.Domain.Tags;
using FlexDemy.Domain.Users;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Persistence;

public class FlexDemyDbContext(DbContextOptions<FlexDemyDbContext> options) : DbContext(options)
{
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<User> Users => Set<User>();

    public DbSet<Country> Countries => Set<Country>();
    public DbSet<State> States => Set<State>();
    public DbSet<City> Cities => Set<City>();
    public DbSet<Board> Boards => Set<Board>();
    public DbSet<ClassLevel> ClassLevels => Set<ClassLevel>();
    public DbSet<Subject> Subjects => Set<Subject>();

    public DbSet<StudentProfile> StudentProfiles => Set<StudentProfile>();
    public DbSet<TutorProfile> TutorProfiles => Set<TutorProfile>();

    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();

    public DbSet<AiTaskConfig> AiTaskConfigs => Set<AiTaskConfig>();
    public DbSet<AiPromptVersion> AiPromptVersions => Set<AiPromptVersion>();
    public DbSet<AiTaskUsage> AiTaskUsages => Set<AiTaskUsage>();
    public DbSet<AiTaskBudget> AiTaskBudgets => Set<AiTaskBudget>();

    public DbSet<Tag> Tags => Set<Tag>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(FlexDemyDbContext).Assembly);
    }
}

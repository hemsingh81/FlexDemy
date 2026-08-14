using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Domain.AiConfig;
using FlexDemy.Domain.AiUsage;
using FlexDemy.Domain.Courses;
using FlexDemy.Domain.ErrorObservability;
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
    public DbSet<CourseThumbnail> CourseThumbnails => Set<CourseThumbnail>();
    public DbSet<CourseFile> CourseFiles => Set<CourseFile>();
    public DbSet<Chapter> Chapters => Set<Chapter>();
    public DbSet<Topic> Topics => Set<Topic>();
    public DbSet<Subtopic> Subtopics => Set<Subtopic>();
    public DbSet<ContentBlock> ContentBlocks => Set<ContentBlock>();
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

    public DbSet<DrilldownLevel> DrilldownLevels => Set<DrilldownLevel>();
    public DbSet<WayContent> WayContents => Set<WayContent>();
    public DbSet<Exercise> Exercises => Set<Exercise>();
    public DbSet<KeywordDefinition> KeywordDefinitions => Set<KeywordDefinition>();
    public DbSet<PublishBatch> PublishBatches => Set<PublishBatch>();
    public DbSet<PublishBatchItem> PublishBatchItems => Set<PublishBatchItem>();
    public DbSet<CourseVersion> CourseVersions => Set<CourseVersion>();

    public DbSet<ErrorRecord> ErrorRecords => Set<ErrorRecord>();
    public DbSet<ErrorRetentionSettings> ErrorRetentionSettings => Set<ErrorRetentionSettings>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(FlexDemyDbContext).Assembly);
    }
}

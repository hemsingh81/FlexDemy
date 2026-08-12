using FlexDemy.Application.AiConfig;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.AiUsage;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Application.Permissions;
using FlexDemy.Application.Profiles;
using FlexDemy.Application.Tags;
using FlexDemy.Application.Users;
using FlexDemy.Infrastructure.AiGateway;
using FlexDemy.Infrastructure.IdGeneration;
using FlexDemy.Infrastructure.Jobs;
using FlexDemy.Infrastructure.Parsing;
using FlexDemy.Infrastructure.Permissions;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Persistence.Interceptors;
using FlexDemy.Infrastructure.Repositories;
using FlexDemy.Infrastructure.Scanning;
using FlexDemy.Infrastructure.Security;
using FlexDemy.Infrastructure.Storage;
using Hangfire;
using Hangfire.PostgreSql;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using MasterDataBoard = FlexDemy.Application.MasterData.Board;
using MasterDataCity = FlexDemy.Application.MasterData.City;
using MasterDataClassLevel = FlexDemy.Application.MasterData.ClassLevel;
using MasterDataCountry = FlexDemy.Application.MasterData.Country;
using MasterDataState = FlexDemy.Application.MasterData.State;
using MasterDataSubject = FlexDemy.Application.MasterData.Subject;

namespace FlexDemy.Infrastructure;

// AD-2: the only DI wired outside Program.cs itself -- called once, from Program.cs.
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Missing ConnectionStrings:Default (env var ConnectionStrings__Default).");

        // IHttpContextAccessor backs HttpContextCurrentUserService; ICurrentUserService is scoped
        // per-request (per-scope for seeding) so AuditSaveChangesInterceptor sees the right caller.
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUserService, HttpContextCurrentUserService>();
        services.AddScoped<AuditSaveChangesInterceptor>();

        // Resolved from DI (not `new`'d up) because the interceptor itself needs ICurrentUserService.
        services.AddDbContext<FlexDemyDbContext>((sp, options) =>
            options.UseNpgsql(connectionString)
                .UseSnakeCaseNamingConvention()
                .AddInterceptors(sp.GetRequiredService<AuditSaveChangesInterceptor>()));

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddSingleton<IIdGenerator, GuidV7IdGenerator>();
        services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        services.AddSingleton<ITokenService, JwtTokenService>();

        services.AddScoped<ICourseRepository, CourseRepository>();
        services.AddScoped<IFileStorageService, LocalFileStorageService>();
        services.AddScoped<IUserRepository, UserRepository>();

        // Story 2.6: Hangfire background jobs (AD-15) -- reuses the existing Postgres instance as
        // the job store, no Redis, no second database. Hangfire's own migrations create its
        // job-store tables automatically on first run, separate from FlexDemyDbContext's EF
        // migrations.
        // Api/Program.cs calls app.UseHangfireServer() in the middleware pipeline (AD-13/the
        // Structural Seed's explicit line) -- not AddHangfireServer() here.
        services.AddHangfire(cfg => cfg.UsePostgreSqlStorage(c => c.UseNpgsqlConnection(connectionString)));

        services.Configure<ClamAvOptions>(configuration.GetSection(ClamAvOptions.SectionName));
        services.AddScoped<IFileScanner, ClamAvFileScanner>();
        services.AddScoped<ICourseFileRepository, CourseFileRepository>();
        services.AddScoped<ICourseFileService, CourseFileService>();
        services.AddScoped<IScanFileJob, ScanFileJob>();
        services.AddScoped<IScanFileJobEnqueuer, ScanFileJobEnqueuer>();

        // Story 2.7: Docling parsing pass, chained straight from ScanFileJob's clean-scan branch.
        services.Configure<DoclingOptions>(configuration.GetSection(DoclingOptions.SectionName));
        services.AddHttpClient<IDocumentParser, DoclingParsingClient>((sp, client) =>
        {
            var doclingOptions = sp.GetRequiredService<IOptions<DoclingOptions>>().Value;
            client.BaseAddress = new Uri(doclingOptions.BaseUrl);
            client.Timeout = TimeSpan.FromSeconds(doclingOptions.TimeoutSeconds);
        });
        services.AddScoped<IParseFileJob, ParseFileJob>();
        services.AddScoped<IParseFileJobEnqueuer, ParseFileJobEnqueuer>();

        // Story 2.8: AI structure extraction, chained straight from ParseFileJob's successful-parse
        // branch. No new HttpClient/options -- this is the first real caller of the already-fully-
        // built IAiTaskGateway (Epic 1, registered in FlexDemy.Application's own DependencyInjection.cs).
        services.AddScoped<IExtractStructureJob, ExtractStructureJob>();
        services.AddScoped<IExtractStructureJobEnqueuer, ExtractStructureJobEnqueuer>();

        // Story 2.9: Content Tree CRUD -- one repository for the whole tree (AD-4 deviation, see
        // IContentTreeRepository.cs), materializing Story 2.8's staged extraction JSON on read.
        services.AddScoped<IContentTreeRepository, ContentTreeRepository>();

        services.AddScoped<IStudentProfileRepository, StudentProfileRepository>();
        services.AddScoped<ITutorProfileRepository, TutorProfileRepository>();

        services.AddScoped<MasterDataCountry.ICountryRepository, CountryRepository>();
        services.AddScoped<MasterDataState.IStateRepository, StateRepository>();
        services.AddScoped<MasterDataCity.ICityRepository, CityRepository>();
        services.AddScoped<MasterDataBoard.IBoardRepository, BoardRepository>();
        services.AddScoped<MasterDataClassLevel.IClassLevelRepository, ClassLevelRepository>();
        services.AddScoped<MasterDataSubject.ISubjectRepository, SubjectRepository>();

        services.AddScoped<IAiTaskConfigRepository, AiTaskConfigRepository>();
        services.AddScoped<IAiTaskUsageRepository, AiTaskUsageRepository>();
        services.AddScoped<IAiTaskBudgetRepository, AiTaskBudgetRepository>();

        services.AddScoped<ITagRepository, TagRepository>();

        // Backs FeatureAuthorizationHandler's dynamic role-permission lookups (plan §3).
        // AddMemoryCache registers IMemoryCache as a singleton; RolePermissionCache itself is
        // Scoped because it depends on IRolePermissionRepository (needs the per-request
        // DbContext) -- see RolePermissionCache's doc comment for why that's still safe to cache
        // across requests.
        services.AddMemoryCache();
        services.AddScoped<IRolePermissionRepository, RolePermissionRepository>();
        services.AddScoped<IRolePermissionCache, RolePermissionCache>();

        // AD-14: typed-client registration -- BaseAddress is set here from AiGatewayOptions
        // (already-bound options instance, not a second raw IConfiguration read). Timeout is set
        // explicitly rather than left at HttpClient's 100s BCL default -- this is a hard
        // dependency for several future features and shouldn't tie up a request thread that long
        // on a hung upstream connection (review finding, 2026-08-11 review).
        services.Configure<AiGatewayOptions>(configuration.GetSection(AiGatewayOptions.SectionName));
        services.AddHttpClient<IAiGateway, PortkeyAiGateway>((sp, client) =>
        {
            var aiGatewayOptions = sp.GetRequiredService<IOptions<AiGatewayOptions>>().Value;
            client.BaseAddress = new Uri(aiGatewayOptions.BaseUrl);
            client.Timeout = TimeSpan.FromSeconds(30);
        });

        return services;
    }
}

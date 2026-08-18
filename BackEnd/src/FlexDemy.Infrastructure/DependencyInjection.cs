using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.AiConfig;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.AiUsage;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Application.Permissions;
using FlexDemy.Application.Profiles;
using FlexDemy.Application.Settings;
using FlexDemy.Application.Tags;
using FlexDemy.Application.Users;
using FlexDemy.Infrastructure.AiGateway;
using FlexDemy.Application.ErrorObservability;
using FlexDemy.Infrastructure.Correlation;
using FlexDemy.Infrastructure.ErrorObservability;
using FlexDemy.Infrastructure.IdGeneration;
using FlexDemy.Infrastructure.Jobs;
using FlexDemy.Infrastructure.Parsing;
using FlexDemy.Infrastructure.Permissions;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Persistence.Interceptors;
using FlexDemy.Infrastructure.Repositories;
using FlexDemy.Infrastructure.Sanitization;
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
        // Story 4.1/AD-23: the backing store is a private `static` AsyncLocal<string?> field, so
        // correctness doesn't actually depend on this being Singleton -- any lifetime would behave
        // identically. Singleton is simply the idiomatic, zero-allocation-per-request choice,
        // matching how IHttpContextAccessor is registered in this same Program.cs.
        services.AddSingleton<ICorrelationIdAccessor, AsyncLocalCorrelationIdAccessor>();
        services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        services.AddSingleton<ITokenService, JwtTokenService>();

        services.AddScoped<ICourseRepository, CourseRepository>();
        services.AddScoped<IContentRepository, ContentRepository>();
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

        // Story 8.1: Resource upload/scan pipeline (mirrors CourseFile's Story 2.6/2.7 pipeline
        // above), plus SVG sanitization for the clean-scan branch.
        services.AddScoped<ISvgSanitizer, SvgSanitizer>();
        services.AddScoped<IScanResourceJob, ScanResourceJob>();
        services.AddScoped<IScanResourceJobEnqueuer, ScanResourceJobEnqueuer>();

        services.AddScoped<IKeywordDefinitionRepository, KeywordDefinitionRepository>();
        services.AddScoped<IVersionRepository, VersionRepository>();

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

        services.AddScoped<ISettingRepository, SettingRepository>();
        services.AddScoped<IFontPairingDefinitionRepository, FontPairingDefinitionRepository>();
        services.AddScoped<IFontSizeDefinitionRepository, FontSizeDefinitionRepository>();
        services.AddScoped<ISettingChangeHistoryRepository, SettingChangeHistoryRepository>();
        services.AddScoped<ITypographyCombinationDefinitionRepository, TypographyCombinationDefinitionRepository>();

        services.AddScoped<ITagRepository, TagRepository>();

        // Story 4.2/AD-24: Scoped, not Singleton -- both depend on IUnitOfWork/DbContext, same
        // lifetime discipline as every other Application service registered here.
        services.AddScoped<IErrorRecordRepository, ErrorRecordRepository>();
        services.AddScoped<IErrorCaptureService, ErrorCaptureService>();
        // Story 4.5: same registration file/lifetime as the rest of this feature's
        // Application-layer services (see comment above).
        services.AddScoped<IErrorAdminService, ErrorAdminService>();
        // Story 4.6/FR-18.
        services.AddScoped<IErrorRetentionSettingsRepository, ErrorRetentionSettingsRepository>();
        // Story 4.6/AC #5: resolved by Hangfire's activator when the recurring job fires
        // (Program.cs's RecurringJob.AddOrUpdate<IPurgeOldErrorRecordsJob>), same Scoped
        // lifetime/DI-resolution path as every other job registered here.
        services.AddScoped<IPurgeOldErrorRecordsJob, PurgeOldErrorRecordsJob>();

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

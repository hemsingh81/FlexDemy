using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Application.Permissions;
using FlexDemy.Application.Profiles;
using FlexDemy.Application.Users;
using FlexDemy.Infrastructure.IdGeneration;
using FlexDemy.Infrastructure.Permissions;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Persistence.Interceptors;
using FlexDemy.Infrastructure.Repositories;
using FlexDemy.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
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
        services.AddScoped<IUserRepository, UserRepository>();

        services.AddScoped<IStudentProfileRepository, StudentProfileRepository>();
        services.AddScoped<ITutorProfileRepository, TutorProfileRepository>();

        services.AddScoped<MasterDataCountry.ICountryRepository, CountryRepository>();
        services.AddScoped<MasterDataState.IStateRepository, StateRepository>();
        services.AddScoped<MasterDataCity.ICityRepository, CityRepository>();
        services.AddScoped<MasterDataBoard.IBoardRepository, BoardRepository>();
        services.AddScoped<MasterDataClassLevel.IClassLevelRepository, ClassLevelRepository>();
        services.AddScoped<MasterDataSubject.ISubjectRepository, SubjectRepository>();

        // Backs FeatureAuthorizationHandler's dynamic role-permission lookups (plan §3).
        // AddMemoryCache registers IMemoryCache as a singleton; RolePermissionCache itself is
        // Scoped because it depends on IRolePermissionRepository (needs the per-request
        // DbContext) -- see RolePermissionCache's doc comment for why that's still safe to cache
        // across requests.
        services.AddMemoryCache();
        services.AddScoped<IRolePermissionRepository, RolePermissionRepository>();
        services.AddScoped<IRolePermissionCache, RolePermissionCache>();

        return services;
    }
}

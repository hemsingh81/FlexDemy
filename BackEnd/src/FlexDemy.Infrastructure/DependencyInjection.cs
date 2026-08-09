using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Infrastructure.IdGeneration;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FlexDemy.Infrastructure;

// AD-2: the only DI wired outside Program.cs itself -- called once, from Program.cs.
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Missing ConnectionStrings:Default (env var ConnectionStrings__Default).");

        services.AddDbContext<FlexDemyDbContext>(options =>
            options.UseNpgsql(connectionString).UseSnakeCaseNamingConvention());

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddSingleton<IIdGenerator, GuidV7IdGenerator>();

        services.AddScoped<ICourseRepository, CourseRepository>();

        return services;
    }
}

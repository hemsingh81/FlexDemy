using FlexDemy.Application.Courses;
using Microsoft.Extensions.DependencyInjection;

namespace FlexDemy.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ICourseService, CourseService>();

        return services;
    }
}

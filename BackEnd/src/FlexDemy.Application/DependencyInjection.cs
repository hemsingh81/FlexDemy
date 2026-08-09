using FlexDemy.Application.Courses;
using FlexDemy.Application.Users;
using Microsoft.Extensions.DependencyInjection;

namespace FlexDemy.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ICourseService, CourseService>();
        services.AddScoped<IUserService, UserService>();

        return services;
    }
}

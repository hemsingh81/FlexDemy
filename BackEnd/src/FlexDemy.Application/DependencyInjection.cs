using FlexDemy.Application.Courses;
using FlexDemy.Application.Permissions;
using FlexDemy.Application.Profiles;
using FlexDemy.Application.Users;
using Microsoft.Extensions.DependencyInjection;
using MasterDataBoard = FlexDemy.Application.MasterData.Board;
using MasterDataCity = FlexDemy.Application.MasterData.City;
using MasterDataClassLevel = FlexDemy.Application.MasterData.ClassLevel;
using MasterDataCountry = FlexDemy.Application.MasterData.Country;
using MasterDataState = FlexDemy.Application.MasterData.State;
using MasterDataSubject = FlexDemy.Application.MasterData.Subject;

namespace FlexDemy.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ICourseService, CourseService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<IRolePermissionService, RolePermissionService>();

        services.AddScoped<MasterDataCountry.ICountryService, MasterDataCountry.CountryService>();
        services.AddScoped<MasterDataState.IStateService, MasterDataState.StateService>();
        services.AddScoped<MasterDataCity.ICityService, MasterDataCity.CityService>();
        services.AddScoped<MasterDataBoard.IBoardService, MasterDataBoard.BoardService>();
        services.AddScoped<MasterDataClassLevel.IClassLevelService, MasterDataClassLevel.ClassLevelService>();
        services.AddScoped<MasterDataSubject.ISubjectService, MasterDataSubject.SubjectService>();

        return services;
    }
}

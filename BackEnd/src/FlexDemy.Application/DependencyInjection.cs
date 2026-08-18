using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.AiConfig;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.AiUsage;
using FlexDemy.Application.Courses;
using FlexDemy.Application.Permissions;
using FlexDemy.Application.Profiles;
using FlexDemy.Application.Settings;
using FlexDemy.Application.Tags;
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
        services.AddScoped<IContentService, ContentService>();
        services.AddScoped<IKeywordDefinitionService, KeywordDefinitionService>();
        services.AddScoped<IVersionService, VersionService>();
        services.AddScoped<IPublishService, PublishService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IProfileService, ProfileService>();
        services.AddScoped<IRolePermissionService, RolePermissionService>();

        services.AddScoped<MasterDataCountry.ICountryService, MasterDataCountry.CountryService>();
        services.AddScoped<MasterDataState.IStateService, MasterDataState.StateService>();
        services.AddScoped<MasterDataCity.ICityService, MasterDataCity.CityService>();
        services.AddScoped<MasterDataBoard.IBoardService, MasterDataBoard.BoardService>();
        services.AddScoped<MasterDataClassLevel.IClassLevelService, MasterDataClassLevel.ClassLevelService>();
        services.AddScoped<MasterDataSubject.ISubjectService, MasterDataSubject.SubjectService>();

        services.AddScoped<IAiConfigService, AiConfigService>();
        services.AddScoped<IAiTaskGateway, AiTaskGateway>();
        services.AddScoped<IAiUsageService, AiUsageService>();
        services.AddScoped<IAiBudgetService, AiBudgetService>();

        services.AddScoped<ITagService, TagService>();

        services.AddScoped<ISettingsService, SettingsService>();

        return services;
    }
}

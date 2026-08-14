using FlexDemy.Api.Authorization;
using FlexDemy.Api.Controllers;
using FlexDemy.Application.Common;
using FlexDemy.Application.ErrorObservability;
using FlexDemy.Application.Permissions;
using FlexDemy.Domain.ErrorObservability;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Xunit;

namespace FlexDemy.Api.Tests.Controllers;

// [Authorize(Policy = FeatureKeys.ErrorsManage)] is a class-level attribute enforced by ASP.NET
// Core's own AuthorizeFilter BEFORE the action runs, not something the action body checks itself
// (unlike AdminUsersController's manual per-action check) -- so it can't be exercised by directly
// constructing/calling ErrorsController the way the tests below do for the action bodies. AC #1's
// 403-vs-200 behavior is instead verified by driving the exact same FeaturePolicyProvider/
// FeatureAuthorizationHandler stack the attribute delegates to, mirroring
// AdminUsersControllerTests' own BuildRealAuthorizationService pattern -- this repo has no
// WebApplicationFactory infra to drive the real HTTP pipeline through instead.
public class ErrorsControllerTests
{
    private static ErrorRecordSummaryDto MakeSummary(string id) => new(
        id, ErrorCategory.SystemInfrastructureError.ToString(), ErrorPriority.P2.ToString(), ErrorStatus.New.ToString(), "boom", ErrorSource.Backend.ToString(), 1, DateTimeOffset.UtcNow);

    private static ErrorsController MakeController(IErrorAdminService errorAdminService, string? currentUserId = "admin_1")
    {
        var currentUserService = Substitute.For<ICurrentUserService>();
        currentUserService.UserId.Returns(currentUserId);
        return new ErrorsController(errorAdminService, currentUserService);
    }

    [Fact]
    public async Task GetList_returns_the_service_result_wrapped_in_200()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        var paged = new PagedResult<ErrorRecordSummaryDto>([MakeSummary("err_1")], 1, 1, 25);
        errorAdminService.GetListAsync(Arg.Any<ErrorListQuery>(), Arg.Any<CancellationToken>()).Returns(paged);
        var controller = MakeController(errorAdminService);

        var result = await controller.GetList(new ErrorListQuery(), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(paged, ok.Value);
    }

    [Fact]
    public async Task GetList_passes_the_bound_query_through_to_the_service_unchanged()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        errorAdminService.GetListAsync(Arg.Any<ErrorListQuery>(), Arg.Any<CancellationToken>())
            .Returns(new PagedResult<ErrorRecordSummaryDto>([], 0, 3, 10));
        var controller = MakeController(errorAdminService);
        var query = new ErrorListQuery { Category = ErrorCategory.ValidationError, Page = 3, PageSize = 10 };

        await controller.GetList(query, CancellationToken.None);

        await errorAdminService.Received(1).GetListAsync(query, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetById_returns_the_service_result_wrapped_in_200()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        var detail = new ErrorRecordDetailDto(
            "err_1", ErrorCategory.SystemInfrastructureError.ToString(), ErrorPriority.P2.ToString(), ErrorStatus.New.ToString(), "boom",
            ErrorSource.Backend.ToString(), 1, DateTimeOffset.UtcNow, null, null, null, DateTimeOffset.UtcNow, null, null, null, null);
        errorAdminService.GetByIdAsync("err_1", Arg.Any<CancellationToken>()).Returns(detail);
        var controller = MakeController(errorAdminService);

        var result = await controller.GetById("err_1", CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(detail, ok.Value);
    }

    [Fact]
    public async Task GetById_propagates_NotFoundException_from_the_service()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        errorAdminService.GetByIdAsync("missing", Arg.Any<CancellationToken>())
            .Returns<ErrorRecordDetailDto>(_ => throw new NotFoundException(nameof(ErrorRecord), "missing"));
        var controller = MakeController(errorAdminService);

        await Assert.ThrowsAsync<NotFoundException>(() => controller.GetById("missing", CancellationToken.None));
    }

    // Story 4.6/AC #1
    [Fact]
    public async Task Archive_calls_the_service_and_returns_204()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        var controller = MakeController(errorAdminService);

        var result = await controller.Archive("err_1", CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        await errorAdminService.Received(1).ArchiveAsync("err_1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Archive_propagates_NotFoundException_from_the_service()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        errorAdminService.ArchiveAsync("missing", Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new NotFoundException(nameof(ErrorRecord), "missing"));
        var controller = MakeController(errorAdminService);

        await Assert.ThrowsAsync<NotFoundException>(() => controller.Archive("missing", CancellationToken.None));
    }

    // Code-review patch: Archive now guards against a redundant same-state transition.
    [Fact]
    public async Task Archive_propagates_ValidationException_from_the_service()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        errorAdminService.ArchiveAsync("err_1", Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new ValidationException("This error is already archived."));
        var controller = MakeController(errorAdminService);

        await Assert.ThrowsAsync<ValidationException>(() => controller.Archive("err_1", CancellationToken.None));
    }

    // AC #2: the acting admin's id is sourced from ICurrentUserService (the fixed convention --
    // see Story 4.3's own code-review patch for why raw ClaimTypes lookup was replaced with this
    // abstraction), not read ad hoc off HttpContext.User in the action itself.
    [Fact]
    public async Task Resolve_calls_the_service_with_the_current_user_id_and_returns_204()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        var controller = MakeController(errorAdminService, currentUserId: "admin_42");

        var result = await controller.Resolve("err_1", CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        await errorAdminService.Received(1).ResolveAsync("err_1", "admin_42", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Resolve_propagates_NotFoundException_from_the_service()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        errorAdminService.ResolveAsync("missing", Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new NotFoundException(nameof(ErrorRecord), "missing"));
        var controller = MakeController(errorAdminService);

        await Assert.ThrowsAsync<NotFoundException>(() => controller.Resolve("missing", CancellationToken.None));
    }

    // Code-review patch: Resolve now guards against a redundant same-state transition.
    [Fact]
    public async Task Resolve_propagates_ValidationException_from_the_service()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        errorAdminService.ResolveAsync("err_1", Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new ValidationException("This error is already resolved."));
        var controller = MakeController(errorAdminService);

        await Assert.ThrowsAsync<ValidationException>(() => controller.Resolve("err_1", CancellationToken.None));
    }

    // AC #4
    [Fact]
    public async Task IncreasePriority_calls_the_service_with_the_current_user_id_and_returns_204()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        var controller = MakeController(errorAdminService, currentUserId: "admin_42");

        var result = await controller.IncreasePriority("err_1", CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        await errorAdminService.Received(1).IncreasePriorityAsync("err_1", "admin_42", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task IncreasePriority_propagates_ValidationException_from_the_service()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        errorAdminService.IncreasePriorityAsync("err_1", Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new ValidationException("Already at the highest priority (P0)."));
        var controller = MakeController(errorAdminService);

        await Assert.ThrowsAsync<ValidationException>(() => controller.IncreasePriority("err_1", CancellationToken.None));
    }

    [Fact]
    public async Task IncreasePriority_propagates_NotFoundException_from_the_service()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        errorAdminService.IncreasePriorityAsync("missing", Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new NotFoundException(nameof(ErrorRecord), "missing"));
        var controller = MakeController(errorAdminService);

        await Assert.ThrowsAsync<NotFoundException>(() => controller.IncreasePriority("missing", CancellationToken.None));
    }

    [Fact]
    public async Task Delete_calls_the_service_and_returns_204()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        var controller = MakeController(errorAdminService);

        var result = await controller.Delete("err_1", CancellationToken.None);

        Assert.IsType<NoContentResult>(result);
        await errorAdminService.Received(1).DeleteAsync("err_1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_propagates_NotFoundException_from_the_service()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        errorAdminService.DeleteAsync("missing", Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new NotFoundException(nameof(ErrorRecord), "missing"));
        var controller = MakeController(errorAdminService);

        await Assert.ThrowsAsync<NotFoundException>(() => controller.Delete("missing", CancellationToken.None));
    }

    // AC #5
    [Fact]
    public async Task GetRetentionSettings_returns_the_service_result_wrapped_in_200()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        var dto = new ErrorRetentionSettingsDto(90);
        errorAdminService.GetRetentionSettingsAsync(Arg.Any<CancellationToken>()).Returns(dto);
        var controller = MakeController(errorAdminService);

        var result = await controller.GetRetentionSettings(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(dto, ok.Value);
    }

    [Fact]
    public async Task UpdateRetentionSettings_passes_the_value_through_and_returns_the_result_wrapped_in_200()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        var dto = new ErrorRetentionSettingsDto(60);
        errorAdminService.UpdateRetentionSettingsAsync(60, Arg.Any<CancellationToken>()).Returns(dto);
        var controller = MakeController(errorAdminService);

        var result = await controller.UpdateRetentionSettings(new UpdateRetentionSettingsRequest(60), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        Assert.Same(dto, ok.Value);
    }

    [Fact]
    public async Task UpdateRetentionSettings_propagates_ValidationException_from_the_service()
    {
        var errorAdminService = Substitute.For<IErrorAdminService>();
        errorAdminService.UpdateRetentionSettingsAsync(0, Arg.Any<CancellationToken>())
            .Returns<ErrorRetentionSettingsDto>(_ => throw new ValidationException("Retention days must be greater than zero."));
        var controller = MakeController(errorAdminService);

        await Assert.ThrowsAsync<ValidationException>(
            () => controller.UpdateRetentionSettings(new UpdateRetentionSettingsRequest(0), CancellationToken.None));
    }

    // AC #1: "a new FeatureKeys.ErrorsManage policy seeded Master-only... a non-Master user
    // calls the admin API directly, they receive 403... a Master admin... [is] visible."
    private static IAuthorizationService BuildRealAuthorizationService(IRolePermissionCache cache)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAuthorization();
        services.AddSingleton<IAuthorizationPolicyProvider, FeaturePolicyProvider>();
        services.AddScoped<IAuthorizationHandler, FeatureAuthorizationHandler>();
        services.AddSingleton(cache);
        return services.BuildServiceProvider().GetRequiredService<IAuthorizationService>();
    }

    private static System.Security.Claims.ClaimsPrincipal MakePrincipal(UserRole role)
    {
        var identity = new System.Security.Claims.ClaimsIdentity(authenticationType: "TestAuth");
        identity.AddClaim(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, role.ToString()));
        return new System.Security.Claims.ClaimsPrincipal(identity);
    }

    [Fact]
    public async Task A_Master_user_is_authorized_for_ErrorsManage()
    {
        // No explicit true row needed -- FeatureAuthorizationHandler's Master bypass succeeds
        // unconditionally, before any cache lookup (the real seeded matrix works the same way).
        var cache = Substitute.For<IRolePermissionCache>();
        cache.IsVisibleAsync(Arg.Any<UserRole>(), Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(false);
        var authorizationService = BuildRealAuthorizationService(cache);

        var result = await authorizationService.AuthorizeAsync(MakePrincipal(UserRole.Master), null, FeatureKeys.ErrorsManage);

        Assert.True(result.Succeeded);
    }

    [Theory]
    [InlineData(UserRole.Student)]
    [InlineData(UserRole.Tutor)]
    [InlineData(UserRole.Support)]
    public async Task A_non_Master_user_is_not_authorized_for_ErrorsManage_matching_the_Master_only_seed(UserRole role)
    {
        // Mirrors the real seeded matrix (RolePermissionSeedData): only Master has an explicit
        // true row for errors.manage -- every other role falls through to the fail-closed default.
        var cache = Substitute.For<IRolePermissionCache>();
        cache.IsVisibleAsync(Arg.Any<UserRole>(), Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(false);
        var authorizationService = BuildRealAuthorizationService(cache);

        var result = await authorizationService.AuthorizeAsync(MakePrincipal(role), null, FeatureKeys.ErrorsManage);

        Assert.False(result.Succeeded);
    }
}

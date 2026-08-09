using System.Security.Claims;
using FlexDemy.Api.Authorization;
using FlexDemy.Api.Controllers;
using FlexDemy.Application.Permissions;
using FlexDemy.Application.Users;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using Xunit;

namespace FlexDemy.Api.Tests.Controllers;

// PUT /api/v1/admin/users/{id}/status is gated with a bare [Authorize] and does its real,
// differentiated authorization manually in the action (see AdminUsersController): the required
// policy depends on the TARGET user's role, not the caller's, and Support/Master targets other
// than Support/Tutor are rejected outright. These tests exercise that boundary through the real
// production authorization pipeline (FeaturePolicyProvider + FeatureAuthorizationHandler, wired
// up via a genuine IAuthorizationService from DI) rather than stubbing the branch directly, so
// they catch a regression in either the controller's branching *or* the underlying policy
// wiring -- only IRolePermissionCache (the DB-backed piece) is substituted, mirroring the
// default seeded matrix: AdminUsersCreate = Master only, TutorApprove = Master+Support.
public class AdminUsersControllerTests
{
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

    private static IRolePermissionCache DefaultSeededCache()
    {
        // Mirrors the default role-permission seed: AdminUsersCreate visible to nobody but
        // Master (which the handler bypasses unconditionally); TutorApprove visible to Support
        // too (matches ProfilesController's tutor-review endpoints).
        var cache = Substitute.For<IRolePermissionCache>();
        cache.IsVisibleAsync(Arg.Any<UserRole>(), Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(false);
        cache.IsVisibleAsync(UserRole.Support, FeatureKeys.TutorApprove, Arg.Any<CancellationToken>()).Returns(true);
        return cache;
    }

    private static UserDto MakeTargetDto(string role) => new("target_1", "target@x.com", "Target", "User", role, true);

    private static AdminUsersController MakeController(IUserService userService, IAuthorizationService authorizationService, UserRole callerRole)
    {
        var identity = new ClaimsIdentity(authenticationType: "TestAuth");
        identity.AddClaim(new Claim(ClaimTypes.Role, callerRole.ToString()));
        var principal = new ClaimsPrincipal(identity);

        return new AdminUsersController(userService, authorizationService)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = principal } },
        };
    }

    [Fact]
    public async Task Master_can_deactivate_a_Support_user()
    {
        var userService = Substitute.For<IUserService>();
        userService.GetByIdAsync("target_1", Arg.Any<CancellationToken>()).Returns(MakeTargetDto(nameof(UserRole.Support)));
        userService.SetUserActiveStatusAsync("target_1", false, Arg.Any<CancellationToken>())
            .Returns(MakeTargetDto(nameof(UserRole.Support)) with { IsActive = false });
        var controller = MakeController(userService, BuildRealAuthorizationService(DefaultSeededCache()), UserRole.Master);

        var result = await controller.SetUserActiveStatus("target_1", new SetUserActiveStatusRequest(false), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
        await userService.Received(1).SetUserActiveStatusAsync("target_1", false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Master_can_deactivate_a_Tutor_user()
    {
        var userService = Substitute.For<IUserService>();
        userService.GetByIdAsync("target_1", Arg.Any<CancellationToken>()).Returns(MakeTargetDto(nameof(UserRole.Tutor)));
        userService.SetUserActiveStatusAsync("target_1", false, Arg.Any<CancellationToken>())
            .Returns(MakeTargetDto(nameof(UserRole.Tutor)) with { IsActive = false });
        var controller = MakeController(userService, BuildRealAuthorizationService(DefaultSeededCache()), UserRole.Master);

        var result = await controller.SetUserActiveStatus("target_1", new SetUserActiveStatusRequest(false), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
        await userService.Received(1).SetUserActiveStatusAsync("target_1", false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Support_can_deactivate_a_Tutor_user()
    {
        var userService = Substitute.For<IUserService>();
        userService.GetByIdAsync("target_1", Arg.Any<CancellationToken>()).Returns(MakeTargetDto(nameof(UserRole.Tutor)));
        userService.SetUserActiveStatusAsync("target_1", false, Arg.Any<CancellationToken>())
            .Returns(MakeTargetDto(nameof(UserRole.Tutor)) with { IsActive = false });
        var controller = MakeController(userService, BuildRealAuthorizationService(DefaultSeededCache()), UserRole.Support);

        var result = await controller.SetUserActiveStatus("target_1", new SetUserActiveStatusRequest(false), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
        await userService.Received(1).SetUserActiveStatusAsync("target_1", false, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Support_cannot_deactivate_a_Support_user()
    {
        var userService = Substitute.For<IUserService>();
        userService.GetByIdAsync("target_1", Arg.Any<CancellationToken>()).Returns(MakeTargetDto(nameof(UserRole.Support)));
        var controller = MakeController(userService, BuildRealAuthorizationService(DefaultSeededCache()), UserRole.Support);

        var result = await controller.SetUserActiveStatus("target_1", new SetUserActiveStatusRequest(false), CancellationToken.None);

        Assert.IsType<ForbidResult>(result.Result);
        await userService.DidNotReceive().SetUserActiveStatusAsync(Arg.Any<string>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Tutor_cannot_deactivate_another_Tutor()
    {
        var userService = Substitute.For<IUserService>();
        userService.GetByIdAsync("target_1", Arg.Any<CancellationToken>()).Returns(MakeTargetDto(nameof(UserRole.Tutor)));
        var controller = MakeController(userService, BuildRealAuthorizationService(DefaultSeededCache()), UserRole.Tutor);

        var result = await controller.SetUserActiveStatus("target_1", new SetUserActiveStatusRequest(false), CancellationToken.None);

        Assert.IsType<ForbidResult>(result.Result);
        await userService.DidNotReceive().SetUserActiveStatusAsync(Arg.Any<string>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(nameof(UserRole.Student))]
    [InlineData(nameof(UserRole.Master))]
    [InlineData(nameof(UserRole.Unassigned))]
    public async Task Nobody_can_use_this_endpoint_against_a_Student_Master_or_Unassigned_account_even_Master(string targetRole)
    {
        var userService = Substitute.For<IUserService>();
        userService.GetByIdAsync("target_1", Arg.Any<CancellationToken>()).Returns(MakeTargetDto(targetRole));
        // Caller is Master -- the strongest possible caller -- to prove the target-role check is
        // unconditional and not merely "caller lacks permission."
        var controller = MakeController(userService, BuildRealAuthorizationService(DefaultSeededCache()), UserRole.Master);

        var result = await controller.SetUserActiveStatus("target_1", new SetUserActiveStatusRequest(false), CancellationToken.None);

        Assert.IsType<ForbidResult>(result.Result);
        await userService.DidNotReceive().SetUserActiveStatusAsync(Arg.Any<string>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
    }

    // PUT /api/v1/admin/users/{id}/details -- same bare-[Authorize]-plus-manual-check shape as
    // /status above, but only Support targets are wired to a policy today (Tutor editing isn't
    // scoped through this endpoint yet), so even Master can't use it against a Tutor target.
    private static UpdateUserDetailsRequest MakeDetailsRequest() => new("Jane", "Doe", "jane@x.com");

    [Fact]
    public async Task Master_can_edit_a_Support_user()
    {
        var userService = Substitute.For<IUserService>();
        userService.GetByIdAsync("target_1", Arg.Any<CancellationToken>()).Returns(MakeTargetDto(nameof(UserRole.Support)));
        userService.UpdateUserDetailsAsync("target_1", Arg.Any<UpdateUserDetailsRequest>(), Arg.Any<CancellationToken>())
            .Returns(MakeTargetDto(nameof(UserRole.Support)) with { FirstName = "Jane", LastName = "Doe", Email = "jane@x.com" });
        var controller = MakeController(userService, BuildRealAuthorizationService(DefaultSeededCache()), UserRole.Master);

        var result = await controller.UpdateUserDetails("target_1", MakeDetailsRequest(), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
        await userService.Received(1).UpdateUserDetailsAsync("target_1", Arg.Any<UpdateUserDetailsRequest>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Support_cannot_edit_another_Support_user()
    {
        var userService = Substitute.For<IUserService>();
        userService.GetByIdAsync("target_1", Arg.Any<CancellationToken>()).Returns(MakeTargetDto(nameof(UserRole.Support)));
        var controller = MakeController(userService, BuildRealAuthorizationService(DefaultSeededCache()), UserRole.Support);

        var result = await controller.UpdateUserDetails("target_1", MakeDetailsRequest(), CancellationToken.None);

        Assert.IsType<ForbidResult>(result.Result);
        await userService.DidNotReceive().UpdateUserDetailsAsync(Arg.Any<string>(), Arg.Any<UpdateUserDetailsRequest>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(nameof(UserRole.Student))]
    [InlineData(nameof(UserRole.Tutor))]
    [InlineData(nameof(UserRole.Master))]
    [InlineData(nameof(UserRole.Unassigned))]
    public async Task Nobody_can_edit_a_Student_Tutor_Master_or_Unassigned_account_through_this_endpoint_even_Master(string targetRole)
    {
        var userService = Substitute.For<IUserService>();
        userService.GetByIdAsync("target_1", Arg.Any<CancellationToken>()).Returns(MakeTargetDto(targetRole));
        var controller = MakeController(userService, BuildRealAuthorizationService(DefaultSeededCache()), UserRole.Master);

        var result = await controller.UpdateUserDetails("target_1", MakeDetailsRequest(), CancellationToken.None);

        Assert.IsType<ForbidResult>(result.Result);
        await userService.DidNotReceive().UpdateUserDetailsAsync(Arg.Any<string>(), Arg.Any<UpdateUserDetailsRequest>(), Arg.Any<CancellationToken>());
    }
}

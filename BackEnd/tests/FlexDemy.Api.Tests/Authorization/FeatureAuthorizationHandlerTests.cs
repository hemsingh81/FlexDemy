using System.Security.Claims;
using FlexDemy.Api.Authorization;
using FlexDemy.Application.Permissions;
using FlexDemy.Domain.Users;
using Microsoft.AspNetCore.Authorization;
using NSubstitute;
using Xunit;

namespace FlexDemy.Api.Tests.Authorization;

// This is the safety property the whole dynamic role-permission system depends on (plan §3):
// Master must never be locked out by anything in the permissions table, including an empty or
// deliberately restrictive one. These tests exercise the handler directly against a
// ClaimsPrincipal rather than through a full HTTP pipeline, mirroring how AuthorizationHandler
// subclasses are normally unit-tested.
public class FeatureAuthorizationHandlerTests
{
    private static ClaimsPrincipal MakePrincipal(UserRole? role)
    {
        var identity = new ClaimsIdentity(authenticationType: "TestAuth");
        if (role is not null)
            identity.AddClaim(new Claim(ClaimTypes.Role, role.ToString()!));
        return new ClaimsPrincipal(identity);
    }

    private static AuthorizationHandlerContext MakeContext(ClaimsPrincipal user, FeatureRequirement requirement) =>
        new([requirement], user, resource: null);

    [Fact]
    public async Task Master_always_succeeds_even_when_the_cache_says_not_visible()
    {
        var cache = Substitute.For<IRolePermissionCache>();
        cache.IsVisibleAsync(Arg.Any<UserRole>(), Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(false);
        var handler = new FeatureAuthorizationHandler(cache);
        var requirement = new FeatureRequirement(FeatureKeys.MasterDataManage);
        var context = MakeContext(MakePrincipal(UserRole.Master), requirement);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
        // The lock-out safety net is unconditional -- Master never even consults the cache/DB.
        await cache.DidNotReceive().IsVisibleAsync(Arg.Any<UserRole>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Master_always_succeeds_even_if_the_cache_would_throw()
    {
        // A cache/repository that throws simulates a completely empty or broken permissions
        // store -- Master must still get through without ever touching it, so the substitute
        // is configured to throw and the test asserts it is genuinely never invoked.
        var cache = Substitute.For<IRolePermissionCache>();
        cache.IsVisibleAsync(Arg.Any<UserRole>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns<bool>(_ => throw new InvalidOperationException("should never be called for Master"));
        var handler = new FeatureAuthorizationHandler(cache);
        var requirement = new FeatureRequirement(FeatureKeys.AdminPermissionsManage);
        var context = MakeContext(MakePrincipal(UserRole.Master), requirement);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
        await cache.DidNotReceive().IsVisibleAsync(Arg.Any<UserRole>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NonMaster_succeeds_when_the_cache_says_visible()
    {
        var cache = Substitute.For<IRolePermissionCache>();
        cache.IsVisibleAsync(UserRole.Tutor, FeatureKeys.CoursesCreate, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new FeatureAuthorizationHandler(cache);
        var requirement = new FeatureRequirement(FeatureKeys.CoursesCreate);
        var context = MakeContext(MakePrincipal(UserRole.Tutor), requirement);

        await handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task NonMaster_fails_when_the_cache_says_not_visible()
    {
        var cache = Substitute.For<IRolePermissionCache>();
        cache.IsVisibleAsync(UserRole.Student, FeatureKeys.MasterDataManage, Arg.Any<CancellationToken>()).Returns(false);
        var handler = new FeatureAuthorizationHandler(cache);
        var requirement = new FeatureRequirement(FeatureKeys.MasterDataManage);
        var context = MakeContext(MakePrincipal(UserRole.Student), requirement);

        await handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }

    [Fact]
    public async Task Request_with_no_role_claim_fails()
    {
        var cache = Substitute.For<IRolePermissionCache>();
        var handler = new FeatureAuthorizationHandler(cache);
        var requirement = new FeatureRequirement(FeatureKeys.Dashboard);
        var context = MakeContext(MakePrincipal(role: null), requirement);

        await handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
        await cache.DidNotReceive().IsVisibleAsync(Arg.Any<UserRole>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }
}

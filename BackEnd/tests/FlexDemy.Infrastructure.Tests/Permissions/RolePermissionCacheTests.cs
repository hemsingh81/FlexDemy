using FlexDemy.Application.Permissions;
using FlexDemy.Domain.Permissions;
using FlexDemy.Domain.Users;
using FlexDemy.Infrastructure.Permissions;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Permissions;

public class RolePermissionCacheTests
{
    private static RolePermission MakeRow(UserRole role, string featureKey, bool isVisible) => new()
    {
        Id = $"{role}_{featureKey}",
        Role = role,
        FeatureKey = featureKey,
        IsVisible = isVisible,
    };

    [Fact]
    public async Task IsVisibleAsync_loads_from_the_repository_on_a_cache_miss()
    {
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var repository = Substitute.For<IRolePermissionRepository>();
        repository.GetByRoleAsync(UserRole.Tutor, Arg.Any<CancellationToken>())
            .Returns([MakeRow(UserRole.Tutor, FeatureKeys.CoursesCreate, true)]);
        var sut = new RolePermissionCache(memoryCache, repository);

        var visible = await sut.IsVisibleAsync(UserRole.Tutor, FeatureKeys.CoursesCreate);

        Assert.True(visible);
        await repository.Received(1).GetByRoleAsync(UserRole.Tutor, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task IsVisibleAsync_returns_false_for_a_feature_key_with_no_row_fail_closed()
    {
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var repository = Substitute.For<IRolePermissionRepository>();
        repository.GetByRoleAsync(UserRole.Student, Arg.Any<CancellationToken>())
            .Returns([MakeRow(UserRole.Student, FeatureKeys.Dashboard, true)]);
        var sut = new RolePermissionCache(memoryCache, repository);

        var visible = await sut.IsVisibleAsync(UserRole.Student, FeatureKeys.MasterDataManage);

        Assert.False(visible);
    }

    [Fact]
    public async Task IsVisibleAsync_hits_the_cache_on_a_second_call_and_does_not_requery_the_repository()
    {
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var repository = Substitute.For<IRolePermissionRepository>();
        repository.GetByRoleAsync(UserRole.Support, Arg.Any<CancellationToken>())
            .Returns([MakeRow(UserRole.Support, FeatureKeys.TutorApprove, true)]);
        var sut = new RolePermissionCache(memoryCache, repository);

        await sut.IsVisibleAsync(UserRole.Support, FeatureKeys.TutorApprove);
        await sut.IsVisibleAsync(UserRole.Support, FeatureKeys.TutorApprove);

        await repository.Received(1).GetByRoleAsync(UserRole.Support, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Invalidate_forces_the_next_lookup_to_re_query_the_repository()
    {
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var repository = Substitute.For<IRolePermissionRepository>();
        repository.GetByRoleAsync(UserRole.Master, Arg.Any<CancellationToken>())
            .Returns([MakeRow(UserRole.Master, FeatureKeys.AdminPermissionsManage, true)]);
        var sut = new RolePermissionCache(memoryCache, repository);

        await sut.IsVisibleAsync(UserRole.Master, FeatureKeys.AdminPermissionsManage);
        sut.Invalidate();
        await sut.IsVisibleAsync(UserRole.Master, FeatureKeys.AdminPermissionsManage);

        await repository.Received(2).GetByRoleAsync(UserRole.Master, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Invalidate_picks_up_a_value_change_made_between_the_two_lookups()
    {
        using var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var repository = Substitute.For<IRolePermissionRepository>();
        repository.GetByRoleAsync(UserRole.Tutor, Arg.Any<CancellationToken>())
            .Returns([MakeRow(UserRole.Tutor, FeatureKeys.CoursesCreate, true)]);
        var sut = new RolePermissionCache(memoryCache, repository);

        Assert.True(await sut.IsVisibleAsync(UserRole.Tutor, FeatureKeys.CoursesCreate));

        // Simulate Master flipping Tutor's courses.create off via the admin matrix.
        repository.GetByRoleAsync(UserRole.Tutor, Arg.Any<CancellationToken>())
            .Returns([MakeRow(UserRole.Tutor, FeatureKeys.CoursesCreate, false)]);
        sut.Invalidate();

        Assert.False(await sut.IsVisibleAsync(UserRole.Tutor, FeatureKeys.CoursesCreate));
    }
}

using FlexDemy.Application.Common;
using FlexDemy.Application.Permissions;
using FlexDemy.Domain.Permissions;
using FlexDemy.Domain.Users;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.Permissions;

public class RolePermissionServiceTests
{
    private static RolePermission MakeRow(UserRole role, string featureKey, bool isVisible) => new()
    {
        Id = $"{role}_{featureKey}",
        Role = role,
        FeatureKey = featureKey,
        IsVisible = isVisible,
    };

    [Fact]
    public async Task GetMineAsync_defaults_unconfigured_keys_to_false_fail_closed()
    {
        var repository = Substitute.For<IRolePermissionRepository>();
        // Student has exactly one configured row (dashboard=true); every other key in
        // FeatureKeys.AllKeys has no row at all.
        repository.GetByRoleAsync(UserRole.Student, Arg.Any<CancellationToken>())
            .Returns([MakeRow(UserRole.Student, FeatureKeys.Dashboard, true)]);
        var sut = new RolePermissionService(repository, Substitute.For<IRolePermissionCache>(), Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var result = await sut.GetMineAsync(UserRole.Student);

        Assert.Equal(FeatureKeys.AllKeys.Count, result.Count);
        Assert.True(result[FeatureKeys.Dashboard]);
        // Every other key defaults to false -- no row means "not visible", not "visible".
        foreach (var key in FeatureKeys.AllKeys.Where(k => k != FeatureKeys.Dashboard))
            Assert.False(result[key], $"expected '{key}' to default to false when unconfigured");
    }

    [Fact]
    public async Task GetMineAsync_reflects_an_explicit_false_row_as_not_visible()
    {
        var repository = Substitute.For<IRolePermissionRepository>();
        repository.GetByRoleAsync(UserRole.Tutor, Arg.Any<CancellationToken>())
            .Returns([MakeRow(UserRole.Tutor, FeatureKeys.CoursesCreate, false)]);
        var sut = new RolePermissionService(repository, Substitute.For<IRolePermissionCache>(), Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var result = await sut.GetMineAsync(UserRole.Tutor);

        Assert.False(result[FeatureKeys.CoursesCreate]);
    }

    [Fact]
    public async Task UpdateMatrixAsync_creates_a_new_row_when_none_exists_and_commits_once()
    {
        var repository = Substitute.For<IRolePermissionRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var cache = Substitute.For<IRolePermissionCache>();
        var idGenerator = Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns("rp_new");
        repository.GetByRoleAndKeyAsync(UserRole.Support, FeatureKeys.MasterDataManage, Arg.Any<CancellationToken>())
            .Returns((RolePermission?)null);
        var sut = new RolePermissionService(repository, cache, unitOfWork, idGenerator);

        await sut.UpdateMatrixAsync([new UpdatePermissionRequest("Support", FeatureKeys.MasterDataManage, true)]);

        repository.Received(1).Add(Arg.Is<RolePermission>(rp =>
            rp.Id == "rp_new" && rp.Role == UserRole.Support && rp.FeatureKey == FeatureKeys.MasterDataManage && rp.IsVisible));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateMatrixAsync_updates_an_existing_row_instead_of_creating_a_duplicate()
    {
        var repository = Substitute.For<IRolePermissionRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var existing = MakeRow(UserRole.Master, FeatureKeys.CoursesCreate, true);
        repository.GetByRoleAndKeyAsync(UserRole.Master, FeatureKeys.CoursesCreate, Arg.Any<CancellationToken>())
            .Returns(existing);
        var sut = new RolePermissionService(repository, Substitute.For<IRolePermissionCache>(), unitOfWork, Substitute.For<IIdGenerator>());

        await sut.UpdateMatrixAsync([new UpdatePermissionRequest("Master", FeatureKeys.CoursesCreate, false)]);

        Assert.False(existing.IsVisible);
        repository.DidNotReceive().Add(Arg.Any<RolePermission>());
        repository.Received(1).Update(Arg.Is<RolePermission>(rp => rp == existing && !rp.IsVisible));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateMatrixAsync_invalidates_the_cache_after_committing()
    {
        var repository = Substitute.For<IRolePermissionRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var cache = Substitute.For<IRolePermissionCache>();
        repository.GetByRoleAndKeyAsync(Arg.Any<UserRole>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((RolePermission?)null);
        var sut = new RolePermissionService(repository, cache, unitOfWork, Substitute.For<IIdGenerator>());

        await sut.UpdateMatrixAsync([new UpdatePermissionRequest("Master", FeatureKeys.TutorApprove, true)]);

        cache.Received(1).Invalidate();
    }

    [Fact]
    public async Task UpdateMatrixAsync_throws_ValidationException_for_an_unrecognized_role()
    {
        var repository = Substitute.For<IRolePermissionRepository>();
        var sut = new RolePermissionService(repository, Substitute.For<IRolePermissionCache>(), Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        await Assert.ThrowsAsync<ValidationException>(() =>
            sut.UpdateMatrixAsync([new UpdatePermissionRequest("NotARole", FeatureKeys.Dashboard, true)]));
    }

    [Fact]
    public async Task GetMatrixAsync_defaults_every_unconfigured_role_times_key_combination_to_false()
    {
        var repository = Substitute.For<IRolePermissionRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>())
            .Returns([MakeRow(UserRole.Master, FeatureKeys.AdminPermissionsManage, true)]);
        var sut = new RolePermissionService(repository, Substitute.For<IRolePermissionCache>(), Substitute.For<IUnitOfWork>(), Substitute.For<IIdGenerator>());

        var matrix = await sut.GetMatrixAsync();

        var masterRow = Assert.Single(matrix, r => r.Role == nameof(UserRole.Master) && r.FeatureKey == FeatureKeys.AdminPermissionsManage);
        Assert.True(masterRow.IsVisible);

        // Any other role x key combination not returned by the repository defaults to false.
        var studentCoursesCreate = Assert.Single(matrix, r => r.Role == nameof(UserRole.Student) && r.FeatureKey == FeatureKeys.CoursesCreate);
        Assert.False(studentCoursesCreate.IsVisible);
    }
}

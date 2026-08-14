using FlexDemy.Application.Common;
using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using NSubstitute;

namespace FlexDemy.Application.Tests.ErrorObservability;

public class ErrorAdminServiceTests
{
    private static ErrorRecord MakeRecord(string id) => new()
    {
        Id = id,
        Fingerprint = $"fp_{id}",
        Source = ErrorSource.Backend,
        Category = ErrorCategory.SystemInfrastructureError,
        Priority = ErrorPriority.P2,
        Status = ErrorStatus.New,
        Message = "boom",
        OccurrenceCount = 1,
        FirstOccurredAt = DateTimeOffset.UtcNow,
        LastOccurredAt = DateTimeOffset.UtcNow,
    };

    private static (
        ErrorAdminService Service,
        IErrorRecordRepository Repository,
        IUnitOfWork UnitOfWork,
        IErrorRetentionSettingsRepository RetentionSettingsRepository) MakeService()
    {
        var repository = Substitute.For<IErrorRecordRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var retentionSettingsRepository = Substitute.For<IErrorRetentionSettingsRepository>();
        return (
            new ErrorAdminService(repository, unitOfWork, retentionSettingsRepository),
            repository, unitOfWork, retentionSettingsRepository);
    }

    [Fact]
    public async Task GetListAsync_maps_repository_results_to_summary_DTOs_with_paging_metadata()
    {
        var (service, repository, _, _) = MakeService();
        var records = new List<ErrorRecord> { MakeRecord("err_1"), MakeRecord("err_2") };
        repository.QueryAsync(Arg.Any<ErrorListQuery>(), Arg.Any<CancellationToken>()).Returns((records, 17));
        var query = new ErrorListQuery { Page = 2, PageSize = 2 };

        var result = await service.GetListAsync(query, CancellationToken.None);

        Assert.Equal(2, result.Items.Count);
        Assert.Equal(["err_1", "err_2"], result.Items.Select(i => i.Id));
        Assert.Equal(17, result.TotalCount);
        Assert.Equal(2, result.Page);
        Assert.Equal(2, result.PageSize);
    }

    [Fact]
    public async Task GetByIdAsync_returns_the_mapped_detail_DTO_for_an_existing_record()
    {
        var (service, repository, _, _) = MakeService();
        repository.GetByIdAsync("err_1", Arg.Any<CancellationToken>()).Returns(MakeRecord("err_1"));

        var dto = await service.GetByIdAsync("err_1", CancellationToken.None);

        Assert.Equal("err_1", dto.Id);
    }

    [Fact]
    public async Task GetByIdAsync_throws_NotFoundException_for_a_missing_id()
    {
        var (service, repository, _, _) = MakeService();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);

        await Assert.ThrowsAsync<FlexDemy.Application.Common.NotFoundException>(
            () => service.GetByIdAsync("missing", CancellationToken.None));
    }

    // Story 4.6/AC #1: Archive is a soft-state transition, never a delete.
    [Fact]
    public async Task ArchiveAsync_sets_Status_Archived_and_ArchivedAt_and_saves_once()
    {
        var (service, repository, unitOfWork, _) = MakeService();
        var record = MakeRecord("err_1");
        repository.GetByIdAsync("err_1", Arg.Any<CancellationToken>()).Returns(record);

        await service.ArchiveAsync("err_1", CancellationToken.None);

        Assert.Equal(ErrorStatus.Archived, record.Status);
        Assert.NotNull(record.ArchivedAt);
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ArchiveAsync_throws_NotFoundException_for_a_missing_id()
    {
        var (service, repository, _, _) = MakeService();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);

        await Assert.ThrowsAsync<FlexDemy.Application.Common.NotFoundException>(
            () => service.ArchiveAsync("missing", CancellationToken.None));
    }

    // Code-review patch: no guard existed against a redundant same-state transition, unlike
    // IncreasePriorityAsync's own P0 guard ("defense in depth, not just a disabled UI button") --
    // this closes that inconsistency.
    [Fact]
    public async Task ArchiveAsync_throws_ValidationException_when_already_Archived()
    {
        var (service, repository, unitOfWork, _) = MakeService();
        var record = MakeRecord("err_1");
        record.Status = ErrorStatus.Archived;
        repository.GetByIdAsync("err_1", Arg.Any<CancellationToken>()).Returns(record);

        await Assert.ThrowsAsync<FlexDemy.Application.Common.ValidationException>(
            () => service.ArchiveAsync("err_1", CancellationToken.None));
        await unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // AC #2: Resolve sets ResolvedAt/ResolvedByUserId, still not a delete.
    [Fact]
    public async Task ResolveAsync_sets_Status_Resolved_ResolvedAt_and_ResolvedByUserId_and_saves_once()
    {
        var (service, repository, unitOfWork, _) = MakeService();
        var record = MakeRecord("err_1");
        repository.GetByIdAsync("err_1", Arg.Any<CancellationToken>()).Returns(record);

        await service.ResolveAsync("err_1", "admin_1", CancellationToken.None);

        Assert.Equal(ErrorStatus.Resolved, record.Status);
        Assert.NotNull(record.ResolvedAt);
        Assert.Equal("admin_1", record.ResolvedByUserId);
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ResolveAsync_throws_NotFoundException_for_a_missing_id()
    {
        var (service, repository, _, _) = MakeService();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);

        await Assert.ThrowsAsync<FlexDemy.Application.Common.NotFoundException>(
            () => service.ResolveAsync("missing", "admin_1", CancellationToken.None));
    }

    // Code-review patch: same guard as Archive above. Also closes a non-idempotency gap -- before
    // this guard, a double-click (or retry after a network blip) silently overwrote
    // ResolvedByUserId/ResolvedAt with whoever/whenever called it most recently, with no
    // "already resolved" check protecting the audit trail of who actually resolved it.
    [Fact]
    public async Task ResolveAsync_throws_ValidationException_when_already_Resolved()
    {
        var (service, repository, unitOfWork, _) = MakeService();
        var record = MakeRecord("err_1");
        record.Status = ErrorStatus.Resolved;
        repository.GetByIdAsync("err_1", Arg.Any<CancellationToken>()).Returns(record);

        await Assert.ThrowsAsync<FlexDemy.Application.Common.ValidationException>(
            () => service.ResolveAsync("err_1", "admin_1", CancellationToken.None));
        await unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // AC #4: Increase Priority moves exactly one step and attributes who/when.
    [Fact]
    public async Task IncreasePriorityAsync_moves_one_step_and_sets_attribution_and_saves_once()
    {
        var (service, repository, unitOfWork, _) = MakeService();
        var record = MakeRecord("err_1");
        record.Priority = ErrorPriority.P2;
        repository.GetByIdAsync("err_1", Arg.Any<CancellationToken>()).Returns(record);

        await service.IncreasePriorityAsync("err_1", "admin_1", CancellationToken.None);

        Assert.Equal(ErrorPriority.P1, record.Priority);
        Assert.NotNull(record.PriorityIncreasedAt);
        Assert.Equal("admin_1", record.PriorityIncreasedByUserId);
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task IncreasePriorityAsync_throws_ValidationException_when_already_at_P0()
    {
        var (service, repository, unitOfWork, _) = MakeService();
        var record = MakeRecord("err_1");
        record.Priority = ErrorPriority.P0;
        repository.GetByIdAsync("err_1", Arg.Any<CancellationToken>()).Returns(record);

        await Assert.ThrowsAsync<FlexDemy.Application.Common.ValidationException>(
            () => service.IncreasePriorityAsync("err_1", "admin_1", CancellationToken.None));
        await unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task IncreasePriorityAsync_throws_NotFoundException_for_a_missing_id()
    {
        var (service, repository, _, _) = MakeService();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);

        await Assert.ThrowsAsync<FlexDemy.Application.Common.NotFoundException>(
            () => service.IncreasePriorityAsync("missing", "admin_1", CancellationToken.None));
    }

    // Explicit admin delete: unlike Archive/Resolve, this hard-removes the row via
    // IErrorRecordRepository.Remove -- irreversible, so it's the repository's Remove (not
    // RemoveRange, the purge job's own path) that must be called exactly once.
    [Fact]
    public async Task DeleteAsync_removes_the_record_and_saves_once()
    {
        var (service, repository, unitOfWork, _) = MakeService();
        var record = MakeRecord("err_1");
        repository.GetByIdAsync("err_1", Arg.Any<CancellationToken>()).Returns(record);

        await service.DeleteAsync("err_1", CancellationToken.None);

        repository.Received(1).Remove(record);
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteAsync_throws_NotFoundException_for_a_missing_id()
    {
        var (service, repository, unitOfWork, _) = MakeService();
        repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);

        await Assert.ThrowsAsync<FlexDemy.Application.Common.NotFoundException>(
            () => service.DeleteAsync("missing", CancellationToken.None));
        await unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // AC #5: retention window, default 180 days.
    [Fact]
    public async Task GetRetentionSettingsAsync_returns_the_existing_row_s_value()
    {
        var (service, _, _, retentionSettingsRepository) = MakeService();
        retentionSettingsRepository.GetAsync(Arg.Any<CancellationToken>())
            .Returns(new ErrorRetentionSettings { Id = "settings_1", RetentionDays = 90 });

        var dto = await service.GetRetentionSettingsAsync(CancellationToken.None);

        Assert.Equal(90, dto.RetentionDays);
    }

    [Fact]
    public async Task GetRetentionSettingsAsync_falls_back_to_180_when_no_row_exists()
    {
        var (service, _, _, retentionSettingsRepository) = MakeService();
        retentionSettingsRepository.GetAsync(Arg.Any<CancellationToken>()).Returns((ErrorRetentionSettings?)null);

        var dto = await service.GetRetentionSettingsAsync(CancellationToken.None);

        Assert.Equal(180, dto.RetentionDays);
    }

    [Fact]
    public async Task UpdateRetentionSettingsAsync_updates_the_existing_row_and_saves_once()
    {
        var (service, _, unitOfWork, retentionSettingsRepository) = MakeService();
        var settings = new ErrorRetentionSettings { Id = "settings_1", RetentionDays = 180 };
        retentionSettingsRepository.GetAsync(Arg.Any<CancellationToken>()).Returns(settings);

        var dto = await service.UpdateRetentionSettingsAsync(90, CancellationToken.None);

        Assert.Equal(90, dto.RetentionDays);
        Assert.Equal(90, settings.RetentionDays);
        retentionSettingsRepository.Received(1).Update(settings);
        retentionSettingsRepository.DidNotReceive().Add(Arg.Any<ErrorRetentionSettings>());
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // Self-healing: a missing settings row (seeding never ran) is created rather than throwing.
    [Fact]
    public async Task UpdateRetentionSettingsAsync_creates_the_row_when_none_exists()
    {
        var (service, _, unitOfWork, retentionSettingsRepository) = MakeService();
        retentionSettingsRepository.GetAsync(Arg.Any<CancellationToken>()).Returns((ErrorRetentionSettings?)null);

        var dto = await service.UpdateRetentionSettingsAsync(60, CancellationToken.None);

        Assert.Equal(60, dto.RetentionDays);
        // Code-review patch: a fixed well-known Id (not a generated one) -- the seeder and this
        // self-heal path must agree on the same Id so a genuine race collides on the PK instead
        // of producing two rows.
        retentionSettingsRepository.Received(1).Add(Arg.Is<ErrorRetentionSettings>(s => s.Id == ErrorRetentionSettings.SingletonId && s.RetentionDays == 60));
        await unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task UpdateRetentionSettingsAsync_throws_ValidationException_for_a_non_positive_value(int retentionDays)
    {
        var (service, _, unitOfWork, _) = MakeService();

        await Assert.ThrowsAsync<FlexDemy.Application.Common.ValidationException>(
            () => service.UpdateRetentionSettingsAsync(retentionDays, CancellationToken.None));
        await unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // Code-review patch: an unbounded retentionDays lets DateTimeOffset.UtcNow.AddDays(-retentionDays)
    // throw ArgumentOutOfRangeException inside the purge job once the offset exceeds
    // DateTimeOffset.MinValue -- crashing the daily recurring job on every run thereafter.
    [Fact]
    public async Task UpdateRetentionSettingsAsync_throws_ValidationException_for_a_value_above_the_maximum()
    {
        var (service, _, unitOfWork, _) = MakeService();

        await Assert.ThrowsAsync<FlexDemy.Application.Common.ValidationException>(
            () => service.UpdateRetentionSettingsAsync(int.MaxValue, CancellationToken.None));
        await unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}

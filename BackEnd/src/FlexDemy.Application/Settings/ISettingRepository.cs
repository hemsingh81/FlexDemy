using FlexDemy.Domain.Settings;

namespace FlexDemy.Application.Settings;

public interface ISettingRepository
{
    // IReadOnlyList, not List (unlike IAiTaskConfigRepository.GetAllAsync) -- an intentional
    // deviation for this read-only-scoped interface, not an inconsistency.
    Task<IReadOnlyList<Setting>> GetAllAsync(CancellationToken cancellationToken = default);

    // Story 6.2/AD-25: ApplyAsync's lookup for the target row -- the entity comes back tracked by
    // the same Scoped DbContext, so ApplyAsync mutates it in place and doesn't need an explicit
    // Update() call, matching ErrorAdminService.ArchiveAsync's established pattern.
    Task<Setting?> GetByIdAsync(string id, CancellationToken cancellationToken = default);

    // Story 6.3/AC #1: the ONLY place that writes settings.value -- captures the value that was
    // live immediately before this write, atomically, via a SELECT...FOR UPDATE row lock held
    // across both statements by the caller's ambient transaction (see SettingsService.ApplyAsync).
    // NewValue isn't returned -- the caller already has it as the `newValue` parameter.
    Task<(string OldValue, DateTimeOffset UpdatedAt)> ApplyValueAsync(
        string id, string newValue, string? updatedBy, CancellationToken cancellationToken = default);
}

using FlexDemy.Application.Common;

namespace FlexDemy.Application.ErrorObservability;

public interface IErrorAdminService
{
    Task<PagedResult<ErrorRecordSummaryDto>> GetListAsync(ErrorListQuery query, CancellationToken cancellationToken = default);

    // Throws NotFoundException for a missing id (AD-5's normal exception-signaling convention --
    // not swallowed like IErrorCaptureService.CaptureAsync; this is an ordinary read service).
    Task<ErrorRecordDetailDto> GetByIdAsync(string id, CancellationToken cancellationToken = default);

    // Story 4.6/AC #1: soft-state transition, never a delete -- Archived rows stay in the
    // database, just excluded from the default list view (Story 4.5's IncludeArchived filter).
    Task ArchiveAsync(string id, CancellationToken cancellationToken = default);

    // AC #2: same soft-state shape as Archive, plus attribution (who resolved it, when).
    Task ResolveAsync(string id, string resolvedByUserId, CancellationToken cancellationToken = default);

    // AC #4: throws ValidationException if already at P0 -- a backend guard, not just a disabled
    // UI button (defense in depth; the frontend disabling the action is UX only).
    Task IncreasePriorityAsync(string id, string increasedByUserId, CancellationToken cancellationToken = default);

    // AC #5: the purge job's retention window. Falls back to FR-18's stated 180-day default if
    // the settings row is somehow missing, rather than throwing.
    Task<ErrorRetentionSettingsDto> GetRetentionSettingsAsync(CancellationToken cancellationToken = default);

    // Throws ValidationException for a non-positive value. Self-heals (creates the row) if none
    // exists yet -- see ErrorAdminService's own comment for why.
    Task<ErrorRetentionSettingsDto> UpdateRetentionSettingsAsync(int retentionDays, CancellationToken cancellationToken = default);
}

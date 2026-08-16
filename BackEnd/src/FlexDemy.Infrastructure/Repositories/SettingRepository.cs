using FlexDemy.Application.Common;
using FlexDemy.Application.Settings;
using FlexDemy.Domain.Settings;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class SettingRepository(FlexDemyDbContext db) : ISettingRepository
{
    public async Task<IReadOnlyList<Setting>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await db.Settings.ToListAsync(cancellationToken);

    public async Task<Setting?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        await db.Settings.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

    // Two statements, not a single WITH...UPDATE...RETURNING CTE: SqlQuery<T>'s FormattableString
    // overload is SELECT-shaped only, and composing .SingleAsync() onto a top-level UPDATE risks
    // EF wrapping it in a row-limiting subquery Postgres won't accept as a derived-table source.
    // Both calls run on this instance's own `db.Database`/connection, so when invoked inside
    // IUnitOfWork.ExecuteInTransactionAsync (see SettingsService.ApplyAsync) they share that
    // ambient transaction -- the FOR UPDATE lock from the first statement is genuinely held across
    // the second. Snake_case identifiers are load-bearing here, same reason as
    // AiTaskBudgetRepository.cs: .UseSnakeCaseNamingConvention() only affects EF's own LINQ-to-SQL
    // translation, raw SQL must spell out the real DB column names.
    public async Task<(string OldValue, DateTimeOffset UpdatedAt)> ApplyValueAsync(
        string id, string newValue, string? updatedBy, CancellationToken cancellationToken = default)
    {
        // Code-review patch (2026-08-16): SingleOrDefaultAsync + NotFoundException, not
        // SingleAsync -- guards the race where the row is deleted between ApplyAsync's earlier
        // GetByIdAsync check and this raw SQL running, which would otherwise surface as an
        // unhandled InvalidOperationException (a generic 500) instead of a clean 404.
        // SqlQuery<T> for a scalar/non-entity T requires the result set's column to be literally
        // named "Value" -- EF wraps this in a subquery and projects s."Value" (case-sensitive,
        // quoted). Selecting the real column `value` unaliased left that projection unresolvable
        // against Postgres (42703), since this raw-SQL path is never exercised by
        // Infrastructure.Tests' EF InMemory provider (it can't translate SqlQuery<T> either), only
        // by mocked service-layer tests -- so it went untested against real Postgres since it was
        // first introduced for ApplyAsync.
        var oldValue = await db.Database
            .SqlQuery<string>($"SELECT value AS \"Value\" FROM settings WHERE id = {id} FOR UPDATE")
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException(nameof(Setting), id);

        var now = DateTimeOffset.UtcNow;
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE settings SET value = {newValue}, is_active = TRUE, updated_at = {now}, updated_by = {updatedBy} WHERE id = {id}",
            cancellationToken);

        return (oldValue, now);
    }
}

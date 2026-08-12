using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using FlexDemy.Domain.Jobs;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class CourseFileRepository(FlexDemyDbContext db) : ICourseFileRepository
{
    public Task<CourseFile?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        db.CourseFiles.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);

    // Newest first (GetFilesAsync/Task 5) -- a tutor reopening the Content Editor sees files
    // already uploaded in a prior session, most recent first.
    public async Task<IReadOnlyList<CourseFile>> GetByCourseIdAsync(string courseId, CancellationToken cancellationToken = default) =>
        await db.CourseFiles.AsNoTracking()
            .Where(f => f.CourseId == courseId)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync(cancellationToken);

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    public void Add(CourseFile file) => db.CourseFiles.Add(file);

    public async Task<IReadOnlyList<CourseFile>> GetPendingMaterializationAsync(string courseId, CancellationToken cancellationToken = default) =>
        await db.CourseFiles.AsNoTracking()
            .Where(f => f.CourseId == courseId && f.Status == JobItemStatus.Done && !f.IsMaterialized)
            .ToListAsync(cancellationToken);

    // Snake_case identifiers are load-bearing here -- .UseSnakeCaseNamingConvention() only affects
    // EF's own LINQ-to-SQL translation; raw SQL must spell out the real DB column names.
    // Code-review patch: defensively re-checks status = 'Done' in the claim itself (matching the
    // spec's own reference query), not just in GetPendingMaterializationAsync's caller-side filter
    // -- redundant given nothing in this app ever un-sets Done today, but a single extra WHERE
    // clause is cheap insurance against that assumption changing later.
    public async Task<bool> TryClaimForMaterializationAsync(string fileId, CancellationToken cancellationToken = default)
    {
        var status = JobItemStatus.Done.ToString();
        var rows = await db.Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE course_files SET is_materialized = true WHERE id = {fileId} AND status = {status} AND is_materialized = false",
            cancellationToken);

        return rows == 1;
    }
}

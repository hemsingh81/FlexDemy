using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class CourseFileRepository(FlexDemyDbContext db) : ICourseFileRepository
{
    public Task<CourseFile?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        db.CourseFiles.FirstOrDefaultAsync(f => f.Id == id, cancellationToken);

    // Newest first (GetFilesAsync) -- a tutor reopening the Content Editor sees files already
    // uploaded in a prior session, most recent first. Tracked (not AsNoTracking) -- unlike most
    // read paths, VersionService.RestoreVersionAsync mutates the returned entities' ParsedContent
    // in place and relies on the same unit of work to persist that change.
    public async Task<IReadOnlyList<CourseFile>> GetByCourseIdAsync(string courseId, CancellationToken cancellationToken = default) =>
        await db.CourseFiles
            .Where(f => f.CourseId == courseId)
            .OrderByDescending(f => f.CreatedAt)
            .ToListAsync(cancellationToken);

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    public void Add(CourseFile file) => db.CourseFiles.Add(file);

    public void Remove(CourseFile file) => db.CourseFiles.Remove(file);
}

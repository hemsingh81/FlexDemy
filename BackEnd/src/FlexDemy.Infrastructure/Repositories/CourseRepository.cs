using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class CourseRepository(FlexDemyDbContext db) : ICourseRepository
{
    // Code-review patch: an unbounded PageSize let any caller force a full-table read of the
    // public catalog in one request -- same clamp-and-cap shape as ErrorRecordRepository.QueryAsync's
    // own established convention.
    private const int MaxPageSize = 100;

    public async Task<(IReadOnlyList<Course> Items, int TotalCount)> GetAllAsync(string? gradeTag, string? search, string? subject, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        // Story 2.4/AC#5: this method backs the public catalog only -- no caller of it should
        // ever see an in-progress Draft (GetDraftByIdAsync below is the Draft-aware read path).
        var query = db.Courses.AsNoTracking().Include(c => c.Thumbnails).Where(c => c.LifecycleState == LifecycleState.Published).AsQueryable();

        if (!string.IsNullOrWhiteSpace(gradeTag))
            query = query.Where(c => c.TargetGradeTag == gradeTag);

        if (!string.IsNullOrWhiteSpace(subject))
            query = query.Where(c => c.Subject == subject);

        if (!string.IsNullOrWhiteSpace(search))
        {
            // Story 2.4: previously EF.Functions.ILike(c.Title, $"%{search}%") -- an unescaped
            // '%'/'_' in `search` silently changed LIKE pattern semantics instead of matching
            // literally (the same wildcard-injection bug class already found and fixed once in
            // this codebase, Story 1.9's TagRepository). ToLower().Contains() has no pattern
            // metacharacters to escape.
            var loweredSearch = search.ToLower();
            query = query.Where(c => c.Title.ToLower().Contains(loweredSearch));
        }

        var totalCount = await query.CountAsync(cancellationToken);

        // Code-review patch: Page/PageSize are unvalidated caller input -- clamp before they
        // reach Skip()/Take() instead of trusting them, matching ErrorRecordRepository.QueryAsync's
        // own established clamp.
        var clampedPage = Math.Max(1, page);
        var clampedPageSize = Math.Clamp(pageSize <= 0 ? 1 : pageSize, 1, MaxPageSize);

        var items = await query
            // Title/Id (not just Title) as a fully deterministic sort -- Skip/Take pagination is
            // only stable across separate requests when ties can't reorder between pages, same
            // "Id as a stable tie-breaker" reasoning as ErrorRecordRepository.QueryAsync's own.
            .OrderBy(c => c.Title)
            .ThenBy(c => c.Id)
            .Skip((clampedPage - 1) * clampedPageSize)
            .Take(clampedPageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    // Story 2.4: .Include(Thumbnails) added after a real end-to-end check (not caught by any
    // mocked test, which never exercises real EF lazy/eager loading) showed a course fetched
    // through this method came back with an empty Thumbnails collection even immediately after
    // a successful upload -- lazy loading isn't enabled in this DbContext, so an un-Included
    // navigation just silently stays at its [] field-initializer default, never the DB's real
    // data.
    public Task<Course?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        db.Courses.Include(c => c.Thumbnails).FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public Task<Course?> GetDraftByIdAsync(string id, CancellationToken cancellationToken = default) =>
        db.Courses.Include(c => c.Thumbnails).FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    // FR-31: newest-edited-first, matching the "resume a course" list's own ordering need -- a
    // tutor picking up where they left off cares most about what they touched most recently.
    public async Task<IReadOnlyList<Course>> GetByTutorIdAsync(string tutorId, CancellationToken cancellationToken = default) =>
        await db.Courses.AsNoTracking()
            .Where(c => c.TutorId == tutorId)
            .OrderByDescending(c => c.UpdatedAt ?? c.CreatedAt)
            .ToListAsync(cancellationToken);

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    public void Add(Course course) => db.Courses.Add(course);
}

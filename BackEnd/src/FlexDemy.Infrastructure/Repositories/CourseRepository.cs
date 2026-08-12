using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class CourseRepository(FlexDemyDbContext db) : ICourseRepository
{
    public async Task<IReadOnlyList<Course>> GetAllAsync(string? gradeTag, string? search, string? subject, CancellationToken cancellationToken = default)
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

        return await query.ToListAsync(cancellationToken);
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

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    public void Add(Course course) => db.Courses.Add(course);
}

using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class CourseRepository(FlexDemyDbContext db) : ICourseRepository
{
    public async Task<IReadOnlyList<Course>> GetAllAsync(string? gradeTag, string? search, string? subject, CancellationToken cancellationToken = default)
    {
        var query = db.Courses.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(gradeTag))
            query = query.Where(c => c.TargetGradeTag == gradeTag);

        if (!string.IsNullOrWhiteSpace(subject))
            query = query.Where(c => c.Subject == subject);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(c => EF.Functions.ILike(c.Title, $"%{search}%"));

        return await query.ToListAsync(cancellationToken);
    }

    public Task<Course?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        db.Courses.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    public void Add(Course course) => db.Courses.Add(course);
}

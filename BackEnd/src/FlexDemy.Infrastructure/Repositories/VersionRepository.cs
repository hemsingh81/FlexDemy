using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class VersionRepository(FlexDemyDbContext db) : IVersionRepository
{
    public void Add(CourseVersion version) => db.CourseVersions.Add(version);

    public Task<CourseVersion?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        db.CourseVersions.FirstOrDefaultAsync(v => v.Id == id, cancellationToken);

    public Task<List<CourseVersion>> GetAllByCourseIdAsync(string courseId, CancellationToken cancellationToken = default) =>
        db.CourseVersions.Where(v => v.CourseId == courseId).OrderByDescending(v => v.PublishedAt).ToListAsync(cancellationToken);
}

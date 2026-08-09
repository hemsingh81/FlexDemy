using FlexDemy.Application.Profiles;
using FlexDemy.Domain.Profiles;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class StudentProfileRepository(FlexDemyDbContext db) : IStudentProfileRepository
{
    public Task<StudentProfile?> GetByUserIdAsync(string userId, CancellationToken cancellationToken = default) =>
        db.StudentProfiles.FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    public void Add(StudentProfile profile) => db.StudentProfiles.Add(profile);

    public void Update(StudentProfile profile) => db.StudentProfiles.Update(profile);
}

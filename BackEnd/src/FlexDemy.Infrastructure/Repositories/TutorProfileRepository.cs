using FlexDemy.Application.Profiles;
using FlexDemy.Domain.Profiles;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class TutorProfileRepository(FlexDemyDbContext db) : ITutorProfileRepository
{
    public Task<TutorProfile?> GetByUserIdAsync(string userId, CancellationToken cancellationToken = default) =>
        db.TutorProfiles.FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);

    public async Task<IReadOnlyList<TutorProfile>> GetPendingAsync(CancellationToken cancellationToken = default) =>
        await db.TutorProfiles.AsNoTracking().Where(p => p.ReviewedAt == null).ToListAsync(cancellationToken);

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    public void Add(TutorProfile profile) => db.TutorProfiles.Add(profile);

    public void Update(TutorProfile profile) => db.TutorProfiles.Update(profile);
}

using FlexDemy.Domain.Profiles;

namespace FlexDemy.Application.Profiles;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
public interface ITutorProfileRepository
{
    Task<TutorProfile?> GetByUserIdAsync(string userId, CancellationToken cancellationToken = default);

    // "Pending" is proxied by ReviewedAt being unset -- true both for a first-time application
    // and for a re-apply after rejection (ApplyReapply clears ReviewedAt), and false once a
    // reviewer has approved or rejected it. Avoids joining Users just to filter on Role.
    Task<IReadOnlyList<TutorProfile>> GetPendingAsync(CancellationToken cancellationToken = default);
    void Add(TutorProfile profile);
    void Update(TutorProfile profile);
}

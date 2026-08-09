using FlexDemy.Domain.Profiles;

namespace FlexDemy.Application.Profiles;

// AD-4: Application defines the repository interface; Infrastructure implements it against EF Core.
public interface IStudentProfileRepository
{
    Task<StudentProfile?> GetByUserIdAsync(string userId, CancellationToken cancellationToken = default);
    void Add(StudentProfile profile);
    void Update(StudentProfile profile);
}

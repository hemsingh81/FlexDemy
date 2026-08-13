using FlexDemy.Domain.AdaptiveLearning;

namespace FlexDemy.Application.AdaptiveLearning;

public interface IExerciseRepository
{
    Task<Exercise?> GetByNodeAsync(string? topicId, string? subtopicId, CancellationToken cancellationToken = default);

    // Staging only -- IUnitOfWork.SaveChangesAsync (called by the service) commits (AD-11).
    void Add(Exercise exercise);
    void Remove(Exercise exercise);
}

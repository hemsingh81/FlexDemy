using FlexDemy.Domain.AdaptiveLearning;

namespace FlexDemy.Application.AdaptiveLearning;

public interface IAdaptiveLearningRepository
{
    Task<DrilldownLevel?> GetLevelAsync(string? topicId, string? subtopicId, int levelNumber, CancellationToken cancellationToken = default);

    Task<WayContent?> GetWayAsync(string? topicId, string? subtopicId, int wayNumber, CancellationToken cancellationToken = default);

    // Staging only -- IUnitOfWork.SaveChangesAsync (called by the service) commits (AD-11).
    void AddLevel(DrilldownLevel level);
    void AddWay(WayContent way);
}

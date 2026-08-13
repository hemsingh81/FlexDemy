using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class AdaptiveLearningRepository(FlexDemyDbContext db) : IAdaptiveLearningRepository
{
    public Task<DrilldownLevel?> GetLevelAsync(string? topicId, string? subtopicId, int levelNumber, CancellationToken cancellationToken = default) =>
        db.DrilldownLevels.FirstOrDefaultAsync(
            d => d.TopicId == topicId && d.SubtopicId == subtopicId && d.LevelNumber == levelNumber, cancellationToken);

    public Task<WayContent?> GetWayAsync(string? topicId, string? subtopicId, int wayNumber, CancellationToken cancellationToken = default) =>
        db.WayContents.FirstOrDefaultAsync(
            w => w.TopicId == topicId && w.SubtopicId == subtopicId && w.WayNumber == wayNumber, cancellationToken);

    public void AddLevel(DrilldownLevel level) => db.DrilldownLevels.Add(level);
    public void AddWay(WayContent way) => db.WayContents.Add(way);
}

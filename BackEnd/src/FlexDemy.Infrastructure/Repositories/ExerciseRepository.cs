using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class ExerciseRepository(FlexDemyDbContext db) : IExerciseRepository
{
    public Task<Exercise?> GetByNodeAsync(string? topicId, string? subtopicId, CancellationToken cancellationToken = default) =>
        db.Exercises.FirstOrDefaultAsync(e => e.TopicId == topicId && e.SubtopicId == subtopicId, cancellationToken);

    public void Add(Exercise exercise) => db.Exercises.Add(exercise);
    public void Remove(Exercise exercise) => db.Exercises.Remove(exercise);
}

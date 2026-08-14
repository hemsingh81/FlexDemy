using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.AdaptiveLearning;

// The Chapter/Topic/Subtopic-tree-based pre-generation batch (PublishBatch/PublishBatchItem, one
// AI generation job per confirmed node) was removed along with the tree itself -- there's no
// per-node granularity left to track. Publish is now a single, immediate, synchronous transition:
// requires ReviewConfirmed, becomes Published. Depends on ICourseService (never ICourseRepository
// directly, AD-12) for the LifecycleState check and the terminal Published transition, since only
// Courses' own service may mutate a Course entity.
public class PublishService(ICourseService courseService, IVersionService versionService) : IPublishService
{
    public async Task PublishAsync(string courseId, CancellationToken cancellationToken = default)
    {
        var course = await courseService.GetCourseByIdAsync(courseId, cancellationToken);
        if (course.LifecycleState != nameof(LifecycleState.ReviewConfirmed))
            throw new ValidationException("A course can only be published once its review has been confirmed.");

        await versionService.CreateSnapshotAsync(courseId, cancellationToken);
        await courseService.MarkPublishedAsync(courseId, cancellationToken);
    }

    public async Task<PublishStatusDto> GetStatusAsync(string courseId, CancellationToken cancellationToken = default)
    {
        var course = await courseService.GetCourseByIdAsync(courseId, cancellationToken);
        return new PublishStatusDto(course.LifecycleState);
    }
}

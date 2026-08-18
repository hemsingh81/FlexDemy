using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

// AD-20: implements IContentRepository -- one repository for the whole outline, extended by
// Stories 7.2/7.3/8.1 with Topic/Subtopic/Page/Resource methods rather than a repository per entity.
public class ContentRepository(FlexDemyDbContext db) : IContentRepository
{
    public async Task<IReadOnlyList<Chapter>> GetChaptersByCourseIdAsync(string courseId, CancellationToken cancellationToken = default) =>
        await db.Chapters.AsNoTracking()
            .Where(c => c.CourseId == courseId)
            .OrderBy(c => c.Order)
            .ToListAsync(cancellationToken);

    public Task<Chapter?> GetChapterByIdAsync(string chapterId, CancellationToken cancellationToken = default) =>
        db.Chapters.FirstOrDefaultAsync(c => c.Id == chapterId, cancellationToken);

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    public void Add(Chapter chapter) => db.Chapters.Add(chapter);
    public void Remove(Chapter chapter) => db.Chapters.Remove(chapter);

    public async Task<IReadOnlyList<Topic>> GetTopicsByChapterIdAsync(string chapterId, CancellationToken cancellationToken = default) =>
        await db.Topics.AsNoTracking()
            .Where(t => t.ChapterId == chapterId)
            .OrderBy(t => t.Order)
            .ToListAsync(cancellationToken);

    public Task<Topic?> GetTopicByIdAsync(string topicId, CancellationToken cancellationToken = default) =>
        db.Topics.FirstOrDefaultAsync(t => t.Id == topicId, cancellationToken);

    public void Add(Topic topic) => db.Topics.Add(topic);
    public void Remove(Topic topic) => db.Topics.Remove(topic);

    public async Task<IReadOnlyList<Subtopic>> GetSubtopicsByTopicIdAsync(string topicId, CancellationToken cancellationToken = default) =>
        await db.Subtopics.AsNoTracking()
            .Where(s => s.TopicId == topicId)
            .OrderBy(s => s.Order)
            .ToListAsync(cancellationToken);

    public Task<Subtopic?> GetSubtopicByIdAsync(string subtopicId, CancellationToken cancellationToken = default) =>
        db.Subtopics.FirstOrDefaultAsync(s => s.Id == subtopicId, cancellationToken);

    public void Add(Subtopic subtopic) => db.Subtopics.Add(subtopic);
    public void Remove(Subtopic subtopic) => db.Subtopics.Remove(subtopic);

    public async Task<IReadOnlyList<Page>> GetPagesByOwnerAsync(ContentOwnerType ownerType, string ownerId, CancellationToken cancellationToken = default) =>
        await db.Pages.AsNoTracking()
            .Where(p => p.OwnerType == ownerType && p.OwnerId == ownerId)
            .OrderBy(p => p.Order)
            .ToListAsync(cancellationToken);

    public Task<Page?> GetPageByIdAsync(string pageId, CancellationToken cancellationToken = default) =>
        db.Pages.FirstOrDefaultAsync(p => p.Id == pageId, cancellationToken);

    public void Add(Page page) => db.Pages.Add(page);
    public void Remove(Page page) => db.Pages.Remove(page);

    public async Task<IReadOnlyList<Resource>> GetResourcesByOwnerAsync(ContentOwnerType ownerType, string ownerId, CancellationToken cancellationToken = default) =>
        await db.Resources.AsNoTracking()
            .Where(r => r.OwnerType == ownerType && r.OwnerId == ownerId)
            .OrderBy(r => r.Order)
            .ToListAsync(cancellationToken);

    public Task<Resource?> GetResourceByIdAsync(string resourceId, CancellationToken cancellationToken = default) =>
        db.Resources.FirstOrDefaultAsync(r => r.Id == resourceId, cancellationToken);

    public void Add(Resource resource) => db.Resources.Add(resource);
    public void Remove(Resource resource) => db.Resources.Remove(resource);

    public async Task<IReadOnlyCollection<string>> GetCourseFileIdsWithResourcesAsync(IReadOnlyCollection<string> courseFileIds, CancellationToken cancellationToken = default)
    {
        if (courseFileIds.Count == 0) return [];
        return await db.Resources.AsNoTracking()
            .Where(r => r.CourseFileId != null && courseFileIds.Contains(r.CourseFileId))
            .Select(r => r.CourseFileId!)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> HasUnconfirmedContentAsync(string courseId, CancellationToken cancellationToken = default)
    {
        var chapters = await GetChaptersByCourseIdAsync(courseId, cancellationToken);
        foreach (var chapter in chapters)
        {
            if (!chapter.IsConfirmed) return true;
            if (await HasUnconfirmedDescendantAsync(ContentOwnerType.Chapter, chapter.Id, cancellationToken)) return true;
        }
        return false;
    }

    private async Task<bool> HasUnconfirmedDescendantAsync(ContentOwnerType ownerType, string ownerId, CancellationToken cancellationToken)
    {
        var pages = await GetPagesByOwnerAsync(ownerType, ownerId, cancellationToken);
        if (pages.Any(p => !p.IsConfirmed)) return true;

        if (ownerType == ContentOwnerType.Chapter)
        {
            var topics = await GetTopicsByChapterIdAsync(ownerId, cancellationToken);
            foreach (var topic in topics)
            {
                if (!topic.IsConfirmed) return true;
                if (await HasUnconfirmedDescendantAsync(ContentOwnerType.Topic, topic.Id, cancellationToken)) return true;
            }
        }
        else if (ownerType == ContentOwnerType.Topic)
        {
            var subtopics = await GetSubtopicsByTopicIdAsync(ownerId, cancellationToken);
            foreach (var subtopic in subtopics)
            {
                if (!subtopic.IsConfirmed) return true;
                if (await HasUnconfirmedDescendantAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken)) return true;
            }
        }
        return false;
    }
}

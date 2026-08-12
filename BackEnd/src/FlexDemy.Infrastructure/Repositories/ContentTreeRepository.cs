using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class ContentTreeRepository(FlexDemyDbContext db) : IContentTreeRepository
{
    // Two branching Include chains off the same Topics collection -- EF Core has no single
    // fluent call that expresses "Topics.Subtopics.ContentBlocks AND Topics.ContentBlocks" from
    // one root; each ThenInclude path needs its own top-level Include(c => c.Topics...).
    public Task<List<Chapter>> GetTreeAsync(string courseId, CancellationToken cancellationToken = default) =>
        db.Chapters
            .Where(c => c.CourseId == courseId)
            .Include(c => c.Topics.OrderBy(t => t.Order))
                .ThenInclude(t => t.Subtopics.OrderBy(s => s.Order))
                    .ThenInclude(s => s.ContentBlocks.OrderBy(b => b.Order))
            .Include(c => c.Topics.OrderBy(t => t.Order))
                .ThenInclude(t => t.ContentBlocks.OrderBy(b => b.Order))
            .OrderBy(c => c.Order)
            .ToListAsync(cancellationToken);

    public async Task<TreeNode?> FindNodeAsync(string courseId, string nodeId, CancellationToken cancellationToken = default)
    {
        var chapter = await db.Chapters.FirstOrDefaultAsync(c => c.Id == nodeId && c.CourseId == courseId, cancellationToken);
        if (chapter is not null)
            return new TreeNode(chapter, null, null, null);

        var topic = await (
            from t in db.Topics
            join c in db.Chapters on t.ChapterId equals c.Id
            where t.Id == nodeId && c.CourseId == courseId
            select t
        ).FirstOrDefaultAsync(cancellationToken);
        if (topic is not null)
            return new TreeNode(null, topic, null, null);

        var subtopic = await (
            from s in db.Subtopics
            join t in db.Topics on s.TopicId equals t.Id
            join c in db.Chapters on t.ChapterId equals c.Id
            where s.Id == nodeId && c.CourseId == courseId
            select s
        ).FirstOrDefaultAsync(cancellationToken);
        if (subtopic is not null)
            return new TreeNode(null, null, subtopic, null);

        var block = await db.ContentBlocks.FirstOrDefaultAsync(b => b.Id == nodeId, cancellationToken);
        if (block is null)
            return null;

        var belongsToCourse = block.TopicId is not null
            ? await (
                from t in db.Topics
                join c in db.Chapters on t.ChapterId equals c.Id
                where t.Id == block.TopicId && c.CourseId == courseId
                select t.Id
            ).AnyAsync(cancellationToken)
            : await (
                from s in db.Subtopics
                join t in db.Topics on s.TopicId equals t.Id
                join c in db.Chapters on t.ChapterId equals c.Id
                where s.Id == block.SubtopicId && c.CourseId == courseId
                select s.Id
            ).AnyAsync(cancellationToken);

        return belongsToCourse ? new TreeNode(null, null, null, block) : null;
    }

    public Task<Chapter?> GetChapterByIdAsync(string id, CancellationToken cancellationToken = default) =>
        db.Chapters.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public Task<Topic?> GetTopicByIdAsync(string id, CancellationToken cancellationToken = default) =>
        db.Topics.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

    public Task<Subtopic?> GetSubtopicByIdAsync(string id, CancellationToken cancellationToken = default) =>
        db.Subtopics.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

    public Task<List<Chapter>> GetChaptersByCourseIdAsync(string courseId, CancellationToken cancellationToken = default) =>
        db.Chapters.Where(c => c.CourseId == courseId).OrderBy(c => c.Order).ToListAsync(cancellationToken);

    public Task<List<Topic>> GetTopicsByChapterIdAsync(string chapterId, CancellationToken cancellationToken = default) =>
        db.Topics.Where(t => t.ChapterId == chapterId).OrderBy(t => t.Order).ToListAsync(cancellationToken);

    public Task<List<Subtopic>> GetSubtopicsByTopicIdAsync(string topicId, CancellationToken cancellationToken = default) =>
        db.Subtopics.Where(s => s.TopicId == topicId).OrderBy(s => s.Order).ToListAsync(cancellationToken);

    public Task<List<ContentBlock>> GetContentBlocksByTopicIdAsync(string topicId, CancellationToken cancellationToken = default) =>
        db.ContentBlocks.Where(b => b.TopicId == topicId).OrderBy(b => b.Order).ToListAsync(cancellationToken);

    public Task<List<ContentBlock>> GetContentBlocksBySubtopicIdAsync(string subtopicId, CancellationToken cancellationToken = default) =>
        db.ContentBlocks.Where(b => b.SubtopicId == subtopicId).OrderBy(b => b.Order).ToListAsync(cancellationToken);

    public void AddChapter(Chapter chapter) => db.Chapters.Add(chapter);
    public void AddTopic(Topic topic) => db.Topics.Add(topic);
    public void AddSubtopic(Subtopic subtopic) => db.Subtopics.Add(subtopic);
    public void AddContentBlock(ContentBlock block) => db.ContentBlocks.Add(block);
    public void RemoveChapter(Chapter chapter) => db.Chapters.Remove(chapter);
    public void RemoveTopic(Topic topic) => db.Topics.Remove(topic);
    public void RemoveSubtopic(Subtopic subtopic) => db.Subtopics.Remove(subtopic);
    public void RemoveContentBlock(ContentBlock block) => db.ContentBlocks.Remove(block);
}

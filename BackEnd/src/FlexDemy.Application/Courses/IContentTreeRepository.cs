using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

// AD-4, deliberately deviating from "one repository per entity": every real operation here
// (reorder within a sibling group, cascading delete, moving a node between tree positions,
// resolving "what type is this id" for the polymorphic node mutators) genuinely needs
// cross-entity awareness -- four independent repositories would just relocate that coupling into
// the service layer instead of removing it.
public interface IContentTreeRepository
{
    // Loads the full tree for a course, every level .Include()d and ordered by each level's
    // Order column. Tracked (not AsNoTracking) intentionally -- ContentTreeService's Task 6
    // materialization step stages new entities into the same unit of work this reads from.
    Task<List<Chapter>> GetTreeAsync(string courseId, CancellationToken cancellationToken = default);

    // A small discriminated-result wrapper (TreeNode) around whichever of Chapter/Topic/Subtopic/
    // ContentBlock the id actually belongs to -- checks each of the four tables in turn (cheap at
    // this entity count/course scale). Scoped to courseId at every level so a node id belonging
    // to a different course's tree is never resolvable through this course's ownership guard.
    Task<TreeNode?> FindNodeAsync(string courseId, string nodeId, CancellationToken cancellationToken = default);

    Task<Chapter?> GetChapterByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<Topic?> GetTopicByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<Subtopic?> GetSubtopicByIdAsync(string id, CancellationToken cancellationToken = default);

    // Sibling groups, sorted by Order -- backs ReorderNodeAsync/MoveNodeAsync/DeleteNodeAsync's
    // renumbering, copying CourseService.ReorderThumbnailAsync/RemoveThumbnailAsync's own pattern.
    Task<List<Chapter>> GetChaptersByCourseIdAsync(string courseId, CancellationToken cancellationToken = default);
    Task<List<Topic>> GetTopicsByChapterIdAsync(string chapterId, CancellationToken cancellationToken = default);
    Task<List<Subtopic>> GetSubtopicsByTopicIdAsync(string topicId, CancellationToken cancellationToken = default);
    Task<List<ContentBlock>> GetContentBlocksByTopicIdAsync(string topicId, CancellationToken cancellationToken = default);
    Task<List<ContentBlock>> GetContentBlocksBySubtopicIdAsync(string subtopicId, CancellationToken cancellationToken = default);

    // Staging only -- IUnitOfWork.SaveChangesAsync (called by the service) commits (AD-11).
    void AddChapter(Chapter chapter);
    void AddTopic(Topic topic);
    void AddSubtopic(Subtopic subtopic);
    void AddContentBlock(ContentBlock block);
    void RemoveChapter(Chapter chapter);
    void RemoveTopic(Topic topic);
    void RemoveSubtopic(Subtopic subtopic);
    void RemoveContentBlock(ContentBlock block);
}

// Exactly one of Chapter/Topic/Subtopic/ContentBlock is non-null. No separate "parent id" field --
// each entity already carries its own real parent-FK property (Topic.ChapterId, Subtopic.TopicId,
// ContentBlock.TopicId/SubtopicId), so callers read the parent id straight off whichever one is set.
public sealed record TreeNode(Chapter? Chapter, Topic? Topic, Subtopic? Subtopic, ContentBlock? ContentBlock);

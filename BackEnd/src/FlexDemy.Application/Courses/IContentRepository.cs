using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

// AD-20: one repository for the whole outline (Chapter/Topic/Subtopic/Page/Resource together),
// an explicit named exception to the per-entity-repository default -- Stories 7.2/7.3/8.1 extend
// this same interface with Topic/Subtopic/Page/Resource methods rather than each adding a new
// repository. This story (7.1) implements only the Chapter methods it needs.
public interface IContentRepository
{
    // Lightweight -- id/title/order only, backs the "does this course already have a chapter"
    // check and the chapter-picker list. Ordered for stable, predictable list rendering.
    Task<IReadOnlyList<Chapter>> GetChaptersByCourseIdAsync(string courseId, CancellationToken cancellationToken = default);
    Task<Chapter?> GetChapterByIdAsync(string chapterId, CancellationToken cancellationToken = default);
    void Add(Chapter chapter);
    void Remove(Chapter chapter);

    // Story 7.2 additions -- Topic/Subtopic, same shared-repository file (AD-20's named
    // exception to per-entity repositories).
    Task<IReadOnlyList<Topic>> GetTopicsByChapterIdAsync(string chapterId, CancellationToken cancellationToken = default);
    Task<Topic?> GetTopicByIdAsync(string topicId, CancellationToken cancellationToken = default);
    void Add(Topic topic);
    void Remove(Topic topic);

    Task<IReadOnlyList<Subtopic>> GetSubtopicsByTopicIdAsync(string topicId, CancellationToken cancellationToken = default);
    Task<Subtopic?> GetSubtopicByIdAsync(string subtopicId, CancellationToken cancellationToken = default);
    void Add(Subtopic subtopic);
    void Remove(Subtopic subtopic);

    // Story 7.3 additions -- Page, same shared-repository file. OwnerType/OwnerId is a
    // polymorphic pair (AD-20), not a typed FK, so lookups take both rather than a single
    // "ChapterId"-style scalar.
    Task<IReadOnlyList<Page>> GetPagesByOwnerAsync(ContentOwnerType ownerType, string ownerId, CancellationToken cancellationToken = default);
    Task<Page?> GetPageByIdAsync(string pageId, CancellationToken cancellationToken = default);
    void Add(Page page);
    void Remove(Page page);

    // Story 8.1 additions -- Resource, same shared-repository file.
    Task<IReadOnlyList<Resource>> GetResourcesByOwnerAsync(ContentOwnerType ownerType, string ownerId, CancellationToken cancellationToken = default);
    Task<Resource?> GetResourceByIdAsync(string resourceId, CancellationToken cancellationToken = default);
    void Add(Resource resource);
    void Remove(Resource resource);

    // Story 10.2, FR-23: a lightweight existence check backing the source-file delete-confirmation
    // warning -- resolves which of the given CourseFile ids have at least one Resource attached via
    // "Attach existing file" (Resource.CourseFileId, indexed for exactly this query), without loading
    // full Resource rows. CourseFileService depends on this repository directly (not via a service
    // interface) -- same already-established cross-slice pattern ContentService itself uses for
    // ICourseFileRepository.
    Task<IReadOnlyCollection<string>> GetCourseFileIdsWithResourcesAsync(IReadOnlyCollection<string> courseFileIds, CancellationToken cancellationToken = default);

    // Story 11.1, FR-45: the Move-to-Review gate's own existence check -- true the moment any
    // Chapter/Topic/Subtopic/Page in the course has IsConfirmed == false, short-circuiting the
    // whole-course walk as soon as one is found (never needs to build the full outline). Same
    // whole-course Chapter->Topic->Subtopic->Page traversal shape as ContentService.GetOutlineAsync/
    // GetAllPagesInCourseAsync's own precedent, composed from this repository's existing per-parent
    // query methods rather than a new bespoke query. CourseService depends on this repository
    // directly (not via IContentService) specifically to avoid a circular DI dependency --
    // ContentService already depends on ICourseService, so the reverse (CourseService ->
    // IContentService) would form a cycle at container-resolution time.
    Task<bool> HasUnconfirmedContentAsync(string courseId, CancellationToken cancellationToken = default);
}

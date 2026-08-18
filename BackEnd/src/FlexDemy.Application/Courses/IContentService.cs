using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

// AD-20: IContentService.GetChapterDocumentAsync backs GET .../document -- the full nested
// Chapter (title, Description) -> Topics -> Sub-Topics (titles, Descriptions, confirmation
// state) payload. Distinct from the lightweight chapter list (GetChapterListAsync), which omits
// everything but id/title/order.
// Story 7.1 built the Chapter-level surface; Story 7.2 extends it with Topic/Subtopic CRUD,
// cascade-delete (Chapter/Topic/Subtopic), and reorder (Chapter/Topic/Subtopic). Stories
// 7.3/8.1 extend this same interface further with Page/Resource methods.
public interface IContentService
{
    Task<IReadOnlyList<ChapterSummaryDto>> GetChapterListAsync(string courseId, CancellationToken cancellationToken = default);
    Task<ChapterDocumentDto> GetChapterDocumentAsync(string courseId, string chapterId, CancellationToken cancellationToken = default);
    Task<ChapterSummaryDto> CreateChapterAsync(string courseId, CreateChapterRequest request, CancellationToken cancellationToken = default);
    Task<ChapterDocumentDto> UpdateChapterAsync(string courseId, string chapterId, UpdateChapterRequest request, CancellationToken cancellationToken = default);
    Task<DeleteImpactDto> GetChapterDeleteImpactAsync(string courseId, string chapterId, CancellationToken cancellationToken = default);
    Task DeleteChapterAsync(string courseId, string chapterId, CancellationToken cancellationToken = default);
    Task ReorderChapterAsync(string courseId, string chapterId, string direction, CancellationToken cancellationToken = default);

    Task<TopicDocumentDto> CreateTopicAsync(string courseId, string chapterId, CreateTopicRequest request, CancellationToken cancellationToken = default);
    Task<TopicDocumentDto> UpdateTopicAsync(string courseId, string topicId, UpdateTopicRequest request, CancellationToken cancellationToken = default);
    Task<DeleteImpactDto> GetTopicDeleteImpactAsync(string courseId, string topicId, CancellationToken cancellationToken = default);
    Task DeleteTopicAsync(string courseId, string topicId, CancellationToken cancellationToken = default);
    Task ReorderTopicAsync(string courseId, string topicId, string direction, CancellationToken cancellationToken = default);

    Task<SubtopicDocumentDto> CreateSubtopicAsync(string courseId, string topicId, CreateSubtopicRequest request, CancellationToken cancellationToken = default);
    Task<SubtopicDocumentDto> UpdateSubtopicAsync(string courseId, string subtopicId, UpdateSubtopicRequest request, CancellationToken cancellationToken = default);
    Task<DeleteImpactDto> GetSubtopicDeleteImpactAsync(string courseId, string subtopicId, CancellationToken cancellationToken = default);
    Task DeleteSubtopicAsync(string courseId, string subtopicId, CancellationToken cancellationToken = default);
    Task ReorderSubtopicAsync(string courseId, string subtopicId, string direction, CancellationToken cancellationToken = default);

    // Story 7.3
    Task<PageDocumentDto> CreatePageAsync(string courseId, CreatePageRequest request, CancellationToken cancellationToken = default);
    // Story 11.2, FR-46: a single Page on its own -- every prior story only ever returned a Page
    // nested inside a ChapterDocumentDto/TopicDocumentDto/etc. Ownership-only read (not
    // Draft-gated), same posture as GetChapterDocumentAsync. Story 11.4's real Course Player
    // reuses this exact endpoint for its own per-Page fetch.
    Task<PageDocumentDto> GetPageAsync(string courseId, string pageId, CancellationToken cancellationToken = default);
    Task<PageDocumentDto> UpdatePageAsync(string courseId, string pageId, UpdatePageRequest request, CancellationToken cancellationToken = default);
    Task<DeleteImpactDto> GetPageDeleteImpactAsync(string courseId, string pageId, CancellationToken cancellationToken = default);
    Task DeletePageAsync(string courseId, string pageId, CancellationToken cancellationToken = default);
    Task ReorderPageAsync(string courseId, string pageId, string direction, CancellationToken cancellationToken = default);
    Task<PageDocumentDto> MovePageAsync(string courseId, string pageId, MovePageRequest request, CancellationToken cancellationToken = default);

    // Story 7.4
    Task<OutlineDto> GetOutlineAsync(string courseId, CancellationToken cancellationToken = default);

    // Story 8.1
    Task<ResourceDto> UploadResourceAsync(string courseId, ContentOwnerType ownerType, string ownerId, string label, string? caption, string? role, Stream content, string fileName, string contentType, long contentLength, CancellationToken cancellationToken = default);
    Task<ResourceDto> AttachExistingFileAsResourceAsync(string courseId, AttachExistingFileAsResourceRequest request, CancellationToken cancellationToken = default);
    Task<ResourceDto> UpdateResourceAsync(string courseId, string resourceId, UpdateResourceRequest request, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ResourceDto>> GetResourcesByOwnerAsync(string courseId, ContentOwnerType ownerType, string ownerId, CancellationToken cancellationToken = default);
    Task ReorderResourceAsync(string courseId, string resourceId, string direction, CancellationToken cancellationToken = default);
    // Story 8.3: `forceRemoveFromContent` defaults false (Story 8.1's original callers/tests are
    // source-compatible unchanged) -- true performs FR-31's "Remove from content and delete"
    // action (strips every `resource:{id}` reference from every referencing Page's BodyMarkdown,
    // then deletes, in the same commit); false throws ConflictException naming the referencing
    // Page(s) when any exist, otherwise deletes unconditionally exactly as Story 8.1 did.
    Task DeleteResourceAsync(string courseId, string resourceId, bool forceRemoveFromContent = false, CancellationToken cancellationToken = default);

    // Story 8.3, AD-29: the owner (tutor) binary-serving read path -- reviewer/student branches
    // on this same route are Story 11.3's scope, not built here.
    Task<ResourceContentDto> GetResourceContentAsync(string courseId, string resourceId, CancellationToken cancellationToken = default);
}

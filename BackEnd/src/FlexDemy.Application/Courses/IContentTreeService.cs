namespace FlexDemy.Application.Courses;

// AD-3: plain service interface, no mediator. Every method starts with the same
// ICourseService.EnsureOwnedDraftAsync ownership+Draft-state guard CourseFileService already uses.
public interface IContentTreeService
{
    // Also the materialize-on-read entry point (Task 6) -- folds any pending, successfully
    // extracted CourseFile rows into real Chapters before returning.
    Task<IReadOnlyList<ChapterDto>> GetTreeAsync(string courseId, CancellationToken cancellationToken = default);

    Task<ChapterDto> AddChapterAsync(string courseId, CancellationToken cancellationToken = default);
    Task<TopicDto> AddTopicAsync(string courseId, string chapterId, CancellationToken cancellationToken = default);
    Task<SubtopicDto> AddSubtopicAsync(string courseId, string topicId, CancellationToken cancellationToken = default);
    // parentType is "topic" or "subtopic" -- resolved by the caller (see ContentTreeController/Task 10's note
    // on why the frontend's AddableNodeType 'contentBlock' value can't be used as parentType directly).
    Task<ContentBlockDto> AddContentBlockAsync(string courseId, string parentId, string parentType, CancellationToken cancellationToken = default);

    // Chapter/Topic/Subtopic only -- a ContentBlock has no Title (ValidationException otherwise).
    // Never resets confirmation (FR-15: a title edit is always text-only).
    Task EditNodeTitleAsync(string courseId, string nodeId, string title, CancellationToken cancellationToken = default);

    // Confirmation-reset rule replicated byte-for-byte from useCourseContentTree.ts's editContentBlock:
    // Text/Lang-only touched fields preserve confirmation (including a fully empty patch -- vacuously
    // text-only); Notation/ImageUrl/AltText/Format touched resets it if it was Confirmed.
    Task EditContentBlockAsync(string courseId, string blockId, UpdateContentBlockRequest patch, CancellationToken cancellationToken = default);

    // Cascades via the DB FK behavior for Chapter/Topic/Subtopic; renumbers remaining siblings'
    // Order to a contiguous range and resets the immediate parent's confirmation (no-op for a
    // top-level Chapter, which has no parent).
    Task DeleteNodeAsync(string courseId, string nodeId, CancellationToken cancellationToken = default);

    // direction is "up"/"down". A no-op (not an error) at either end of the sibling group.
    Task ReorderNodeAsync(string courseId, string nodeId, string direction, CancellationToken cancellationToken = default);

    // A no-op (not an error) if draggedId/targetId don't share the same parent/sibling group.
    Task MoveNodeAsync(string courseId, string draggedId, string targetId, CancellationToken cancellationToken = default);

    Task ConfirmNodeAsync(string courseId, string nodeId, CancellationToken cancellationToken = default);
}

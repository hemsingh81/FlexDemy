using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

// Lightweight list entry -- id/title/order only, used to decide "does this course already have
// a chapter" without paying for the full nested document fetch (ChapterDocumentDto below).
public record ChapterSummaryDto(string Id, string Title, int Order);

// Story 8.1: a Resource can attach to any of the four owner kinds (Chapter/Topic/Subtopic/Page,
// AD-20) -- every document DTO below carries a `Resources` list alongside its own children. No
// `Url` field here -- GET .../resources/{resourceId}/content (Story 8.3's Task 1, AD-29's
// authenticated-read pattern) is the only way to reach a resource's bytes; a resource row's
// download affordance resolves its URL on demand from the `Id` already in this array.
public record ResourceDto(string Id, string Label, string? Caption, string Role, int Order, string Status, string? FailureReason, string FileName, string ContentType, long SizeBytes);

// Story 7.3: a Page can attach directly to a Chapter, Topic, or Subtopic (FR-2) -- each of those
// three document DTOs below carries its own `Pages` list alongside its structural children.
public record PageDocumentDto(string Id, string Title, string BodyMarkdown, bool IsConfirmed, int Order, IReadOnlyList<ResourceDto> Resources);

// Story 7.2: real fields, replacing Story 7.1's empty placeholder. Story 7.3 adds `Pages`.
public record TopicDocumentDto(string Id, string Title, string Description, int Order, bool IsConfirmed, IReadOnlyList<SubtopicDocumentDto> Subtopics, IReadOnlyList<PageDocumentDto> Pages, IReadOnlyList<ResourceDto> Resources);

public record SubtopicDocumentDto(string Id, string Title, string Description, int Order, bool IsConfirmed, IReadOnlyList<PageDocumentDto> Pages, IReadOnlyList<ResourceDto> Resources);

// The full nested document a Chapter's Tiptap canvas fetches in one call (distinct from the
// lightweight GET .../chapters list above, and from the whole-course GET .../outline a later
// story adds). Description IS included here (short, Markdown-lite, cheap) -- this is what makes
// it a "document" fetch rather than an "outline stub" fetch. Story 7.3 adds `Pages` (a Chapter's
// own directly-attached Pages, alongside its Topics).
public record ChapterDocumentDto(string Id, string CourseId, string Title, string Description, bool IsConfirmed, IReadOnlyList<TopicDocumentDto> Topics, IReadOnlyList<PageDocumentDto> Pages, IReadOnlyList<ResourceDto> Resources);

public record CreateChapterRequest(string Title);

public record UpdateChapterRequest(string Title, string? Description);

// Story 7.2: cascade-delete confirmation counts (FR-6/AC #3), one shared shape reused by
// Chapter/Topic/Subtopic delete-impact reads. `Pages`/`PageResources`/`NodeResources` are always
// 0 until Stories 7.3/8.1 exist -- see ContentService's own TODO markers at each computation.
public record DeleteImpactDto(int Topics, int Subtopics, int Pages, int PageResources, int NodeResources);

public record CreateTopicRequest(string Title);

public record UpdateTopicRequest(string Title, string? Description);

public record CreateSubtopicRequest(string Title);

public record UpdateSubtopicRequest(string Title, string? Description);

public record ReorderRequest(string Direction);

// Story 7.3
public record CreatePageRequest(ContentOwnerType OwnerType, string OwnerId, string Title);

public record UpdatePageRequest(string Title, string? BodyMarkdown);

public record MovePageRequest(ContentOwnerType OwnerType, string OwnerId);

// Story 7.4: the whole-course, body-free outline (AD-4's CourseContentContext data source) --
// materially distinct from ChapterDocumentDto (which fetches ONE Chapter, full bodies included).
// No BodyMarkdown anywhere in this shape; that omission is the entire point of it existing
// alongside GetChapterDocumentAsync, not a subset built from it.
public record OutlinePageDto(string Id, string Title, bool IsConfirmed, int Order);

public record OutlineSubtopicDto(string Id, string Title, string Description, bool IsConfirmed, int Order, IReadOnlyList<OutlinePageDto> Pages);

public record OutlineTopicDto(string Id, string Title, string Description, bool IsConfirmed, int Order, IReadOnlyList<OutlineSubtopicDto> Subtopics, IReadOnlyList<OutlinePageDto> Pages);

public record OutlineChapterDto(string Id, string Title, string Description, bool IsConfirmed, int Order, IReadOnlyList<OutlineTopicDto> Topics, IReadOnlyList<OutlinePageDto> Pages);

public record OutlineDto(IReadOnlyList<OutlineChapterDto> Chapters);

// Story 8.1
public record UpdateResourceRequest(string Label, string? Caption, string Role);

public record AttachExistingFileAsResourceRequest(ContentOwnerType OwnerType, string OwnerId, string CourseFileId, string? Role);

// Story 8.3, AD-29: mirrors CourseFileService.CourseFileDownload's exact shape -- the same
// binary-serving pattern, applied to a Resource instead of a CourseFile.
public sealed record ResourceContentDto(Stream Content, string ContentType, string FileName);

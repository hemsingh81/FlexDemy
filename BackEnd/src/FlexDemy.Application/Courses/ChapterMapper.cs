using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

public static class ChapterMapper
{
    public static ChapterSummaryDto ToSummaryDto(this Chapter chapter) =>
        new(chapter.Id, chapter.Title, chapter.Order);

    // Story 7.2: `topics` is already-fetched-and-mapped by the caller (ContentService), since
    // assembling it requires async repository calls a static mapper can't make itself -- this
    // keeps the mapping itself centralized/static while sourcing the data is the service's job,
    // same split TopicMapper.ToDocumentDto below uses for its own Subtopics. Story 7.3 adds
    // `pages` on the same basis.
    public static ChapterDocumentDto ToDocumentDto(this Chapter chapter, IReadOnlyList<TopicDocumentDto> topics, IReadOnlyList<PageDocumentDto> pages, IReadOnlyList<ResourceDto> resources) =>
        new(chapter.Id, chapter.CourseId, chapter.Title, chapter.Description, chapter.IsConfirmed, topics, pages, resources);
}

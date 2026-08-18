using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

public static class TopicMapper
{
    public static TopicDocumentDto ToDocumentDto(this Topic topic, IReadOnlyList<SubtopicDocumentDto> subtopics, IReadOnlyList<PageDocumentDto> pages, IReadOnlyList<ResourceDto> resources) =>
        new(topic.Id, topic.Title, topic.Description, topic.Order, topic.IsConfirmed, subtopics, pages, resources);
}

public static class SubtopicMapper
{
    public static SubtopicDocumentDto ToDocumentDto(this Subtopic subtopic, IReadOnlyList<PageDocumentDto> pages, IReadOnlyList<ResourceDto> resources) =>
        new(subtopic.Id, subtopic.Title, subtopic.Description, subtopic.Order, subtopic.IsConfirmed, pages, resources);
}

public static class PageMapper
{
    public static PageDocumentDto ToDocumentDto(this Page page, IReadOnlyList<ResourceDto> resources) =>
        new(page.Id, page.Title, page.BodyMarkdown, page.IsConfirmed, page.Order, resources);
}

using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

// AD-10: mapping lives beside the service that owns it, as a static class -- no AutoMapper.
public static class ContentTreeMapper
{
    public static ChapterDto ToDto(this Chapter chapter) => new(
        chapter.Id,
        chapter.Title,
        chapter.Confirmation.ToString(),
        chapter.Order,
        chapter.Topics.OrderBy(t => t.Order).Select(t => t.ToDto()).ToList()
    );

    public static TopicDto ToDto(this Topic topic) => new(
        topic.Id,
        topic.Title,
        topic.Confirmation.ToString(),
        topic.Order,
        topic.Subtopics.OrderBy(s => s.Order).Select(s => s.ToDto()).ToList(),
        topic.ContentBlocks.OrderBy(b => b.Order).Select(b => b.ToDto()).ToList()
    );

    public static SubtopicDto ToDto(this Subtopic subtopic) => new(
        subtopic.Id,
        subtopic.Title,
        subtopic.Confirmation.ToString(),
        subtopic.Order,
        subtopic.ContentBlocks.OrderBy(b => b.Order).Select(b => b.ToDto()).ToList()
    );

    public static ContentBlockDto ToDto(this ContentBlock block) => new(
        block.Id,
        block.Format.ToString(),
        block.Confirmation.ToString(),
        block.Order,
        block.Text,
        block.Lang,
        block.Notation,
        block.ImageUrl,
        block.AltText
    );
}

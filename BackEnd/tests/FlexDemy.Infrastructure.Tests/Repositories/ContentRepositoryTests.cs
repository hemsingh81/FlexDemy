using FlexDemy.Domain.Courses;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

// Uses EF Core's InMemory provider rather than a real Postgres instance -- fast, no Docker
// dependency for unit tests.
public class ContentRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static Chapter MakeChapter(string id, string courseId = "course_1", string title = "", int order = 0) => new()
    {
        Id = id,
        CourseId = courseId,
        Title = title.Length > 0 ? title : $"Chapter {id}",
        Order = order,
    };

    [Fact]
    public async Task Add_then_SaveChanges_persists_the_chapter()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);

        repository.Add(MakeChapter("chapter_1", title: "Chemical Reactions"));
        await db.SaveChangesAsync();

        var found = await repository.GetChapterByIdAsync("chapter_1");
        Assert.NotNull(found);
        Assert.Equal("Chemical Reactions", found!.Title);
    }

    [Fact]
    public async Task GetChapterByIdAsync_returns_null_for_an_unknown_id()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);

        Assert.Null(await repository.GetChapterByIdAsync("does_not_exist"));
    }

    [Fact]
    public async Task GetChaptersByCourseIdAsync_returns_only_that_courses_chapters_ordered_by_Order()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        repository.Add(MakeChapter("c1", courseId: "course_1", order: 1));
        repository.Add(MakeChapter("c2", courseId: "course_1", order: 0));
        repository.Add(MakeChapter("c3", courseId: "course_2", order: 0));
        await db.SaveChangesAsync();

        var result = await repository.GetChaptersByCourseIdAsync("course_1");

        Assert.Equal(2, result.Count);
        Assert.Equal("c2", result[0].Id);
        Assert.Equal("c1", result[1].Id);
    }

    [Fact]
    public async Task GetChaptersByCourseIdAsync_returns_empty_for_a_course_with_no_chapters()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);

        var result = await repository.GetChaptersByCourseIdAsync("course_with_nothing");

        Assert.Empty(result);
    }

    [Fact]
    public async Task Soft_deleted_chapters_are_excluded_by_the_global_query_filter()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        var chapter = MakeChapter("chapter_1");
        chapter.IsDeleted = true;
        repository.Add(chapter);
        await db.SaveChangesAsync();

        Assert.Null(await repository.GetChapterByIdAsync("chapter_1"));
        Assert.Empty(await repository.GetChaptersByCourseIdAsync("course_1"));
    }

    [Fact]
    public async Task Remove_chapter_then_SaveChanges_deletes_it()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        var chapter = MakeChapter("chapter_1");
        repository.Add(chapter);
        await db.SaveChangesAsync();

        repository.Remove(chapter);
        await db.SaveChangesAsync();

        Assert.Null(await repository.GetChapterByIdAsync("chapter_1"));
    }

    // ── Story 7.2: Topic ─────────────────────────────────────────────────────────────────────

    private static Topic MakeTopic(string id, string chapterId = "chapter_1", int order = 0) => new()
    {
        Id = id,
        ChapterId = chapterId,
        Title = $"Topic {id}",
        Order = order,
    };

    [Fact]
    public async Task Add_then_SaveChanges_persists_the_topic()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);

        repository.Add(MakeTopic("topic_1"));
        await db.SaveChangesAsync();

        var found = await repository.GetTopicByIdAsync("topic_1");
        Assert.NotNull(found);
        Assert.Equal("chapter_1", found!.ChapterId);
    }

    [Fact]
    public async Task GetTopicsByChapterIdAsync_returns_only_that_chapters_topics_ordered_by_Order()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        repository.Add(MakeTopic("t1", chapterId: "chapter_1", order: 1));
        repository.Add(MakeTopic("t2", chapterId: "chapter_1", order: 0));
        repository.Add(MakeTopic("t3", chapterId: "chapter_2", order: 0));
        await db.SaveChangesAsync();

        var result = await repository.GetTopicsByChapterIdAsync("chapter_1");

        Assert.Equal(2, result.Count);
        Assert.Equal("t2", result[0].Id);
        Assert.Equal("t1", result[1].Id);
    }

    [Fact]
    public async Task Remove_topic_then_SaveChanges_deletes_it()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        var topic = MakeTopic("topic_1");
        repository.Add(topic);
        await db.SaveChangesAsync();

        repository.Remove(topic);
        await db.SaveChangesAsync();

        Assert.Null(await repository.GetTopicByIdAsync("topic_1"));
    }

    // ── Story 7.2: Subtopic ──────────────────────────────────────────────────────────────────

    private static Subtopic MakeSubtopic(string id, string topicId = "topic_1", int order = 0) => new()
    {
        Id = id,
        TopicId = topicId,
        Title = $"Subtopic {id}",
        Order = order,
    };

    [Fact]
    public async Task Add_then_SaveChanges_persists_the_subtopic()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);

        repository.Add(MakeSubtopic("subtopic_1"));
        await db.SaveChangesAsync();

        var found = await repository.GetSubtopicByIdAsync("subtopic_1");
        Assert.NotNull(found);
        Assert.Equal("topic_1", found!.TopicId);
    }

    [Fact]
    public async Task GetSubtopicsByTopicIdAsync_returns_only_that_topics_subtopics_ordered_by_Order()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        repository.Add(MakeSubtopic("s1", topicId: "topic_1", order: 1));
        repository.Add(MakeSubtopic("s2", topicId: "topic_1", order: 0));
        repository.Add(MakeSubtopic("s3", topicId: "topic_2", order: 0));
        await db.SaveChangesAsync();

        var result = await repository.GetSubtopicsByTopicIdAsync("topic_1");

        Assert.Equal(2, result.Count);
        Assert.Equal("s2", result[0].Id);
        Assert.Equal("s1", result[1].Id);
    }

    [Fact]
    public async Task Remove_subtopic_then_SaveChanges_deletes_it()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        var subtopic = MakeSubtopic("subtopic_1");
        repository.Add(subtopic);
        await db.SaveChangesAsync();

        repository.Remove(subtopic);
        await db.SaveChangesAsync();

        Assert.Null(await repository.GetSubtopicByIdAsync("subtopic_1"));
    }

    // ── Story 7.3: Page ──────────────────────────────────────────────────────────────────────

    private static Page MakePage(string id, ContentOwnerType ownerType = ContentOwnerType.Chapter, string ownerId = "chapter_1", int order = 0) => new()
    {
        Id = id,
        OwnerType = ownerType,
        OwnerId = ownerId,
        Title = $"Page {id}",
        Order = order,
    };

    [Fact]
    public async Task Add_then_SaveChanges_persists_the_page()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);

        repository.Add(MakePage("page_1", ContentOwnerType.Topic, "topic_1"));
        await db.SaveChangesAsync();

        var found = await repository.GetPageByIdAsync("page_1");
        Assert.NotNull(found);
        Assert.Equal(ContentOwnerType.Topic, found!.OwnerType);
        Assert.Equal("topic_1", found.OwnerId);
    }

    [Fact]
    public async Task GetPagesByOwnerAsync_returns_only_pages_matching_both_OwnerType_and_OwnerId_ordered_by_Order()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        repository.Add(MakePage("p1", ContentOwnerType.Chapter, "chapter_1", order: 1));
        repository.Add(MakePage("p2", ContentOwnerType.Chapter, "chapter_1", order: 0));
        // Same OwnerId value, different OwnerType -- must not be treated as the same owner.
        repository.Add(MakePage("p3", ContentOwnerType.Topic, "chapter_1", order: 0));
        // Same OwnerType, different OwnerId.
        repository.Add(MakePage("p4", ContentOwnerType.Chapter, "chapter_2", order: 0));
        await db.SaveChangesAsync();

        var result = await repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1");

        Assert.Equal(2, result.Count);
        Assert.Equal("p2", result[0].Id);
        Assert.Equal("p1", result[1].Id);
    }

    [Fact]
    public async Task Remove_page_then_SaveChanges_deletes_it()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        var page = MakePage("page_1");
        repository.Add(page);
        await db.SaveChangesAsync();

        repository.Remove(page);
        await db.SaveChangesAsync();

        Assert.Null(await repository.GetPageByIdAsync("page_1"));
    }

    [Fact]
    public void PageConfiguration_stores_OwnerType_as_a_string_column_not_an_ordinal()
    {
        // EF Core's InMemory provider stores CLR values directly and doesn't thread a configured
        // ValueConverter through IProperty.GetValueConverter() the way a relational provider
        // does (Backend/CLAUDE.md's documented InMemory-vs-real-Postgres gap) -- ProviderClrType
        // is the one piece of `.HasConversion<string>()`'s effect InMemory still surfaces
        // correctly, so it's what this test can meaningfully assert without a live Postgres.
        using var db = NewContext();
        var property = db.Model.FindEntityType(typeof(Page))!.FindProperty(nameof(Page.OwnerType))!;

        Assert.Equal(typeof(string), property.GetProviderClrType());
    }

    [Theory]
    [InlineData(ContentOwnerType.Chapter, "Chapter")]
    [InlineData(ContentOwnerType.Topic, "Topic")]
    [InlineData(ContentOwnerType.Subtopic, "Subtopic")]
    [InlineData(ContentOwnerType.Page, "Page")]
    public void EnumToStringConverter_matches_ContentOwnerTypes_pinned_member_spelling(ContentOwnerType value, string expectedWireValue)
    {
        // PageConfiguration's `.HasConversion<string>()` resolves to exactly this converter type
        // for an enum property -- pinning its actual behavior against the enum's real member
        // names (not a hand-written string table that could silently drift from a future rename).
        var converter = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.EnumToStringConverter<ContentOwnerType>();

        Assert.Equal(expectedWireValue, converter.ConvertToProvider(value));
    }

    // -- GetCourseFileIdsWithResourcesAsync (Story 10.2, FR-23) ------------------------------------

    private static Resource MakeResource(string id, string? courseFileId, string ownerId = "page_1") => new()
    {
        Id = id,
        OwnerType = ContentOwnerType.Page,
        OwnerId = ownerId,
        CourseFileId = courseFileId,
        Label = "Syllabus",
        FileName = "syllabus.pdf",
        ContentType = "application/pdf",
        StoredUrl = $"/u/{id}.pdf",
    };

    [Fact]
    public async Task GetCourseFileIdsWithResourcesAsync_returns_only_ids_with_at_least_one_Resource_referencing_them()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        repository.Add(MakeResource("r1", courseFileId: "file_1"));
        repository.Add(MakeResource("r2", courseFileId: "file_2"));
        repository.Add(MakeResource("r3", courseFileId: null)); // directly uploaded, never attached from a CourseFile
        await db.SaveChangesAsync();

        var result = await repository.GetCourseFileIdsWithResourcesAsync(["file_1", "file_2", "file_3"]);

        Assert.Equal(2, result.Count);
        Assert.Contains("file_1", result);
        Assert.Contains("file_2", result);
    }

    [Fact]
    public async Task GetCourseFileIdsWithResourcesAsync_deduplicates_when_multiple_Resources_reference_the_same_CourseFileId()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        repository.Add(MakeResource("r1", courseFileId: "file_1", ownerId: "page_1"));
        repository.Add(MakeResource("r2", courseFileId: "file_1", ownerId: "page_2"));
        await db.SaveChangesAsync();

        var result = await repository.GetCourseFileIdsWithResourcesAsync(["file_1"]);

        Assert.Equal(["file_1"], result);
    }

    [Fact]
    public async Task GetCourseFileIdsWithResourcesAsync_returns_empty_for_an_empty_input_collection()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        repository.Add(MakeResource("r1", courseFileId: "file_1"));
        await db.SaveChangesAsync();

        var result = await repository.GetCourseFileIdsWithResourcesAsync([]);

        Assert.Empty(result);
    }

    // -- HasUnconfirmedContentAsync (Story 11.1, FR-45) --------------------------------------------

    [Fact]
    public async Task HasUnconfirmedContentAsync_returns_false_when_every_node_and_page_is_confirmed()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        repository.Add(new Chapter { Id = "c1", CourseId = "course_1", Title = "Chapter 1", IsConfirmed = true });
        repository.Add(new Topic { Id = "t1", ChapterId = "c1", Title = "Topic 1", IsConfirmed = true });
        repository.Add(new Subtopic { Id = "s1", TopicId = "t1", Title = "Subtopic 1", IsConfirmed = true });
        repository.Add(new Page { Id = "p1", OwnerType = ContentOwnerType.Subtopic, OwnerId = "s1", Title = "Page 1", IsConfirmed = true });
        await db.SaveChangesAsync();

        Assert.False(await repository.HasUnconfirmedContentAsync("course_1"));
    }

    [Fact]
    public async Task HasUnconfirmedContentAsync_returns_true_when_the_Chapter_itself_is_unconfirmed()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        repository.Add(new Chapter { Id = "c1", CourseId = "course_1", Title = "Chapter 1", IsConfirmed = false });
        await db.SaveChangesAsync();

        Assert.True(await repository.HasUnconfirmedContentAsync("course_1"));
    }

    [Fact]
    public async Task HasUnconfirmedContentAsync_returns_true_when_a_Sub_Topic_three_levels_deep_is_unconfirmed()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        repository.Add(new Chapter { Id = "c1", CourseId = "course_1", Title = "Chapter 1", IsConfirmed = true });
        repository.Add(new Topic { Id = "t1", ChapterId = "c1", Title = "Topic 1", IsConfirmed = true });
        repository.Add(new Subtopic { Id = "s1", TopicId = "t1", Title = "Subtopic 1", IsConfirmed = false });
        await db.SaveChangesAsync();

        Assert.True(await repository.HasUnconfirmedContentAsync("course_1"));
    }

    // Page confirmation counts identically to node confirmation for this gate (FR-44's own "node or
    // page" scope) -- one test per owner level, since a Page can be owned by any of the three.
    [Theory]
    [InlineData("Chapter")]
    [InlineData("Topic")]
    [InlineData("Subtopic")]
    public async Task HasUnconfirmedContentAsync_returns_true_when_an_unconfirmed_Page_is_owned_by_any_node_level(string ownerLevel)
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        repository.Add(new Chapter { Id = "c1", CourseId = "course_1", Title = "Chapter 1", IsConfirmed = true });
        repository.Add(new Topic { Id = "t1", ChapterId = "c1", Title = "Topic 1", IsConfirmed = true });
        repository.Add(new Subtopic { Id = "s1", TopicId = "t1", Title = "Subtopic 1", IsConfirmed = true });
        var (ownerType, ownerId) = ownerLevel switch
        {
            "Chapter" => (ContentOwnerType.Chapter, "c1"),
            "Topic" => (ContentOwnerType.Topic, "t1"),
            _ => (ContentOwnerType.Subtopic, "s1"),
        };
        repository.Add(new Page { Id = "p1", OwnerType = ownerType, OwnerId = ownerId, Title = "Page 1", IsConfirmed = false });
        await db.SaveChangesAsync();

        Assert.True(await repository.HasUnconfirmedContentAsync("course_1"));
    }

    // A course with zero content vacuously passes -- nothing exists to be Unconfirmed. See this
    // story's own Completion Notes for why this is the deliberate, documented reading of FR-45.
    [Fact]
    public async Task HasUnconfirmedContentAsync_returns_false_for_a_course_with_no_chapters_at_all()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);

        Assert.False(await repository.HasUnconfirmedContentAsync("course_with_nothing"));
    }

    [Fact]
    public async Task HasUnconfirmedContentAsync_only_considers_the_given_courses_own_content()
    {
        await using var db = NewContext();
        var repository = new ContentRepository(db);
        repository.Add(new Chapter { Id = "c1", CourseId = "course_1", Title = "Chapter 1", IsConfirmed = true });
        repository.Add(new Chapter { Id = "c2", CourseId = "course_2", Title = "Chapter 2", IsConfirmed = false });
        await db.SaveChangesAsync();

        Assert.False(await repository.HasUnconfirmedContentAsync("course_1"));
        Assert.True(await repository.HasUnconfirmedContentAsync("course_2"));
    }
}

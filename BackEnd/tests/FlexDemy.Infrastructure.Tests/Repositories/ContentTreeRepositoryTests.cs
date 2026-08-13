using FlexDemy.Domain.Courses;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

// Uses EF Core's InMemory provider -- fast, no Docker dependency. Cascade-delete fixup happens in
// EF's own change tracker (not pushed down to the database provider), so it's exercised correctly
// here even without real Postgres.
public class ContentTreeRepositoryTests
{
    private const string CourseId = "course_1";

    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static Course MakeCourse(string id = CourseId) => new()
    {
        Id = id,
        Title = "Course",
        Subject = "physics",
        Level = "Beginner",
        TargetGradeTag = "Class 12th",
        InstructorName = "Dr. Rostova",
        LifecycleState = LifecycleState.Draft,
        TutorId = "tutor_1",
    };

    [Fact]
    public async Task GetTreeAsync_returns_the_full_nested_graph()
    {
        // Order-sortedness within .Include(...OrderBy...) is a real relational-provider feature
        // (translates to real ORDER BY inside the generated SQL) EF Core's InMemory provider
        // doesn't reliably reproduce -- same category of gap BackEnd/CLAUDE.md's Testing section
        // already documents for other provider-specific translation limits. This test verifies
        // the graph is fully assembled (right nesting, nothing dropped); the actual Order-sorted
        // sequencing is a live-Postgres verification concern (Dev Notes).
        await using var db = NewContext();
        db.Courses.Add(MakeCourse());
        var chapter = new Chapter { Id = "chapter_1", CourseId = CourseId, Title = "Chapter 1", Order = 0 };
        var topicB = new Topic { Id = "topic_b", ChapterId = "chapter_1", Title = "Topic B", Order = 1 };
        var topicA = new Topic { Id = "topic_a", ChapterId = "chapter_1", Title = "Topic A", Order = 0 };
        var subtopic = new Subtopic { Id = "subtopic_1", TopicId = "topic_a", Title = "Subtopic 1", Order = 0 };
        var blockUnderSubtopic = new ContentBlock { Id = "block_1", SubtopicId = "subtopic_1", Format = ContentBlockFormat.Text, Text = "hi", Order = 0 };
        var blockUnderTopic = new ContentBlock { Id = "block_2", TopicId = "topic_b", Format = ContentBlockFormat.Text, Text = "hi", Order = 0 };
        db.Chapters.Add(chapter);
        db.Topics.AddRange(topicB, topicA);
        db.Subtopics.Add(subtopic);
        db.ContentBlocks.AddRange(blockUnderSubtopic, blockUnderTopic);
        await db.SaveChangesAsync();

        var repository = new ContentTreeRepository(db);
        var tree = await repository.GetTreeAsync(CourseId);

        var resultChapter = Assert.Single(tree);
        Assert.Equal(2, resultChapter.Topics.Count);
        Assert.Equal(["topic_a", "topic_b"], resultChapter.Topics.Select(t => t.Id).OrderBy(id => id));
        var resultTopicA = resultChapter.Topics.Single(t => t.Id == "topic_a");
        var resultTopicB = resultChapter.Topics.Single(t => t.Id == "topic_b");
        Assert.Single(resultTopicA.Subtopics);
        Assert.Single(resultTopicA.Subtopics[0].ContentBlocks);
        Assert.Single(resultTopicB.ContentBlocks);
    }

    [Fact]
    public async Task GetTreeAsync_scopes_to_the_given_courseId()
    {
        await using var db = NewContext();
        db.Courses.AddRange(MakeCourse(), MakeCourse("course_2"));
        db.Chapters.Add(new Chapter { Id = "chapter_1", CourseId = CourseId, Title = "Mine", Order = 0 });
        db.Chapters.Add(new Chapter { Id = "chapter_2", CourseId = "course_2", Title = "Not mine", Order = 0 });
        await db.SaveChangesAsync();

        var repository = new ContentTreeRepository(db);
        var tree = await repository.GetTreeAsync(CourseId);

        var resultChapter = Assert.Single(tree);
        Assert.Equal("chapter_1", resultChapter.Id);
    }

    [Fact]
    public async Task Removing_a_chapter_cascades_to_its_topics_subtopics_and_content_blocks()
    {
        await using var db = NewContext();
        db.Courses.Add(MakeCourse());
        var chapter = new Chapter { Id = "chapter_1", CourseId = CourseId, Title = "Chapter 1", Order = 0 };
        var topic = new Topic { Id = "topic_1", ChapterId = "chapter_1", Title = "Topic 1", Order = 0 };
        var subtopic = new Subtopic { Id = "subtopic_1", TopicId = "topic_1", Title = "Subtopic 1", Order = 0 };
        var block = new ContentBlock { Id = "block_1", SubtopicId = "subtopic_1", Format = ContentBlockFormat.Text, Text = "hi", Order = 0 };
        db.Chapters.Add(chapter);
        db.Topics.Add(topic);
        db.Subtopics.Add(subtopic);
        db.ContentBlocks.Add(block);
        await db.SaveChangesAsync();

        var repository = new ContentTreeRepository(db);
        // Reload through the repository so the full graph is tracked -- EF's change tracker only
        // cascades a delete to navigation properties it actually knows are loaded.
        var loadedChapter = Assert.Single(await repository.GetTreeAsync(CourseId));
        repository.RemoveChapter(await db.Chapters.FirstAsync(c => c.Id == loadedChapter.Id));
        await db.SaveChangesAsync();

        Assert.Empty(await db.Chapters.ToListAsync());
        Assert.Empty(await db.Topics.ToListAsync());
        Assert.Empty(await db.Subtopics.ToListAsync());
        Assert.Empty(await db.ContentBlocks.ToListAsync());
    }

    [Fact]
    public async Task FindNodeAsync_identifies_a_chapter()
    {
        await using var db = NewContext();
        db.Courses.Add(MakeCourse());
        db.Chapters.Add(new Chapter { Id = "chapter_1", CourseId = CourseId, Title = "Chapter 1", Order = 0 });
        await db.SaveChangesAsync();
        var repository = new ContentTreeRepository(db);

        var node = await repository.FindNodeAsync(CourseId, "chapter_1");

        Assert.NotNull(node);
        Assert.NotNull(node!.Chapter);
        Assert.Null(node.Topic);
    }

    [Fact]
    public async Task FindNodeAsync_identifies_a_topic()
    {
        await using var db = NewContext();
        db.Courses.Add(MakeCourse());
        db.Chapters.Add(new Chapter { Id = "chapter_1", CourseId = CourseId, Title = "Chapter 1", Order = 0 });
        db.Topics.Add(new Topic { Id = "topic_1", ChapterId = "chapter_1", Title = "Topic 1", Order = 0 });
        await db.SaveChangesAsync();
        var repository = new ContentTreeRepository(db);

        var node = await repository.FindNodeAsync(CourseId, "topic_1");

        Assert.NotNull(node);
        Assert.NotNull(node!.Topic);
        Assert.Equal("topic_1", node.Topic!.Id);
    }

    [Fact]
    public async Task FindNodeAsync_identifies_a_subtopic()
    {
        await using var db = NewContext();
        db.Courses.Add(MakeCourse());
        db.Chapters.Add(new Chapter { Id = "chapter_1", CourseId = CourseId, Title = "Chapter 1", Order = 0 });
        db.Topics.Add(new Topic { Id = "topic_1", ChapterId = "chapter_1", Title = "Topic 1", Order = 0 });
        db.Subtopics.Add(new Subtopic { Id = "subtopic_1", TopicId = "topic_1", Title = "Subtopic 1", Order = 0 });
        await db.SaveChangesAsync();
        var repository = new ContentTreeRepository(db);

        var node = await repository.FindNodeAsync(CourseId, "subtopic_1");

        Assert.NotNull(node);
        Assert.NotNull(node!.Subtopic);
        Assert.Equal("subtopic_1", node.Subtopic!.Id);
    }

    [Fact]
    public async Task FindNodeAsync_identifies_a_content_block_under_a_topic()
    {
        await using var db = NewContext();
        db.Courses.Add(MakeCourse());
        db.Chapters.Add(new Chapter { Id = "chapter_1", CourseId = CourseId, Title = "Chapter 1", Order = 0 });
        db.Topics.Add(new Topic { Id = "topic_1", ChapterId = "chapter_1", Title = "Topic 1", Order = 0 });
        db.ContentBlocks.Add(new ContentBlock { Id = "block_1", TopicId = "topic_1", Format = ContentBlockFormat.Text, Text = "hi", Order = 0 });
        await db.SaveChangesAsync();
        var repository = new ContentTreeRepository(db);

        var node = await repository.FindNodeAsync(CourseId, "block_1");

        Assert.NotNull(node);
        Assert.NotNull(node!.ContentBlock);
        Assert.Equal("block_1", node.ContentBlock!.Id);
    }

    [Fact]
    public async Task FindNodeAsync_returns_null_for_an_unknown_id()
    {
        await using var db = NewContext();
        var repository = new ContentTreeRepository(db);

        Assert.Null(await repository.FindNodeAsync(CourseId, "does_not_exist"));
    }

    [Fact]
    public async Task FindNodeAsync_returns_null_for_a_node_belonging_to_a_different_course()
    {
        await using var db = NewContext();
        db.Courses.AddRange(MakeCourse(), MakeCourse("course_2"));
        db.Chapters.Add(new Chapter { Id = "chapter_1", CourseId = "course_2", Title = "Not mine", Order = 0 });
        await db.SaveChangesAsync();
        var repository = new ContentTreeRepository(db);

        Assert.Null(await repository.FindNodeAsync(CourseId, "chapter_1"));
    }

    // Code-review regression tests (Story 3.10): VersionService.RestoreVersionAsync deserializes a
    // prior snapshot's Chapter graph and re-inserts it reusing the ORIGINAL node ids -- deliberately,
    // so cached adaptive-learning content keyed by those same ids reconnects (see that class's own
    // doc comment). A code review pass raised a concern that GetTreeAsync's result being TRACKED
    // (no AsNoTracking) would make removing a chapter and adding a new instance under the same id,
    // staged for the SAME SaveChangesAsync call, throw an EF Core identity-map collision. Verified
    // directly against a real DbContext (this is exactly the class of bug an NSubstitute-mocked
    // IContentTreeRepository could never catch) that this concern does NOT materialize: a Deleted
    // entry and a separately-tracked Added instance for the same key coexist without conflict and
    // commit correctly as DELETE-then-INSERT within one SaveChanges call, including with a nested
    // Topics graph (VersionService.RestoreVersionAsync's own real shape). These tests exist so this
    // verified-safe behavior stays regression-tested, not because a fix was needed here.
    [Fact]
    public async Task RemoveChapter_then_AddChapter_reusing_the_same_id_in_ONE_SaveChangesAsync_call_succeeds()
    {
        await using var db = NewContext();
        db.Courses.Add(MakeCourse());
        var original = new Chapter { Id = "chapter_1", CourseId = CourseId, Title = "Original", Order = 0 };
        db.Chapters.Add(original);
        await db.SaveChangesAsync();

        var repository = new ContentTreeRepository(db);
        var tracked = (await repository.GetTreeAsync(CourseId)).Single();
        repository.RemoveChapter(tracked);

        var replacement = new Chapter { Id = "chapter_1", CourseId = CourseId, Title = "Restored" };
        repository.AddChapter(replacement);

        await db.SaveChangesAsync(); // Must not throw.

        var result = await repository.GetTreeAsync(CourseId);
        var restored = Assert.Single(result);
        Assert.Equal("Restored", restored.Title);
    }

    [Fact]
    public async Task RemoveChapter_then_AddChapter_reusing_the_same_id_with_a_nested_Topic_in_ONE_SaveChangesAsync_call_succeeds()
    {
        await using var db = NewContext();
        db.Courses.Add(MakeCourse());
        var originalTopic = new Topic { Id = "topic_1", ChapterId = "chapter_1", Title = "Original Topic", Order = 0 };
        var original = new Chapter { Id = "chapter_1", CourseId = CourseId, Title = "Original", Order = 0, Topics = [originalTopic] };
        db.Chapters.Add(original);
        await db.SaveChangesAsync();

        var repository = new ContentTreeRepository(db);
        var tracked = (await repository.GetTreeAsync(CourseId)).Single();
        repository.RemoveChapter(tracked);

        var replacementTopic = new Topic { Id = "topic_1", ChapterId = "chapter_1", Title = "Restored Topic", Order = 0 };
        var replacement = new Chapter { Id = "chapter_1", CourseId = CourseId, Title = "Restored", Topics = [replacementTopic] };
        repository.AddChapter(replacement);

        await db.SaveChangesAsync(); // Must not throw.

        var result = await repository.GetTreeAsync(CourseId);
        var restoredChapter = Assert.Single(result);
        Assert.Equal("Restored", restoredChapter.Title);
        var restoredTopic = Assert.Single(restoredChapter.Topics);
        Assert.Equal("Restored Topic", restoredTopic.Title);
    }
}

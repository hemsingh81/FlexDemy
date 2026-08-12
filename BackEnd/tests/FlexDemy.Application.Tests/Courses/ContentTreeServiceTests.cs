using FlexDemy.Application.AiGateway;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using FlexDemy.Domain.Jobs;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.Courses;

public class ContentTreeServiceTests
{
    private const string CourseId = "course_1";

    private static Chapter MakeChapter(string id, NodeConfirmation confirmation = NodeConfirmation.Unconfirmed, int order = 0) =>
        new() { Id = id, CourseId = CourseId, Title = "Chapter", Confirmation = confirmation, Order = order };

    private static Topic MakeTopic(string id, string chapterId, NodeConfirmation confirmation = NodeConfirmation.Unconfirmed, int order = 0) =>
        new() { Id = id, ChapterId = chapterId, Title = "Topic", Confirmation = confirmation, Order = order };

    private static Subtopic MakeSubtopic(string id, string topicId, NodeConfirmation confirmation = NodeConfirmation.Unconfirmed, int order = 0) =>
        new() { Id = id, TopicId = topicId, Title = "Subtopic", Confirmation = confirmation, Order = order };

    private static ContentBlock MakeBlock(string id, string? topicId = null, string? subtopicId = null, NodeConfirmation confirmation = NodeConfirmation.Unconfirmed, int order = 0) =>
        new() { Id = id, TopicId = topicId, SubtopicId = subtopicId, Format = ContentBlockFormat.Text, Confirmation = confirmation, Order = order, Text = "hi", Lang = "en" };

    private sealed record Sut(
        ContentTreeService Service,
        IContentTreeRepository Repository,
        ICourseFileRepository CourseFileRepository,
        ICourseService CourseService,
        IIdGenerator IdGenerator,
        IUnitOfWork UnitOfWork,
        IAiTaskGateway AiTaskGateway);

    private static readonly AiTaskResult DefaultDescribeNotationResult =
        new("A description.", "openai", "gpt-4o-mini", new AiGatewayUsage(10, 5, 15), IsFallbackServed: false);

    private static Sut MakeSut()
    {
        var repository = Substitute.For<IContentTreeRepository>();
        var courseFileRepository = Substitute.For<ICourseFileRepository>();
        var courseService = Substitute.For<ICourseService>();
        var idGenerator = Substitute.For<IIdGenerator>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var aiTaskGateway = Substitute.For<IAiTaskGateway>();
        var logger = Substitute.For<ILogger<ContentTreeService>>();
        // GetTreeAsync's own materialization pass always runs -- default to "nothing pending" so
        // every test not exercising Task 6 doesn't have to stub this itself.
        courseFileRepository.GetPendingMaterializationAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns([]);
        // Story 2.10: sensible defaults so tests not exercising the alt-text/language auto-fill
        // behavior aren't broken by NSubstitute's own default-null Task<AiTaskResult>/Task<string>.
        courseService.GetOwningTutorIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns("tutor_1");
        aiTaskGateway.DescribeNotationAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(DefaultDescribeNotationResult);
        var service = new ContentTreeService(repository, courseFileRepository, courseService, idGenerator, unitOfWork, aiTaskGateway, logger);
        return new Sut(service, repository, courseFileRepository, courseService, idGenerator, unitOfWork, aiTaskGateway);
    }

    // -- AddTopicAsync: parent confirmation reset -------------------------------------------------

    [Fact]
    public async Task AddTopicAsync_resets_the_parent_chapters_confirmation_when_it_was_confirmed()
    {
        var sut = MakeSut();
        var chapter = MakeChapter("chapter_1", NodeConfirmation.Confirmed);
        sut.Repository.FindNodeAsync(CourseId, "chapter_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(chapter, null, null, null));
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic>());
        sut.IdGenerator.NewId().Returns("topic_new");

        await sut.Service.AddTopicAsync(CourseId, "chapter_1");

        Assert.Equal(NodeConfirmation.Unconfirmed, chapter.Confirmation);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddTopicAsync_leaves_an_already_unconfirmed_parent_chapter_unconfirmed()
    {
        var sut = MakeSut();
        var chapter = MakeChapter("chapter_1", NodeConfirmation.Unconfirmed);
        sut.Repository.FindNodeAsync(CourseId, "chapter_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(chapter, null, null, null));
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic>());
        sut.IdGenerator.NewId().Returns("topic_new");

        await sut.Service.AddTopicAsync(CourseId, "chapter_1");

        Assert.Equal(NodeConfirmation.Unconfirmed, chapter.Confirmation);
    }

    // -- EditNodeTitleAsync: never resets confirmation --------------------------------------------

    [Theory]
    [InlineData(NodeConfirmation.Confirmed)]
    [InlineData(NodeConfirmation.Unconfirmed)]
    public async Task EditNodeTitleAsync_never_resets_confirmation(NodeConfirmation initial)
    {
        var sut = MakeSut();
        var topic = MakeTopic("topic_1", "chapter_1", initial);
        sut.Repository.FindNodeAsync(CourseId, "topic_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, topic, null, null));

        await sut.Service.EditNodeTitleAsync(CourseId, "topic_1", "New Title");

        Assert.Equal("New Title", topic.Title);
        Assert.Equal(initial, topic.Confirmation);
    }

    [Fact]
    public async Task EditNodeTitleAsync_throws_ValidationException_for_a_content_block_id()
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1");
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.EditNodeTitleAsync(CourseId, "block_1", "x"));
    }

    // -- EditContentBlockAsync: FR-15 confirmation-reset rule --------------------------------------

    [Fact]
    public async Task EditContentBlockAsync_with_only_text_and_lang_preserves_confirmation()
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1", confirmation: NodeConfirmation.Confirmed);
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));
        var patch = new UpdateContentBlockRequest("updated text", "hi", null, null, null, null, new HashSet<string> { "text", "lang" });

        await sut.Service.EditContentBlockAsync(CourseId, "block_1", patch);

        Assert.Equal("updated text", block.Text);
        Assert.Equal("hi", block.Lang);
        Assert.Equal(NodeConfirmation.Confirmed, block.Confirmation);
    }

    [Theory]
    [InlineData("notation")]
    [InlineData("imageUrl")]
    [InlineData("altText")]
    public async Task EditContentBlockAsync_resets_confirmation_when_an_AI_content_affecting_field_is_touched(string touchedField)
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1", confirmation: NodeConfirmation.Confirmed);
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));
        var patch = new UpdateContentBlockRequest(null, null, "v = f\\lambda", null, null, null, new HashSet<string> { touchedField });

        await sut.Service.EditContentBlockAsync(CourseId, "block_1", patch);

        Assert.Equal(NodeConfirmation.Unconfirmed, block.Confirmation);
    }

    [Fact]
    public async Task EditContentBlockAsync_with_Format_in_the_patch_changes_the_format_and_resets_confirmation()
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1", confirmation: NodeConfirmation.Confirmed);
        block.Format = ContentBlockFormat.Text;
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));
        var patch = new UpdateContentBlockRequest(null, null, "v = f\\lambda", null, null, "Math", new HashSet<string> { "format", "notation" });

        await sut.Service.EditContentBlockAsync(CourseId, "block_1", patch);

        Assert.Equal(ContentBlockFormat.Math, block.Format);
        Assert.Equal(NodeConfirmation.Unconfirmed, block.Confirmation);
    }

    [Fact]
    public async Task EditContentBlockAsync_with_a_completely_empty_patch_preserves_confirmation()
    {
        // useCourseContentTree.ts:269's isTextOnly check is vacuously true for an empty patch
        // (Array.every on an empty array is always true) -- replicated byte-for-byte here.
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1", confirmation: NodeConfirmation.Confirmed);
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));
        var patch = new UpdateContentBlockRequest(null, null, null, null, null, null, new HashSet<string>());

        await sut.Service.EditContentBlockAsync(CourseId, "block_1", patch);

        Assert.Equal(NodeConfirmation.Confirmed, block.Confirmation);
    }

    // -- DeleteNodeAsync: renumbering + parent confirmation reset ----------------------------------

    [Fact]
    public async Task DeleteNodeAsync_renumbers_remaining_topics_and_resets_the_parent_chapters_confirmation()
    {
        var sut = MakeSut();
        var chapter = MakeChapter("chapter_1", NodeConfirmation.Confirmed);
        var topicToDelete = MakeTopic("topic_2", "chapter_1", order: 1);
        var topics = new List<Topic>
        {
            MakeTopic("topic_1", "chapter_1", order: 0),
            topicToDelete,
            MakeTopic("topic_3", "chapter_1", order: 2),
        };
        sut.Repository.FindNodeAsync(CourseId, "topic_2", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, topicToDelete, null, null));
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(chapter);
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(topics);

        await sut.Service.DeleteNodeAsync(CourseId, "topic_2");

        sut.Repository.Received(1).RemoveTopic(topicToDelete);
        Assert.Equal(0, topics[0].Order);
        Assert.Equal(1, topics[2].Order); // renumbered from 2 -> 1, no gap left behind
        Assert.Equal(NodeConfirmation.Unconfirmed, chapter.Confirmation);
    }

    [Fact]
    public async Task DeleteNodeAsync_for_a_top_level_chapter_resets_nothing_above_it()
    {
        var sut = MakeSut();
        var chapterToDelete = MakeChapter("chapter_2", order: 1);
        var chapters = new List<Chapter> { MakeChapter("chapter_1", order: 0), chapterToDelete, MakeChapter("chapter_3", order: 2) };
        sut.Repository.FindNodeAsync(CourseId, "chapter_2", Arg.Any<CancellationToken>()).Returns(new TreeNode(chapterToDelete, null, null, null));
        sut.Repository.GetChaptersByCourseIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(chapters);

        await sut.Service.DeleteNodeAsync(CourseId, "chapter_2");

        sut.Repository.Received(1).RemoveChapter(chapterToDelete);
        Assert.Equal(1, chapters[2].Order); // renumbered from 2 -> 1
    }

    // -- ReorderNodeAsync: parent reset is unconditional once the id is found ---------------------

    [Fact]
    public async Task ReorderNodeAsync_resets_the_parent_confirmation_even_when_the_swap_is_a_boundary_noop()
    {
        // Mirrors the real useCourseContentTree.ts's own surprising behavior: resetIfConfirmed
        // wraps the chapter unconditionally whenever the topic id is found at this level, even if
        // swapAdjacent itself does nothing because the topic is already at the array boundary.
        var sut = MakeSut();
        var chapter = MakeChapter("chapter_1", NodeConfirmation.Confirmed);
        var onlyTopic = MakeTopic("topic_1", "chapter_1", order: 0);
        sut.Repository.FindNodeAsync(CourseId, "topic_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, onlyTopic, null, null));
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic> { onlyTopic });
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(chapter);

        await sut.Service.ReorderNodeAsync(CourseId, "topic_1", "up"); // already at index 0 -- no-op swap

        Assert.Equal(0, onlyTopic.Order); // unchanged
        Assert.Equal(NodeConfirmation.Unconfirmed, chapter.Confirmation); // reset regardless
    }

    [Fact]
    public async Task ReorderNodeAsync_for_a_top_level_chapter_resets_nothing()
    {
        var sut = MakeSut();
        var chapters = new List<Chapter> { MakeChapter("chapter_1", order: 0), MakeChapter("chapter_2", order: 1) };
        sut.Repository.FindNodeAsync(CourseId, "chapter_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(chapters[0], null, null, null));
        sut.Repository.GetChaptersByCourseIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(chapters);

        await sut.Service.ReorderNodeAsync(CourseId, "chapter_1", "down");

        Assert.Equal(1, chapters[0].Order);
        Assert.Equal(0, chapters[1].Order);
    }

    [Fact]
    public async Task ReorderNodeAsync_rejects_an_invalid_direction()
    {
        var sut = MakeSut();
        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.ReorderNodeAsync(CourseId, "any", "sideways"));
    }

    // -- MoveNodeAsync: full-group renumbering, parent reset, cross-parent no-op -------------------

    [Fact]
    public async Task MoveNodeAsync_renumbers_the_whole_sibling_group_and_resets_the_parent()
    {
        var sut = MakeSut();
        var chapter = MakeChapter("chapter_1", NodeConfirmation.Confirmed);
        var topics = new List<Topic>
        {
            MakeTopic("topic_1", "chapter_1", order: 0),
            MakeTopic("topic_2", "chapter_1", order: 1),
            MakeTopic("topic_3", "chapter_1", order: 2),
        };
        sut.Repository.FindNodeAsync(CourseId, "topic_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, topics[0], null, null));
        sut.Repository.FindNodeAsync(CourseId, "topic_3", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, topics[2], null, null));
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(topics);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(chapter);

        // Move topic_1 to sit at topic_3's original position: [1,2,3] -> [2,3,1]
        await sut.Service.MoveNodeAsync(CourseId, "topic_1", "topic_3");

        Assert.Equal(2, topics[0].Order); // topic_1, moved to the end
        Assert.Equal(0, topics[1].Order); // topic_2, shifted up
        Assert.Equal(1, topics[2].Order); // topic_3, shifted up
        Assert.Equal(NodeConfirmation.Unconfirmed, chapter.Confirmation);
    }

    [Fact]
    public async Task MoveNodeAsync_is_a_noop_when_dragged_and_target_dont_share_a_parent()
    {
        var sut = MakeSut();
        var topic = MakeTopic("topic_1", "chapter_1", order: 0);
        var subtopic = MakeSubtopic("subtopic_1", "topic_9", order: 0);
        sut.Repository.FindNodeAsync(CourseId, "topic_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, topic, null, null));
        sut.Repository.FindNodeAsync(CourseId, "subtopic_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, subtopic, null));

        await sut.Service.MoveNodeAsync(CourseId, "topic_1", "subtopic_1");

        Assert.Equal(0, topic.Order);
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task MoveNodeAsync_is_a_noop_when_draggedId_equals_targetId()
    {
        var sut = MakeSut();
        await sut.Service.MoveNodeAsync(CourseId, "topic_1", "topic_1");
        await sut.Repository.DidNotReceiveWithAnyArgs().FindNodeAsync(default!, default!);
    }

    // -- ConfirmNodeAsync ---------------------------------------------------------------------------

    [Theory]
    [InlineData(NodeConfirmation.Confirmed)]
    [InlineData(NodeConfirmation.Unconfirmed)]
    public async Task ConfirmNodeAsync_sets_Confirmed_regardless_of_prior_state(NodeConfirmation initial)
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1", confirmation: initial);
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));

        await sut.Service.ConfirmNodeAsync(CourseId, "block_1");

        Assert.Equal(NodeConfirmation.Confirmed, block.Confirmation);
    }

    // -- GetTreeAsync materialization (Task 6) -------------------------------------------------------

    private static CourseFile MakePendingFile(string id = "file_1") => new()
    {
        Id = id,
        CourseId = CourseId,
        FileName = "notes.pdf",
        ContentType = "application/pdf",
        StoredUrl = "/uploads/course-files/x.pdf",
        Status = JobItemStatus.Done,
        IsMaterialized = false,
        ExtractedStructureJson = """{"chapters":[{"title":"Ch1","topics":[{"title":"T1","contentBlocks":[{"format":"text","text":"hi","lang":"en"}],"subtopics":[]}]}]}""",
    };

    [Fact]
    public async Task GetTreeAsync_materializes_a_claimed_pending_file_into_real_chapters()
    {
        var sut = MakeSut();
        var file = MakePendingFile();
        sut.CourseFileRepository.GetPendingMaterializationAsync(CourseId, Arg.Any<CancellationToken>()).Returns([file]);
        sut.CourseFileRepository.TryClaimForMaterializationAsync(file.Id, Arg.Any<CancellationToken>()).Returns(true);
        sut.Repository.GetChaptersByCourseIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        sut.Repository.GetTreeAsync(CourseId, Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        sut.IdGenerator.NewId().Returns("chapter_new", "topic_new");

        await sut.Service.GetTreeAsync(CourseId);

        sut.Repository.Received(1).AddChapter(Arg.Is<Chapter>(c => c.Title == "Ch1" && c.Topics.Count == 1));
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetTreeAsync_materializes_a_pending_file_exactly_once_across_two_overlapping_calls()
    {
        // Simulates two concurrent GetTreeAsync calls both observing the same pending file: the
        // atomic claim (TryClaimForMaterializationAsync) is what decides the winner -- the second
        // caller's claim returns false and must not materialize the file a second time.
        var sut = MakeSut();
        var file = MakePendingFile();
        sut.CourseFileRepository.GetPendingMaterializationAsync(CourseId, Arg.Any<CancellationToken>()).Returns([file]);
        sut.CourseFileRepository.TryClaimForMaterializationAsync(file.Id, Arg.Any<CancellationToken>()).Returns(true, false);
        sut.Repository.GetChaptersByCourseIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        sut.Repository.GetTreeAsync(CourseId, Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        sut.IdGenerator.NewId().Returns("chapter_new", "topic_new", "chapter_new_2", "topic_new_2");

        await sut.Service.GetTreeAsync(CourseId); // "first" concurrent call -- wins the claim
        await sut.Service.GetTreeAsync(CourseId); // "second" concurrent call -- loses the claim

        sut.Repository.Received(1).AddChapter(Arg.Any<Chapter>());
    }

    [Fact]
    public async Task GetTreeAsync_with_nothing_pending_never_calls_SaveChangesAsync_for_materialization()
    {
        var sut = MakeSut();
        sut.Repository.GetTreeAsync(CourseId, Arg.Any<CancellationToken>()).Returns(new List<Chapter>());

        await sut.Service.GetTreeAsync(CourseId);

        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // Code-review patch regression: a claimed file with malformed staged JSON must not abort the
    // whole batch -- every other pending file (materializing fine) still gets saved.
    [Fact]
    public async Task GetTreeAsync_materialization_skips_a_file_with_malformed_json_but_still_saves_other_pending_files()
    {
        var sut = MakeSut();
        var badFile = MakePendingFile("file_bad");
        badFile.ExtractedStructureJson = "not valid json {{{";
        var goodFile = MakePendingFile("file_good");
        sut.CourseFileRepository.GetPendingMaterializationAsync(CourseId, Arg.Any<CancellationToken>()).Returns([badFile, goodFile]);
        sut.CourseFileRepository.TryClaimForMaterializationAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(true);
        sut.Repository.GetChaptersByCourseIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        sut.Repository.GetTreeAsync(CourseId, Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        sut.IdGenerator.NewId().Returns("chapter_new", "topic_new");

        await sut.Service.GetTreeAsync(CourseId);

        sut.Repository.Received(1).AddChapter(Arg.Is<Chapter>(c => c.Title == "Ch1"));
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // Code-review patch regression: an unexpected Format value in one chapter's proposed content
    // must not lose an already-built chapter from the same file, or block a different file's chapters.
    [Fact]
    public async Task GetTreeAsync_materialization_skips_a_chapter_with_an_unrecognized_format_but_keeps_the_rest()
    {
        var sut = MakeSut();
        var file = MakePendingFile();
        file.ExtractedStructureJson = """
            {"chapters":[
                {"title":"Good Chapter","topics":[{"title":"T1","contentBlocks":[{"format":"text","text":"hi","lang":"en"}],"subtopics":[]}]},
                {"title":"Bad Chapter","topics":[{"title":"T2","contentBlocks":[{"format":"not-a-real-format","text":"hi","lang":"en"}],"subtopics":[]}]}
            ]}
            """;
        sut.CourseFileRepository.GetPendingMaterializationAsync(CourseId, Arg.Any<CancellationToken>()).Returns([file]);
        sut.CourseFileRepository.TryClaimForMaterializationAsync(file.Id, Arg.Any<CancellationToken>()).Returns(true);
        sut.Repository.GetChaptersByCourseIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        sut.Repository.GetTreeAsync(CourseId, Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        sut.IdGenerator.NewId().Returns("chapter_new", "topic_new");

        await sut.Service.GetTreeAsync(CourseId);

        sut.Repository.Received(1).AddChapter(Arg.Is<Chapter>(c => c.Title == "Good Chapter"));
        sut.Repository.DidNotReceive().AddChapter(Arg.Is<Chapter>(c => c.Title == "Bad Chapter"));
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // -- Validation gaps found in code review --------------------------------------------------------

    [Fact]
    public async Task AddContentBlockAsync_throws_ValidationException_when_parentId_resolves_to_the_wrong_type()
    {
        var sut = MakeSut();
        var subtopic = MakeSubtopic("subtopic_1", "topic_1");
        sut.Repository.FindNodeAsync(CourseId, "subtopic_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, subtopic, null));

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.AddContentBlockAsync(CourseId, "subtopic_1", "topic"));
    }

    [Fact]
    public async Task AddContentBlockAsync_throws_NotFoundException_when_parentId_does_not_exist_at_all()
    {
        var sut = MakeSut();
        sut.Repository.FindNodeAsync(CourseId, "does_not_exist", Arg.Any<CancellationToken>()).Returns((TreeNode?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.AddContentBlockAsync(CourseId, "does_not_exist", "topic"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task EditNodeTitleAsync_throws_ValidationException_for_a_blank_title(string title)
    {
        var sut = MakeSut();
        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.EditNodeTitleAsync(CourseId, "chapter_1", title));
        await sut.Repository.DidNotReceiveWithAnyArgs().FindNodeAsync(default!, default!);
    }

    [Fact]
    public async Task EditNodeTitleAsync_throws_ValidationException_for_a_title_over_255_characters()
    {
        var sut = MakeSut();
        var overLong = new string('a', 256);

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.EditNodeTitleAsync(CourseId, "chapter_1", overLong));
    }

    [Fact]
    public async Task EditContentBlockAsync_throws_ValidationException_for_a_lang_over_8_characters()
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1");
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));
        var patch = new UpdateContentBlockRequest(null, "way-too-long", null, null, null, null, new HashSet<string> { "lang" });

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.EditContentBlockAsync(CourseId, "block_1", patch));
        Assert.Equal("en", block.Lang); // unchanged
    }

    [Fact]
    public async Task ReorderNodeAsync_checks_ownership_before_validating_direction()
    {
        var sut = MakeSut();
        sut.CourseService.EnsureOwnedDraftAsync(CourseId, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new NotFoundException("Course", CourseId)));

        // An invalid direction AND a failing ownership guard -- the guard must win, matching
        // every other mutator in this file (code-review patch: this was the one outlier that
        // validated its own input before confirming the caller may even touch this course).
        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.ReorderNodeAsync(CourseId, "any", "sideways"));
    }

    // -- Ownership guard ------------------------------------------------------------------------------

    [Fact]
    public async Task AddChapterAsync_propagates_the_ownership_guards_failure()
    {
        var sut = MakeSut();
        sut.CourseService.EnsureOwnedDraftAsync(CourseId, Arg.Any<CancellationToken>())
            .Returns(Task.FromException(new NotFoundException("Course", CourseId)));

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.AddChapterAsync(CourseId));
        sut.Repository.DidNotReceiveWithAnyArgs().AddChapter(default!);
    }

    // -- Story 2.10: alt-text generation + language detection --------------------------------------

    [Fact]
    public async Task EditContentBlockAsync_converting_Text_to_Math_generates_alt_text_when_none_supplied()
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1");
        block.Format = ContentBlockFormat.Text;
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));
        sut.AiTaskGateway.DescribeNotationAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(new AiTaskResult("v equals f times lambda.", "openai", "gpt-4o-mini", new AiGatewayUsage(10, 5, 15), false));
        var patch = new UpdateContentBlockRequest(null, null, "v = f\\lambda", null, null, "Math", new HashSet<string> { "format", "notation" });

        await sut.Service.EditContentBlockAsync(CourseId, "block_1", patch);

        Assert.Equal("v equals f times lambda.", block.AltText);
        await sut.AiTaskGateway.Received(1).DescribeNotationAsync(
            Arg.Is<AiTaskRequest>(r => r.CourseId == CourseId && r.TutorId == "tutor_1"), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EditContentBlockAsync_editing_an_existing_Math_blocks_notation_alone_also_generates_alt_text()
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1");
        block.Format = ContentBlockFormat.Math; // already Math -- Format isn't in this patch
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));
        sut.AiTaskGateway.DescribeNotationAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(new AiTaskResult("A new description.", "openai", "gpt-4o-mini", new AiGatewayUsage(10, 5, 15), false));
        var patch = new UpdateContentBlockRequest(null, null, "E = mc^2", null, null, null, new HashSet<string> { "notation" });

        await sut.Service.EditContentBlockAsync(CourseId, "block_1", patch);

        Assert.Equal("A new description.", block.AltText);
    }

    [Fact]
    public async Task EditContentBlockAsync_explicit_AltText_suppresses_auto_generation()
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1");
        block.Format = ContentBlockFormat.Text;
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));
        var patch = new UpdateContentBlockRequest(null, null, "v = f\\lambda", null, "Manually written alt text", "Math", new HashSet<string> { "format", "notation", "altText" });

        await sut.Service.EditContentBlockAsync(CourseId, "block_1", patch);

        Assert.Equal("Manually written alt text", block.AltText);
        await sut.AiTaskGateway.DidNotReceiveWithAnyArgs().DescribeNotationAsync(default!, default);
    }

    // Code-review patch regression: a pre-existing, already-generated (or tutor-written) AltText
    // must survive a failed regeneration attempt -- Task 2's own text says "leaving AltText
    // unchanged" on the two expected AI failure modes, not "clearing it."
    private static async Task AssertEditContentBlockAsync_swallows_the_AI_failure(Exception thrownByGateway)
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1", confirmation: NodeConfirmation.Unconfirmed);
        block.Format = ContentBlockFormat.Text;
        block.AltText = "A previously-generated description.";
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));
        sut.AiTaskGateway.DescribeNotationAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<AiTaskResult>(thrownByGateway));
        var patch = new UpdateContentBlockRequest(null, null, "v = f\\lambda", null, null, "Math", new HashSet<string> { "format", "notation" });

        await sut.Service.EditContentBlockAsync(CourseId, "block_1", patch); // must not throw

        Assert.Equal("A previously-generated description.", block.AltText);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public Task EditContentBlockAsync_swallows_AiTaskUnavailableException_and_still_saves() =>
        AssertEditContentBlockAsync_swallows_the_AI_failure(new AiTaskUnavailableException("task_describeNotation"));

    [Fact]
    public Task EditContentBlockAsync_swallows_AiTaskBudgetExceededException_and_still_saves() =>
        AssertEditContentBlockAsync_swallows_the_AI_failure(new AiTaskBudgetExceededException("task_describeNotation"));

    [Fact]
    public async Task EditContentBlockAsync_propagates_an_unexpected_exception_from_DescribeNotationAsync()
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1");
        block.Format = ContentBlockFormat.Text;
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));
        sut.AiTaskGateway.DescribeNotationAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<AiTaskResult>(new InvalidOperationException("boom")));
        var patch = new UpdateContentBlockRequest(null, null, "v = f\\lambda", null, null, "Math", new HashSet<string> { "format", "notation" });

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.Service.EditContentBlockAsync(CourseId, "block_1", patch));
    }

    [Fact]
    public async Task EditContentBlockAsync_setting_Devanagari_text_without_explicit_lang_sets_hi()
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1");
        block.Format = ContentBlockFormat.Text;
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));
        var patch = new UpdateContentBlockRequest("तरंग ऊर्जा", null, null, null, null, null, new HashSet<string> { "text" });

        await sut.Service.EditContentBlockAsync(CourseId, "block_1", patch);

        Assert.Equal("hi", block.Lang);
    }

    [Fact]
    public async Task EditContentBlockAsync_setting_English_text_without_explicit_lang_sets_en()
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1");
        block.Format = ContentBlockFormat.Text;
        block.Lang = "hi"; // was previously Hindi -- new text is English, must flip
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));
        var patch = new UpdateContentBlockRequest("A wave transfers energy.", null, null, null, null, null, new HashSet<string> { "text" });

        await sut.Service.EditContentBlockAsync(CourseId, "block_1", patch);

        Assert.Equal("en", block.Lang);
    }

    [Fact]
    public async Task EditContentBlockAsync_explicit_lang_suppresses_auto_detection()
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1");
        block.Format = ContentBlockFormat.Text;
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));
        // Devanagari text, but the caller explicitly pins lang to "en" -- must be respected as-is.
        var patch = new UpdateContentBlockRequest("तरंग ऊर्जा", "en", null, null, null, null, new HashSet<string> { "text", "lang" });

        await sut.Service.EditContentBlockAsync(CourseId, "block_1", patch);

        Assert.Equal("en", block.Lang);
    }

    [Fact]
    public async Task GetTreeAsync_materialization_overrides_the_staged_lang_guess_and_generates_alt_text_for_math_blocks()
    {
        var sut = MakeSut();
        var file = MakePendingFile();
        file.ExtractedStructureJson = """
            {"chapters":[{"title":"Ch1","topics":[{"title":"T1","contentBlocks":[
                {"format":"text","text":"तरंग ऊर्जा","lang":"en"},
                {"format":"math","text":null,"lang":"en","notation":"v = f\\lambda"}
            ],"subtopics":[]}]}]}
            """;
        sut.CourseFileRepository.GetPendingMaterializationAsync(CourseId, Arg.Any<CancellationToken>()).Returns([file]);
        sut.CourseFileRepository.TryClaimForMaterializationAsync(file.Id, Arg.Any<CancellationToken>()).Returns(true);
        sut.Repository.GetChaptersByCourseIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        sut.Repository.GetTreeAsync(CourseId, Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        sut.CourseService.GetOwningTutorIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns("tutor_1");
        sut.AiTaskGateway.DescribeNotationAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(new AiTaskResult("v equals f times lambda.", "openai", "gpt-4o-mini", new AiGatewayUsage(10, 5, 15), false));
        sut.IdGenerator.NewId().Returns("chapter_new", "topic_new");

        await sut.Service.GetTreeAsync(CourseId);

        sut.Repository.Received(1).AddChapter(Arg.Is<Chapter>(c =>
            // The staged "lang":"en" guess on the Devanagari text block is overridden to "hi".
            c.Topics[0].ContentBlocks[0].Lang == "hi" &&
            // The math block gets a generated AltText, absent from Story 2.8's own staged schema.
            c.Topics[0].ContentBlocks[1].AltText == "v equals f times lambda."));
    }

    [Fact]
    public async Task EditContentBlockAsync_clearing_notation_also_clears_the_now_stale_alt_text()
    {
        var sut = MakeSut();
        var block = MakeBlock("block_1", topicId: "topic_1");
        block.Format = ContentBlockFormat.Math;
        block.Notation = "v = f\\lambda";
        block.AltText = "v equals f times lambda.";
        sut.Repository.FindNodeAsync(CourseId, "block_1", Arg.Any<CancellationToken>()).Returns(new TreeNode(null, null, null, block));
        var patch = new UpdateContentBlockRequest(null, null, "", null, null, null, new HashSet<string> { "notation" });

        await sut.Service.EditContentBlockAsync(CourseId, "block_1", patch);

        Assert.Null(block.AltText);
        await sut.AiTaskGateway.DidNotReceiveWithAnyArgs().DescribeNotationAsync(default!, default);
    }

    // Code-review patch regression: an exception from DescribeNotationAsync during materialization
    // (a type TryDescribeNotationAsync's own narrow catch doesn't handle) must not abort the whole
    // pass -- only the one chapter it belongs to. Every other pending chapter/file still saves.
    [Fact]
    public async Task GetTreeAsync_materialization_isolates_an_unexpected_DescribeNotationAsync_failure_to_one_chapter()
    {
        var sut = MakeSut();
        var file = MakePendingFile();
        file.ExtractedStructureJson = """
            {"chapters":[
                {"title":"Good Chapter","topics":[{"title":"T1","contentBlocks":[{"format":"text","text":"hi","lang":"en"}],"subtopics":[]}]},
                {"title":"Bad Chapter","topics":[{"title":"T2","contentBlocks":[{"format":"math","text":null,"lang":"en","notation":"v = f\\lambda"}],"subtopics":[]}]}
            ]}
            """;
        sut.CourseFileRepository.GetPendingMaterializationAsync(CourseId, Arg.Any<CancellationToken>()).Returns([file]);
        sut.CourseFileRepository.TryClaimForMaterializationAsync(file.Id, Arg.Any<CancellationToken>()).Returns(true);
        sut.Repository.GetChaptersByCourseIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        sut.Repository.GetTreeAsync(CourseId, Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        sut.AiTaskGateway.DescribeNotationAsync(Arg.Any<AiTaskRequest>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromException<AiTaskResult>(new InvalidOperationException("boom")));
        sut.IdGenerator.NewId().Returns("chapter_new", "topic_new", "chapter_new_2", "topic_new_2");

        await sut.Service.GetTreeAsync(CourseId); // must not throw

        sut.Repository.Received(1).AddChapter(Arg.Is<Chapter>(c => c.Title == "Good Chapter"));
        sut.Repository.DidNotReceive().AddChapter(Arg.Is<Chapter>(c => c.Title == "Bad Chapter"));
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // Code-review patch regression: a failure resolving the owning tutor (needed only for
    // materialization's own AI-attribution) must not prevent GetTreeAsync from returning the
    // tutor's already-persisted tree.
    [Fact]
    public async Task GetTreeAsync_still_returns_the_tree_when_the_materialization_tutorId_lookup_fails()
    {
        var sut = MakeSut();
        var file = MakePendingFile();
        sut.CourseFileRepository.GetPendingMaterializationAsync(CourseId, Arg.Any<CancellationToken>()).Returns([file]);
        sut.Repository.GetChaptersByCourseIdAsync(CourseId, Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        sut.CourseService.GetOwningTutorIdAsync(CourseId, Arg.Any<CancellationToken>())
            .Returns(Task.FromException<string>(new NotFoundException("Course", CourseId)));
        var existingTree = new List<Chapter> { MakeChapter("chapter_existing") };
        sut.Repository.GetTreeAsync(CourseId, Arg.Any<CancellationToken>()).Returns(existingTree);

        var result = await sut.Service.GetTreeAsync(CourseId); // must not throw

        Assert.Single(result);
        sut.Repository.DidNotReceiveWithAnyArgs().AddChapter(default!);
        await sut.CourseFileRepository.DidNotReceiveWithAnyArgs().TryClaimForMaterializationAsync(default!, default);
    }
}

using System.Text.Json;
using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Domain.Courses;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.AdaptiveLearning;

// Story 3.8/Task 4: CreateSnapshotAsync walks the confirmed content tree and every
// DrilldownLevel/WayContent row via plain repository reads (not GetOrGenerate*Async -- a snapshot
// must never trigger fresh generation), then serializes the whole thing into one CourseVersion row.
public class VersionServiceTests
{
    private sealed record Sut(
        VersionService Service,
        IContentTreeRepository ContentTreeRepository,
        IAdaptiveLearningRepository AdaptiveLearningRepository,
        IVersionRepository Repository,
        ICourseService CourseService,
        IIdGenerator IdGenerator,
        IUnitOfWork UnitOfWork);

    private static Sut MakeSut()
    {
        var contentTreeRepository = Substitute.For<IContentTreeRepository>();
        var adaptiveLearningRepository = Substitute.For<IAdaptiveLearningRepository>();
        var repository = Substitute.For<IVersionRepository>();
        var courseService = Substitute.For<ICourseService>();
        var idGenerator = Substitute.For<IIdGenerator>();
        idGenerator.NewId().Returns("version_1");
        var unitOfWork = Substitute.For<IUnitOfWork>();
        // Unconfigured, NSubstitute would return a completed Task WITHOUT ever invoking the
        // passed-in operation -- RestoreVersionAsync's real work happens inside that callback, so
        // this must actually run it for the tests below to exercise anything at all.
        unitOfWork.ExecuteInTransactionAsync(Arg.Any<Func<Task>>(), Arg.Any<CancellationToken>())
            .Returns(async callInfo => await callInfo.Arg<Func<Task>>()());

        var service = new VersionService(contentTreeRepository, adaptiveLearningRepository, repository, courseService, idGenerator, unitOfWork);
        return new Sut(service, contentTreeRepository, adaptiveLearningRepository, repository, courseService, idGenerator, unitOfWork);
    }

    private static Chapter MakeChapter(params Topic[] topics) => new()
    {
        Id = "chapter_1",
        CourseId = "course_1",
        Title = "Chapter 1",
        Topics = topics.ToList(),
    };

    private static Topic MakeTopic(string id, params Subtopic[] subtopics) => new()
    {
        Id = id,
        ChapterId = "chapter_1",
        Title = $"Topic {id}",
        Subtopics = subtopics.ToList(),
    };

    private static Subtopic MakeSubtopic(string id) => new()
    {
        Id = id,
        TopicId = "topic_1",
        Title = $"Subtopic {id}",
    };

    [Fact]
    public async Task CreateSnapshotAsync_persists_one_CourseVersion_row_with_a_new_id_and_the_courseId()
    {
        var sut = MakeSut();
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([]);

        await sut.Service.CreateSnapshotAsync("course_1");

        sut.Repository.Received(1).Add(Arg.Is<CourseVersion>(v => v.Id == "version_1" && v.CourseId == "course_1"));
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateSnapshotAsync_reads_generated_and_override_content_via_plain_repository_reads_not_GetOrGenerate()
    {
        var sut = MakeSut();
        var topic = MakeTopic("topic_1");
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([MakeChapter(topic)]);
        sut.AdaptiveLearningRepository.GetLevelAsync("topic_1", null, Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns((DrilldownLevel?)null);
        sut.AdaptiveLearningRepository.GetWayAsync("topic_1", null, Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns((WayContent?)null);

        await sut.Service.CreateSnapshotAsync("course_1");

        for (var level = 1; level <= 5; level++)
            await sut.AdaptiveLearningRepository.Received(1).GetLevelAsync("topic_1", null, level, Arg.Any<CancellationToken>());
        for (var wayNumber = 1; wayNumber <= 5; wayNumber++)
            await sut.AdaptiveLearningRepository.Received(1).GetWayAsync("topic_1", null, wayNumber, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateSnapshotAsync_collects_content_for_both_topics_and_subtopics()
    {
        var sut = MakeSut();
        var subtopic = MakeSubtopic("subtopic_1");
        var topic = MakeTopic("topic_1", subtopic);
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([MakeChapter(topic)]);
        sut.AdaptiveLearningRepository.GetLevelAsync(Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns((DrilldownLevel?)null);
        sut.AdaptiveLearningRepository.GetWayAsync(Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns((WayContent?)null);

        await sut.Service.CreateSnapshotAsync("course_1");

        await sut.AdaptiveLearningRepository.Received(5).GetLevelAsync("topic_1", null, Arg.Any<int>(), Arg.Any<CancellationToken>());
        await sut.AdaptiveLearningRepository.Received(5).GetLevelAsync(null, "subtopic_1", Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateSnapshotAsync_serializes_the_confirmed_tree_and_generated_or_override_content_into_SnapshotJson()
    {
        var sut = MakeSut();
        var topic = MakeTopic("topic_1");
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([MakeChapter(topic)]);
        sut.AdaptiveLearningRepository.GetLevelAsync("topic_1", null, 1, Arg.Any<CancellationToken>())
            .Returns(new DrilldownLevel { Id = "level_1", TopicId = "topic_1", LevelNumber = 1, GeneratedContentJson = "{\"title\":\"generated\"}", OverrideContentJson = "{\"title\":\"overridden\"}" });
        sut.AdaptiveLearningRepository.GetLevelAsync("topic_1", null, Arg.Is<int>(l => l != 1), Arg.Any<CancellationToken>())
            .Returns((DrilldownLevel?)null);
        sut.AdaptiveLearningRepository.GetWayAsync(Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns((WayContent?)null);

        CourseVersion? captured = null;
        sut.Repository.When(r => r.Add(Arg.Any<CourseVersion>())).Do(call => captured = call.Arg<CourseVersion>());

        await sut.Service.CreateSnapshotAsync("course_1");

        Assert.NotNull(captured);
        using var document = JsonDocument.Parse(captured!.SnapshotJson);
        var adaptiveContent = document.RootElement.GetProperty("adaptiveContent");
        var topicNode = adaptiveContent.EnumerateArray().Single(n => n.GetProperty("topicId").GetString() == "topic_1");
        var level1 = topicNode.GetProperty("levels").EnumerateArray().Single(l => l.GetProperty("number").GetInt32() == 1);
        Assert.Equal("{\"title\":\"generated\"}", level1.GetProperty("generatedContentJson").GetString());
        Assert.Equal("{\"title\":\"overridden\"}", level1.GetProperty("overrideContentJson").GetString());
        Assert.Contains("Chapter 1", document.RootElement.GetProperty("chapters").ToString());
    }

    [Fact]
    public async Task CreateSnapshotAsync_omits_levels_and_ways_that_were_never_generated()
    {
        var sut = MakeSut();
        var topic = MakeTopic("topic_1");
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([MakeChapter(topic)]);
        sut.AdaptiveLearningRepository.GetLevelAsync(Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns((DrilldownLevel?)null);
        sut.AdaptiveLearningRepository.GetWayAsync(Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns((WayContent?)null);

        CourseVersion? captured = null;
        sut.Repository.When(r => r.Add(Arg.Any<CourseVersion>())).Do(call => captured = call.Arg<CourseVersion>());

        await sut.Service.CreateSnapshotAsync("course_1");

        using var document = JsonDocument.Parse(captured!.SnapshotJson);
        var topicNode = document.RootElement.GetProperty("adaptiveContent").EnumerateArray().Single(n => n.GetProperty("topicId").GetString() == "topic_1");
        Assert.Empty(topicNode.GetProperty("levels").EnumerateArray());
        Assert.Empty(topicNode.GetProperty("ways").EnumerateArray());
    }

    [Fact]
    public async Task CreateSnapshotAsync_calls_SaveChangesAsync_exactly_once()
    {
        var sut = MakeSut();
        var subtopic = MakeSubtopic("subtopic_1");
        var topic = MakeTopic("topic_1", subtopic);
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([MakeChapter(topic)]);
        sut.AdaptiveLearningRepository.GetLevelAsync(Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns((DrilldownLevel?)null);
        sut.AdaptiveLearningRepository.GetWayAsync(Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns((WayContent?)null);

        await sut.Service.CreateSnapshotAsync("course_1");

        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // Produces a real SnapshotJson via CreateSnapshotAsync itself (rather than hand-crafting the
    // exact camelCase shape by string), so GetVersionsAsync/RestoreVersionAsync tests below stay
    // correct even if the private SnapshotContent shape changes. Clears call tracking on the
    // shared mocks afterward so this setup call doesn't inflate the real test's own Received()
    // assertions.
    private static async Task<string> CaptureRealSnapshotJsonAsync(Sut sut, Chapter chapter)
    {
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([chapter]);
        sut.AdaptiveLearningRepository.GetLevelAsync(Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns((DrilldownLevel?)null);
        sut.AdaptiveLearningRepository.GetWayAsync(Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns((WayContent?)null);

        CourseVersion? captured = null;
        sut.Repository.When(r => r.Add(Arg.Any<CourseVersion>())).Do(call => captured = call.Arg<CourseVersion>());
        await sut.Service.CreateSnapshotAsync("course_1");

        sut.UnitOfWork.ClearReceivedCalls();
        sut.Repository.ClearReceivedCalls();
        sut.ContentTreeRepository.ClearReceivedCalls();
        sut.CourseService.ClearReceivedCalls();

        return captured!.SnapshotJson;
    }

    // -- GetVersionsAsync (Story 3.10/Task 3) ---------------------------------------------------

    [Fact]
    public async Task GetVersionsAsync_requires_ownership()
    {
        var sut = MakeSut();
        sut.Repository.GetAllByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns([]);

        await sut.Service.GetVersionsAsync("course_1");

        await sut.CourseService.Received(1).EnsureOwnedAsync("course_1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetVersionsAsync_returns_a_dto_per_version_with_counts_derived_from_the_snapshot()
    {
        var sut = MakeSut();
        var snapshotJson = await CaptureRealSnapshotJsonAsync(sut, MakeChapter(MakeTopic("topic_1")));
        var publishedAt = DateTimeOffset.UtcNow;
        sut.Repository.GetAllByCourseIdAsync("course_1", Arg.Any<CancellationToken>())
            .Returns([new CourseVersion { Id = "version_x", CourseId = "course_1", SnapshotJson = snapshotJson, PublishedAt = publishedAt }]);

        var dtos = await sut.Service.GetVersionsAsync("course_1");

        var dto = Assert.Single(dtos);
        Assert.Equal("version_x", dto.Id);
        Assert.Equal(publishedAt, dto.PublishedAt);
        Assert.Equal(1, dto.ChapterCount);
        Assert.Equal(1, dto.TopicCount);
    }

    // -- RestoreVersionAsync (Story 3.10/Task 3) ------------------------------------------------

    [Fact]
    public async Task RestoreVersionAsync_requires_ownership()
    {
        var sut = MakeSut();
        var snapshotJson = await CaptureRealSnapshotJsonAsync(sut, MakeChapter());
        sut.Repository.GetByIdAsync("version_x", Arg.Any<CancellationToken>())
            .Returns(new CourseVersion { Id = "version_x", CourseId = "course_1", SnapshotJson = snapshotJson, PublishedAt = DateTimeOffset.UtcNow });
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([]);

        await sut.Service.RestoreVersionAsync("course_1", "version_x");

        await sut.CourseService.Received(1).EnsureOwnedAsync("course_1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RestoreVersionAsync_throws_NotFoundException_for_an_unknown_version_id()
    {
        var sut = MakeSut();
        sut.Repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((CourseVersion?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.RestoreVersionAsync("course_1", "missing"));
    }

    [Fact]
    public async Task RestoreVersionAsync_throws_NotFoundException_when_the_version_belongs_to_a_different_course()
    {
        var sut = MakeSut();
        sut.Repository.GetByIdAsync("version_x", Arg.Any<CancellationToken>())
            .Returns(new CourseVersion { Id = "version_x", CourseId = "other_course", SnapshotJson = "{}", PublishedAt = DateTimeOffset.UtcNow });

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.RestoreVersionAsync("course_1", "version_x"));
    }

    [Fact]
    public async Task RestoreVersionAsync_removes_every_current_chapter_and_adds_back_the_snapshots_chapters()
    {
        var sut = MakeSut();
        var snapshotJson = await CaptureRealSnapshotJsonAsync(sut, MakeChapter(MakeTopic("topic_1")));
        sut.Repository.GetByIdAsync("version_x", Arg.Any<CancellationToken>())
            .Returns(new CourseVersion { Id = "version_x", CourseId = "course_1", SnapshotJson = snapshotJson, PublishedAt = DateTimeOffset.UtcNow });
        var currentChapter = new Chapter { Id = "current_chapter", CourseId = "course_1", Title = "Current" };
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([currentChapter]);

        await sut.Service.RestoreVersionAsync("course_1", "version_x");

        sut.ContentTreeRepository.Received(1).RemoveChapter(currentChapter);
        sut.ContentTreeRepository.Received(1).AddChapter(Arg.Is<Chapter>(c => c.Id == "chapter_1" && c.Title == "Chapter 1"));
        // Code-review patch: the remove/add/adaptive-content-restore all stage into one commit
        // (verified safe against a real DbContext -- ContentTreeRepositoryTests.cs's own
        // RemoveChapter_then_AddChapter_reusing_the_same_id... tests), wrapped in one transaction
        // together with the separate MarkDraftAsync commit below.
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        await sut.UnitOfWork.Received(1).ExecuteInTransactionAsync(Arg.Any<Func<Task>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task RestoreVersionAsync_reuses_the_snapshots_original_node_ids_not_new_ones()
    {
        var sut = MakeSut();
        var snapshotJson = await CaptureRealSnapshotJsonAsync(sut, MakeChapter(MakeTopic("original_topic_id")));
        sut.Repository.GetByIdAsync("version_x", Arg.Any<CancellationToken>())
            .Returns(new CourseVersion { Id = "version_x", CourseId = "course_1", SnapshotJson = snapshotJson, PublishedAt = DateTimeOffset.UtcNow });
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([]);

        Chapter? addedChapter = null;
        sut.ContentTreeRepository.When(r => r.AddChapter(Arg.Any<Chapter>())).Do(call => addedChapter = call.Arg<Chapter>());

        await sut.Service.RestoreVersionAsync("course_1", "version_x");

        Assert.NotNull(addedChapter);
        Assert.Equal("original_topic_id", addedChapter!.Topics.Single().Id);
    }

    [Fact]
    public async Task RestoreVersionAsync_restores_the_archived_Level_content_overwriting_newer_edits_made_since_publish()
    {
        var sut = MakeSut();
        var topic = MakeTopic("topic_1");
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([MakeChapter(topic)]);
        sut.AdaptiveLearningRepository.GetLevelAsync("topic_1", null, 1, Arg.Any<CancellationToken>())
            .Returns(new DrilldownLevel { Id = "level_1", TopicId = "topic_1", LevelNumber = 1, GeneratedContentJson = "archived-content" });
        sut.AdaptiveLearningRepository.GetLevelAsync("topic_1", null, Arg.Is<int>(l => l != 1), Arg.Any<CancellationToken>())
            .Returns((DrilldownLevel?)null);
        sut.AdaptiveLearningRepository.GetWayAsync(Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns((WayContent?)null);

        CourseVersion? captured = null;
        sut.Repository.When(r => r.Add(Arg.Any<CourseVersion>())).Do(call => captured = call.Arg<CourseVersion>());
        await sut.Service.CreateSnapshotAsync("course_1");
        sut.UnitOfWork.ClearReceivedCalls();
        sut.Repository.ClearReceivedCalls();
        sut.ContentTreeRepository.ClearReceivedCalls();
        sut.CourseService.ClearReceivedCalls();

        sut.Repository.GetByIdAsync("version_x", Arg.Any<CancellationToken>())
            .Returns(new CourseVersion { Id = "version_x", CourseId = "course_1", SnapshotJson = captured!.SnapshotJson, PublishedAt = DateTimeOffset.UtcNow });

        // Simulate drift: the tutor regenerated Level 1 AFTER this version was published, so the
        // live row now holds newer content than what this version actually archived.
        var liveRow = new DrilldownLevel { Id = "level_1", TopicId = "topic_1", LevelNumber = 1, GeneratedContentJson = "newer-content" };
        sut.AdaptiveLearningRepository.GetLevelAsync("topic_1", null, 1, Arg.Any<CancellationToken>()).Returns(liveRow);
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([]);

        await sut.Service.RestoreVersionAsync("course_1", "version_x");

        Assert.Equal("archived-content", liveRow.GeneratedContentJson);
    }

    [Fact]
    public async Task RestoreVersionAsync_creates_a_new_Level_row_if_none_currently_exists_for_that_node_and_number()
    {
        var sut = MakeSut();
        var topic = MakeTopic("topic_1");
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([MakeChapter(topic)]);
        sut.AdaptiveLearningRepository.GetLevelAsync("topic_1", null, 1, Arg.Any<CancellationToken>())
            .Returns(new DrilldownLevel { Id = "level_1", TopicId = "topic_1", LevelNumber = 1, GeneratedContentJson = "archived-content" });
        sut.AdaptiveLearningRepository.GetLevelAsync("topic_1", null, Arg.Is<int>(l => l != 1), Arg.Any<CancellationToken>())
            .Returns((DrilldownLevel?)null);
        sut.AdaptiveLearningRepository.GetWayAsync(Arg.Any<string?>(), Arg.Any<string?>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns((WayContent?)null);

        CourseVersion? captured = null;
        sut.Repository.When(r => r.Add(Arg.Any<CourseVersion>())).Do(call => captured = call.Arg<CourseVersion>());
        await sut.Service.CreateSnapshotAsync("course_1");
        sut.UnitOfWork.ClearReceivedCalls();
        sut.Repository.ClearReceivedCalls();
        sut.ContentTreeRepository.ClearReceivedCalls();
        sut.CourseService.ClearReceivedCalls();

        sut.Repository.GetByIdAsync("version_x", Arg.Any<CancellationToken>())
            .Returns(new CourseVersion { Id = "version_x", CourseId = "course_1", SnapshotJson = captured!.SnapshotJson, PublishedAt = DateTimeOffset.UtcNow });

        // The live row was deleted entirely (e.g. a later edit cleared it) since this version was
        // published -- restore must re-create it, not silently skip it because nothing exists yet.
        sut.AdaptiveLearningRepository.GetLevelAsync("topic_1", null, 1, Arg.Any<CancellationToken>()).Returns((DrilldownLevel?)null);
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([]);

        await sut.Service.RestoreVersionAsync("course_1", "version_x");

        sut.AdaptiveLearningRepository.Received(1).AddLevel(Arg.Is<DrilldownLevel>(
            l => l.TopicId == "topic_1" && l.LevelNumber == 1 && l.GeneratedContentJson == "archived-content"));
    }

    [Fact]
    public async Task RestoreVersionAsync_calls_MarkDraftAsync_after_replacing_the_tree()
    {
        var sut = MakeSut();
        var snapshotJson = await CaptureRealSnapshotJsonAsync(sut, MakeChapter());
        sut.Repository.GetByIdAsync("version_x", Arg.Any<CancellationToken>())
            .Returns(new CourseVersion { Id = "version_x", CourseId = "course_1", SnapshotJson = snapshotJson, PublishedAt = DateTimeOffset.UtcNow });
        sut.ContentTreeRepository.GetTreeAsync("course_1", Arg.Any<CancellationToken>()).Returns([]);

        await sut.Service.RestoreVersionAsync("course_1", "version_x");

        await sut.CourseService.Received(1).MarkDraftAsync("course_1", Arg.Any<CancellationToken>());
    }
}

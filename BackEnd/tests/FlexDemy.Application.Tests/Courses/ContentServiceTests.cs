using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using FlexDemy.Domain.Jobs;
using FlexDemy.Domain.Users;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.Courses;

public class ContentServiceTests
{
    private static Chapter MakeChapter(string id = "chapter_1", string courseId = "course_1", string title = "Chemical Reactions", int order = 0) => new()
    {
        Id = id,
        CourseId = courseId,
        Title = title,
        Order = order,
    };

    private sealed record Sut(
        ContentService Service,
        IContentRepository Repository,
        ICourseService CourseService,
        IUnitOfWork UnitOfWork,
        IIdGenerator IdGenerator,
        IFileStorageService FileStorage,
        IScanResourceJobEnqueuer ScanResourceJobEnqueuer,
        ICorrelationIdAccessor CorrelationIdAccessor,
        ICourseFileRepository CourseFileRepository);

    private static Sut MakeSut()
    {
        var repository = Substitute.For<IContentRepository>();
        var courseService = Substitute.For<ICourseService>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        var fileStorage = Substitute.For<IFileStorageService>();
        var scanResourceJobEnqueuer = Substitute.For<IScanResourceJobEnqueuer>();
        var correlationIdAccessor = Substitute.For<ICorrelationIdAccessor>();
        var courseFileRepository = Substitute.For<ICourseFileRepository>();
        var service = new ContentService(repository, courseService, unitOfWork, idGenerator, fileStorage, scanResourceJobEnqueuer, correlationIdAccessor, courseFileRepository);
        return new Sut(service, repository, courseService, unitOfWork, idGenerator, fileStorage, scanResourceJobEnqueuer, correlationIdAccessor, courseFileRepository);
    }

    [Fact]
    public async Task GetChapterListAsync_returns_mapped_summaries_when_the_caller_can_read_the_course()
    {
        var sut = MakeSut();
        sut.Repository.GetChaptersByCourseIdAsync("course_1", Arg.Any<CancellationToken>())
            .Returns(new List<Chapter> { MakeChapter() });

        var result = await sut.Service.GetChapterListAsync("course_1");

        Assert.Single(result);
        Assert.Equal("chapter_1", result[0].Id);
        Assert.Equal("Chemical Reactions", result[0].Title);
        await sut.CourseService.Received(1).EnsureReadableAsync("course_1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetChapterListAsync_propagates_the_ownership_check_failure_without_calling_the_repository()
    {
        var sut = MakeSut();
        sut.CourseService.When(x => x.EnsureReadableAsync("course_1", Arg.Any<CancellationToken>()))
            .Do(_ => throw new NotFoundException(nameof(Course), "course_1"));

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.GetChapterListAsync("course_1"));
        await sut.Repository.DidNotReceive().GetChaptersByCourseIdAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    // Story 11.3, AD-29: this story replaces every ContentService read's own ad hoc
    // "ownership-only, not Draft-gated" check with the shared EnsureReadableAsync gate -- which
    // also grants a Master/Support reviewer, not just the owning tutor, once the course reaches
    // InReview/ReviewConfirmed/Published. EnsureReadableAsync's own branch logic is tested
    // directly in CourseServiceTests.cs; this just confirms the retrofit landed here (the right
    // gate is called, not the Draft-gated one).
    [Fact]
    public async Task GetChapterListAsync_calls_EnsureReadableAsync_not_the_Draft_gated_check()
    {
        var sut = MakeSut();
        sut.Repository.GetChaptersByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(new List<Chapter>());

        await sut.Service.GetChapterListAsync("course_1");

        await sut.CourseService.Received(1).EnsureReadableAsync("course_1", Arg.Any<CancellationToken>());
        await sut.CourseService.DidNotReceive().EnsureOwnedDraftAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetChapterDocumentAsync_returns_the_mapped_document_when_the_chapter_belongs_to_the_course()
    {
        var sut = MakeSut();
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());

        var result = await sut.Service.GetChapterDocumentAsync("course_1", "chapter_1");

        Assert.Equal("chapter_1", result.Id);
        Assert.Equal("course_1", result.CourseId);
        Assert.Empty(result.Topics);
    }

    [Fact]
    public async Task GetChapterDocumentAsync_throws_NotFoundException_when_the_chapter_belongs_to_a_different_course()
    {
        var sut = MakeSut();
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>())
            .Returns(MakeChapter(courseId: "some_other_course"));

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.GetChapterDocumentAsync("course_1", "chapter_1"));
    }

    [Fact]
    public async Task GetChapterDocumentAsync_throws_NotFoundException_when_the_chapter_does_not_exist()
    {
        var sut = MakeSut();
        sut.Repository.GetChapterByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Chapter?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.GetChapterDocumentAsync("course_1", "missing"));
    }

    [Fact]
    public async Task CreateChapterAsync_appends_at_the_end_of_the_existing_siblings_and_commits_once()
    {
        var sut = MakeSut();
        sut.Repository.GetChaptersByCourseIdAsync("course_1", Arg.Any<CancellationToken>())
            .Returns(new List<Chapter> { MakeChapter(id: "existing", order: 0) });
        sut.IdGenerator.NewId().Returns("new_chapter_id");

        var result = await sut.Service.CreateChapterAsync("course_1", new CreateChapterRequest("Chapter One"));

        Assert.Equal("new_chapter_id", result.Id);
        Assert.Equal("Chapter One", result.Title);
        Assert.Equal(1, result.Order);
        sut.Repository.Received(1).Add(Arg.Is<Chapter>(c => c.Id == "new_chapter_id" && c.CourseId == "course_1" && c.Order == 1));
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        await sut.CourseService.Received(1).EnsureOwnedDraftAsync("course_1", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateChapterAsync_rejects_a_blank_title()
    {
        var sut = MakeSut();

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.CreateChapterAsync("course_1", new CreateChapterRequest("   ")));
        sut.Repository.DidNotReceive().Add(Arg.Any<Chapter>());
    }

    [Fact]
    public async Task CreateChapterAsync_rejects_a_title_over_200_characters()
    {
        var sut = MakeSut();
        var overLong = new string('a', 201);

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.CreateChapterAsync("course_1", new CreateChapterRequest(overLong)));
    }

    [Fact]
    public async Task CreateChapterAsync_throws_on_a_non_Draft_course_via_EnsureOwnedDraftAsync()
    {
        var sut = MakeSut();
        sut.CourseService.When(x => x.EnsureOwnedDraftAsync("course_1", Arg.Any<CancellationToken>()))
            .Do(_ => throw new ValidationException("This course is no longer a Draft and can't be edited through the wizard."));

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.CreateChapterAsync("course_1", new CreateChapterRequest("Chapter One")));
        sut.Repository.DidNotReceive().Add(Arg.Any<Chapter>());
    }

    [Fact]
    public async Task UpdateChapterAsync_updates_title_and_description_and_does_not_touch_IsConfirmed()
    {
        var sut = MakeSut();
        var chapter = MakeChapter();
        chapter.IsConfirmed = true;
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(chapter);

        var result = await sut.Service.UpdateChapterAsync("course_1", "chapter_1", new UpdateChapterRequest("New Title", "New description."));

        Assert.Equal("New Title", result.Title);
        Assert.Equal("New description.", result.Description);
        Assert.True(result.IsConfirmed);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateChapterAsync_throws_on_a_non_Draft_course()
    {
        var sut = MakeSut();
        sut.CourseService.When(x => x.EnsureOwnedDraftAsync("course_1", Arg.Any<CancellationToken>()))
            .Do(_ => throw new ValidationException("This course is no longer a Draft and can't be edited through the wizard."));

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.UpdateChapterAsync("course_1", "chapter_1", new UpdateChapterRequest("Title", null)));
    }

    // ── Story 7.2 ────────────────────────────────────────────────────────────────────────────

    private static Topic MakeTopic(string id = "topic_1", string chapterId = "chapter_1", int order = 0) => new()
    {
        Id = id,
        ChapterId = chapterId,
        Title = "Types of Reactions",
        Order = order,
    };

    private static Subtopic MakeSubtopic(string id = "subtopic_1", string topicId = "topic_1", int order = 0) => new()
    {
        Id = id,
        TopicId = topicId,
        Title = "Combination Reactions",
        Order = order,
    };

    [Fact]
    public async Task GetChapterDeleteImpactAsync_counts_topics_and_all_their_subtopics()
    {
        var sut = MakeSut();
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>())
            .Returns(new List<Topic> { MakeTopic("t1"), MakeTopic("t2") });
        sut.Repository.GetSubtopicsByTopicIdAsync("t1", Arg.Any<CancellationToken>()).Returns(new List<Subtopic> { MakeSubtopic("s1"), MakeSubtopic("s2") });
        sut.Repository.GetSubtopicsByTopicIdAsync("t2", Arg.Any<CancellationToken>()).Returns(new List<Subtopic> { MakeSubtopic("s3") });

        var impact = await sut.Service.GetChapterDeleteImpactAsync("course_1", "chapter_1");

        Assert.Equal(2, impact.Topics);
        Assert.Equal(3, impact.Subtopics);
        Assert.Equal(0, impact.Pages);
        Assert.Equal(0, impact.PageResources);
        Assert.Equal(0, impact.NodeResources);
    }

    [Fact]
    public async Task DeleteChapterAsync_removes_every_topic_and_subtopic_beneath_it_then_the_chapter_itself_in_one_commit()
    {
        var sut = MakeSut();
        var chapter = MakeChapter();
        var topic = MakeTopic();
        var subtopic = MakeSubtopic();
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(chapter);
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic> { topic });
        sut.Repository.GetSubtopicsByTopicIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(new List<Subtopic> { subtopic });

        await sut.Service.DeleteChapterAsync("course_1", "chapter_1");

        sut.Repository.Received(1).Remove(subtopic);
        sut.Repository.Received(1).Remove(topic);
        sut.Repository.Received(1).Remove(chapter);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteTopicAsync_removes_its_subtopics_then_itself()
    {
        var sut = MakeSut();
        var topic = MakeTopic();
        var subtopic = MakeSubtopic();
        sut.Repository.GetTopicByIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(topic);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetSubtopicsByTopicIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(new List<Subtopic> { subtopic });

        await sut.Service.DeleteTopicAsync("course_1", "topic_1");

        sut.Repository.Received(1).Remove(subtopic);
        sut.Repository.Received(1).Remove(topic);
    }

    [Fact]
    public async Task DeleteTopicAsync_throws_NotFoundException_when_the_topics_chapter_belongs_to_a_different_course()
    {
        var sut = MakeSut();
        sut.Repository.GetTopicByIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(MakeTopic());
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter(courseId: "some_other_course"));

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.DeleteTopicAsync("course_1", "topic_1"));
    }

    [Theory]
    [InlineData(0, "up")] // already leftmost -- no-op
    [InlineData(1, "down")] // already rightmost -- no-op
    public async Task ReorderTopicAsync_is_a_no_op_at_either_boundary(int startIndex, string direction)
    {
        var sut = MakeSut();
        var topics = new List<Topic> { MakeTopic("t1", order: 0), MakeTopic("t2", order: 1) };
        sut.Repository.GetTopicByIdAsync(topics[startIndex].Id, Arg.Any<CancellationToken>()).Returns(topics[startIndex]);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(topics);

        await sut.Service.ReorderTopicAsync("course_1", topics[startIndex].Id, direction);

        Assert.Equal(0, topics[0].Order);
        Assert.Equal(1, topics[1].Order);
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReorderTopicAsync_swaps_Order_with_the_next_sibling_on_down()
    {
        var sut = MakeSut();
        var topics = new List<Topic> { MakeTopic("t1", order: 0), MakeTopic("t2", order: 1) };
        sut.Repository.GetTopicByIdAsync("t1", Arg.Any<CancellationToken>()).Returns(topics[0]);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(topics);

        await sut.Service.ReorderTopicAsync("course_1", "t1", "down");

        Assert.Equal(1, topics[0].Order);
        Assert.Equal(0, topics[1].Order);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateSubtopicAsync_rejects_mutation_on_a_non_Draft_course()
    {
        var sut = MakeSut();
        sut.CourseService.When(x => x.EnsureOwnedDraftAsync("course_1", Arg.Any<CancellationToken>()))
            .Do(_ => throw new ValidationException("This course is no longer a Draft and can't be edited through the wizard."));

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.CreateSubtopicAsync("course_1", "topic_1", new CreateSubtopicRequest("Sub")));
        sut.Repository.DidNotReceive().Add(Arg.Any<Subtopic>());
    }

    [Fact]
    public async Task GetChapterDocumentAsync_populates_topics_with_their_nested_subtopics()
    {
        var sut = MakeSut();
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic> { MakeTopic() });
        sut.Repository.GetSubtopicsByTopicIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(new List<Subtopic> { MakeSubtopic() });

        var result = await sut.Service.GetChapterDocumentAsync("course_1", "chapter_1");

        Assert.Single(result.Topics);
        Assert.Single(result.Topics[0].Subtopics);
        Assert.Equal("subtopic_1", result.Topics[0].Subtopics[0].Id);
    }

    // ── Story 7.3: Page ──────────────────────────────────────────────────────────────────────

    private static Page MakePage(string id = "page_1", ContentOwnerType ownerType = ContentOwnerType.Chapter, string ownerId = "chapter_1", int order = 0) => new()
    {
        Id = id,
        OwnerType = ownerType,
        OwnerId = ownerId,
        Title = "Introduction",
        Order = order,
    };

    [Fact]
    public async Task GetChapterDocumentAsync_populates_pages_owned_directly_by_the_chapter_a_topic_and_a_subtopic()
    {
        var sut = MakeSut();
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic> { MakeTopic() });
        sut.Repository.GetSubtopicsByTopicIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(new List<Subtopic> { MakeSubtopic() });
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>())
            .Returns(new List<Page> { MakePage("page_chapter", ContentOwnerType.Chapter, "chapter_1") });
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Topic, "topic_1", Arg.Any<CancellationToken>())
            .Returns(new List<Page> { MakePage("page_topic", ContentOwnerType.Topic, "topic_1") });
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Subtopic, "subtopic_1", Arg.Any<CancellationToken>())
            .Returns(new List<Page> { MakePage("page_subtopic", ContentOwnerType.Subtopic, "subtopic_1") });

        var result = await sut.Service.GetChapterDocumentAsync("course_1", "chapter_1");

        Assert.Equal("page_chapter", Assert.Single(result.Pages).Id);
        Assert.Equal("page_topic", Assert.Single(result.Topics[0].Pages).Id);
        Assert.Equal("page_subtopic", Assert.Single(result.Topics[0].Subtopics[0].Pages).Id);
    }

    [Fact]
    public async Task GetChapterDeleteImpactAsync_counts_pages_across_the_chapter_its_topics_and_their_subtopics()
    {
        var sut = MakeSut();
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic> { MakeTopic() });
        sut.Repository.GetSubtopicsByTopicIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(new List<Subtopic> { MakeSubtopic() });
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Page> { MakePage("p1") });
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Topic, "topic_1", Arg.Any<CancellationToken>()).Returns(new List<Page> { MakePage("p2"), MakePage("p3") });
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Subtopic, "subtopic_1", Arg.Any<CancellationToken>()).Returns(new List<Page> { MakePage("p4") });

        var impact = await sut.Service.GetChapterDeleteImpactAsync("course_1", "chapter_1");

        Assert.Equal(4, impact.Pages);
    }

    [Fact]
    public async Task DeleteChapterAsync_cascades_to_pages_owned_by_the_chapter_its_topics_and_their_subtopics()
    {
        var sut = MakeSut();
        var chapter = MakeChapter();
        var topic = MakeTopic();
        var subtopic = MakeSubtopic();
        var chapterPage = MakePage("p_chapter", ContentOwnerType.Chapter, "chapter_1");
        var topicPage = MakePage("p_topic", ContentOwnerType.Topic, "topic_1");
        var subtopicPage = MakePage("p_subtopic", ContentOwnerType.Subtopic, "subtopic_1");
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(chapter);
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic> { topic });
        sut.Repository.GetSubtopicsByTopicIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(new List<Subtopic> { subtopic });
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Page> { chapterPage });
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Topic, "topic_1", Arg.Any<CancellationToken>()).Returns(new List<Page> { topicPage });
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Subtopic, "subtopic_1", Arg.Any<CancellationToken>()).Returns(new List<Page> { subtopicPage });

        await sut.Service.DeleteChapterAsync("course_1", "chapter_1");

        sut.Repository.Received(1).Remove(chapterPage);
        sut.Repository.Received(1).Remove(topicPage);
        sut.Repository.Received(1).Remove(subtopicPage);
        sut.Repository.Received(1).Remove(subtopic);
        sut.Repository.Received(1).Remove(topic);
        sut.Repository.Received(1).Remove(chapter);
    }

    [Fact]
    public async Task DeleteTopicAsync_cascades_to_pages_owned_by_the_topic_and_its_subtopics()
    {
        var sut = MakeSut();
        var topic = MakeTopic();
        var subtopic = MakeSubtopic();
        var topicPage = MakePage("p_topic", ContentOwnerType.Topic, "topic_1");
        var subtopicPage = MakePage("p_subtopic", ContentOwnerType.Subtopic, "subtopic_1");
        sut.Repository.GetTopicByIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(topic);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetSubtopicsByTopicIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(new List<Subtopic> { subtopic });
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Topic, "topic_1", Arg.Any<CancellationToken>()).Returns(new List<Page> { topicPage });
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Subtopic, "subtopic_1", Arg.Any<CancellationToken>()).Returns(new List<Page> { subtopicPage });

        await sut.Service.DeleteTopicAsync("course_1", "topic_1");

        sut.Repository.Received(1).Remove(topicPage);
        sut.Repository.Received(1).Remove(subtopicPage);
    }

    [Fact]
    public async Task CreatePageAsync_appends_at_the_end_of_the_owners_existing_pages_and_commits_once()
    {
        var sut = MakeSut();
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>())
            .Returns(new List<Page> { MakePage("existing", order: 0) });
        sut.IdGenerator.NewId().Returns("new_page_id");

        var result = await sut.Service.CreatePageAsync("course_1", new CreatePageRequest(ContentOwnerType.Chapter, "chapter_1", "New Page"));

        Assert.Equal("new_page_id", result.Id);
        Assert.Equal(1, result.Order);
        sut.Repository.Received(1).Add(Arg.Is<Page>(p => p.Id == "new_page_id" && p.OwnerType == ContentOwnerType.Chapter && p.OwnerId == "chapter_1" && p.Order == 1));
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreatePageAsync_throws_NotFoundException_when_the_owning_topic_belongs_to_a_different_course()
    {
        var sut = MakeSut();
        sut.Repository.GetTopicByIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(MakeTopic());
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter(courseId: "some_other_course"));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            sut.Service.CreatePageAsync("course_1", new CreatePageRequest(ContentOwnerType.Topic, "topic_1", "New Page")));
        sut.Repository.DidNotReceive().Add(Arg.Any<Page>());
    }

    // -- GetPageAsync (Story 11.2, FR-46) ----------------------------------------------------------

    [Fact]
    public async Task GetPageAsync_returns_the_page_with_its_resources()
    {
        var sut = MakeSut();
        var page = MakePage();
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetResourcesByOwnerAsync(ContentOwnerType.Page, "page_1", Arg.Any<CancellationToken>())
            .Returns(new List<Resource> { MakeResource("resource_1", ContentOwnerType.Page, "page_1") });

        var result = await sut.Service.GetPageAsync("course_1", "page_1");

        Assert.Equal("page_1", result.Id);
        var resource = Assert.Single(result.Resources);
        Assert.Equal("resource_1", resource.Id);
    }

    [Fact]
    public async Task GetPageAsync_uses_the_ownership_only_check_not_the_Draft_gated_one()
    {
        var sut = MakeSut();
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(MakePage());
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());

        await sut.Service.GetPageAsync("course_1", "page_1");

        await sut.CourseService.Received(1).EnsureReadableAsync("course_1", Arg.Any<CancellationToken>());
        await sut.CourseService.DidNotReceiveWithAnyArgs().EnsureOwnedDraftAsync(default!, default);
    }

    [Fact]
    public async Task GetPageAsync_throws_NotFoundException_for_an_unknown_page_id()
    {
        var sut = MakeSut();
        sut.Repository.GetPageByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Page?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.GetPageAsync("course_1", "missing"));
    }

    [Fact]
    public async Task UpdatePageAsync_updates_title_and_body()
    {
        var sut = MakeSut();
        var page = MakePage();
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());

        var result = await sut.Service.UpdatePageAsync("course_1", "page_1", new UpdatePageRequest("Updated Title", "Some **body**."));

        Assert.Equal("Updated Title", result.Title);
        Assert.Equal("Some **body**.", result.BodyMarkdown);
    }

    [Theory]
    [InlineData(0, "up")]
    [InlineData(1, "down")]
    public async Task ReorderPageAsync_is_a_no_op_at_either_boundary(int startIndex, string direction)
    {
        var sut = MakeSut();
        var pages = new List<Page> { MakePage("p1", order: 0), MakePage("p2", order: 1) };
        sut.Repository.GetPageByIdAsync(pages[startIndex].Id, Arg.Any<CancellationToken>()).Returns(pages[startIndex]);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>()).Returns(pages);

        await sut.Service.ReorderPageAsync("course_1", pages[startIndex].Id, direction);

        Assert.Equal(0, pages[0].Order);
        Assert.Equal(1, pages[1].Order);
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task MovePageAsync_updates_OwnerType_OwnerId_and_appends_at_the_end_of_the_new_owners_pages()
    {
        var sut = MakeSut();
        var page = MakePage(ownerType: ContentOwnerType.Chapter, ownerId: "chapter_1");
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetTopicByIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(MakeTopic());
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Topic, "topic_1", Arg.Any<CancellationToken>())
            .Returns(new List<Page> { MakePage("existing", ContentOwnerType.Topic, "topic_1") });

        var result = await sut.Service.MovePageAsync("course_1", "page_1", new MovePageRequest(ContentOwnerType.Topic, "topic_1"));

        Assert.Equal(ContentOwnerType.Topic, page.OwnerType);
        Assert.Equal("topic_1", page.OwnerId);
        Assert.Equal(1, page.Order);
        Assert.Equal(1, result.Order);
    }

    [Fact]
    public async Task MovePageAsync_throws_NotFoundException_when_the_target_owner_belongs_to_a_different_course()
    {
        var sut = MakeSut();
        var page = MakePage();
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetTopicByIdAsync("topic_other_course", Arg.Any<CancellationToken>()).Returns(MakeTopic(id: "topic_other_course", chapterId: "chapter_other"));
        sut.Repository.GetChapterByIdAsync("chapter_other", Arg.Any<CancellationToken>()).Returns(MakeChapter(id: "chapter_other", courseId: "some_other_course"));

        await Assert.ThrowsAsync<NotFoundException>(() =>
            sut.Service.MovePageAsync("course_1", "page_1", new MovePageRequest(ContentOwnerType.Topic, "topic_other_course")));
    }

    // Code-review fix regression test: MovePageAsync computed the destination's new Order from
    // its sibling count but never checked that count against MaxPagesPerNode -- CreatePageAsync's
    // own cap on the same destination was enforced, this was not, so a move alone could exceed it.
    [Fact]
    public async Task MovePageAsync_throws_ValidationException_when_the_destination_is_already_at_the_page_cap()
    {
        var sut = MakeSut();
        var page = MakePage(ownerType: ContentOwnerType.Chapter, ownerId: "chapter_1");
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetTopicByIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(MakeTopic());
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Topic, "topic_1", Arg.Any<CancellationToken>())
            .Returns(Enumerable.Range(0, 200).Select(i => MakePage(id: $"p{i}", ownerType: ContentOwnerType.Topic, ownerId: "topic_1", order: i)).ToList());

        await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.MovePageAsync("course_1", "page_1", new MovePageRequest(ContentOwnerType.Topic, "topic_1")));
        Assert.Equal(ContentOwnerType.Chapter, page.OwnerType); // never mutated
    }

    [Fact]
    public async Task CreatePageAsync_rejects_mutation_on_a_non_Draft_course()
    {
        var sut = MakeSut();
        sut.CourseService.When(x => x.EnsureOwnedDraftAsync("course_1", Arg.Any<CancellationToken>()))
            .Do(_ => throw new ValidationException("This course is no longer a Draft and can't be edited through the wizard."));

        await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.CreatePageAsync("course_1", new CreatePageRequest(ContentOwnerType.Chapter, "chapter_1", "New Page")));
        sut.Repository.DidNotReceive().Add(Arg.Any<Page>());
    }

    // ── Story 7.4: FR-44 confirmation reset ─────────────────────────────────────────────────

    [Fact]
    public async Task CreateTopicAsync_resets_the_owning_Chapters_confirmation_not_a_sibling_or_grandparent()
    {
        var sut = MakeSut();
        var chapter = MakeChapter();
        chapter.IsConfirmed = true;
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(chapter);
        sut.IdGenerator.NewId().Returns("new_topic_id");

        await sut.Service.CreateTopicAsync("course_1", "chapter_1", new CreateTopicRequest("New Topic"));

        Assert.False(chapter.IsConfirmed);
    }

    [Fact]
    public async Task DeleteTopicAsync_resets_the_owning_Chapters_confirmation()
    {
        var sut = MakeSut();
        var chapter = MakeChapter();
        chapter.IsConfirmed = true;
        var topic = MakeTopic();
        sut.Repository.GetTopicByIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(topic);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(chapter);

        await sut.Service.DeleteTopicAsync("course_1", "topic_1");

        Assert.False(chapter.IsConfirmed);
    }

    [Fact]
    public async Task ReorderTopicAsync_resets_the_Chapters_confirmation_only_when_a_real_swap_happens()
    {
        var sut = MakeSut();
        var chapter = MakeChapter();
        chapter.IsConfirmed = true;
        var topics = new List<Topic> { MakeTopic("t1", order: 0), MakeTopic("t2", order: 1) };
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(chapter);
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(topics);

        // Boundary no-op: t1 is already first, "up" does nothing.
        sut.Repository.GetTopicByIdAsync("t1", Arg.Any<CancellationToken>()).Returns(topics[0]);
        await sut.Service.ReorderTopicAsync("course_1", "t1", "up");
        Assert.True(chapter.IsConfirmed);

        // Real swap: t1 "down" actually moves.
        await sut.Service.ReorderTopicAsync("course_1", "t1", "down");
        Assert.False(chapter.IsConfirmed);
    }

    [Fact]
    public async Task CreateSubtopicAsync_resets_the_owning_Topics_confirmation()
    {
        var sut = MakeSut();
        var topic = MakeTopic();
        topic.IsConfirmed = true;
        sut.Repository.GetTopicByIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(topic);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.IdGenerator.NewId().Returns("new_subtopic_id");

        await sut.Service.CreateSubtopicAsync("course_1", "topic_1", new CreateSubtopicRequest("New Sub"));

        Assert.False(topic.IsConfirmed);
    }

    [Fact]
    public async Task CreatePageAsync_resets_its_owners_confirmation()
    {
        var sut = MakeSut();
        var chapter = MakeChapter();
        chapter.IsConfirmed = true;
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(chapter);
        sut.IdGenerator.NewId().Returns("new_page_id");

        await sut.Service.CreatePageAsync("course_1", new CreatePageRequest(ContentOwnerType.Chapter, "chapter_1", "New Page"));

        Assert.False(chapter.IsConfirmed);
    }

    [Fact]
    public async Task DeletePageAsync_resets_its_owners_confirmation()
    {
        var sut = MakeSut();
        var topic = MakeTopic();
        topic.IsConfirmed = true;
        var page = MakePage(ownerType: ContentOwnerType.Topic, ownerId: "topic_1");
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetTopicByIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(topic);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());

        await sut.Service.DeletePageAsync("course_1", "page_1");

        Assert.False(topic.IsConfirmed);
    }

    [Fact]
    public async Task MovePageAsync_resets_the_source_parent_the_destination_parent_and_the_page_itself()
    {
        var sut = MakeSut();
        var sourceChapter = MakeChapter("chapter_1");
        sourceChapter.IsConfirmed = true;
        var destinationTopic = MakeTopic("topic_1");
        destinationTopic.IsConfirmed = true;
        var page = MakePage(ownerType: ContentOwnerType.Chapter, ownerId: "chapter_1");
        page.IsConfirmed = true;
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(sourceChapter);
        sut.Repository.GetTopicByIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(destinationTopic);

        var result = await sut.Service.MovePageAsync("course_1", "page_1", new MovePageRequest(ContentOwnerType.Topic, "topic_1"));

        Assert.False(sourceChapter.IsConfirmed);
        Assert.False(destinationTopic.IsConfirmed);
        Assert.False(page.IsConfirmed);
        Assert.False(result.IsConfirmed);
    }

    [Fact]
    public async Task UpdateChapterAsync_text_only_edit_never_touches_IsConfirmed()
    {
        var sut = MakeSut();
        var chapter = MakeChapter();
        chapter.IsConfirmed = true;
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(chapter);

        await sut.Service.UpdateChapterAsync("course_1", "chapter_1", new UpdateChapterRequest("New Title", "New description"));

        Assert.True(chapter.IsConfirmed);
    }

    [Fact]
    public async Task UpdateTopicAsync_text_only_edit_never_touches_IsConfirmed()
    {
        var sut = MakeSut();
        var topic = MakeTopic();
        topic.IsConfirmed = true;
        sut.Repository.GetTopicByIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(topic);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());

        await sut.Service.UpdateTopicAsync("course_1", "topic_1", new UpdateTopicRequest("New Title", "New description"));

        Assert.True(topic.IsConfirmed);
    }

    [Fact]
    public async Task UpdatePageAsync_text_only_edit_never_touches_IsConfirmed()
    {
        var sut = MakeSut();
        var page = MakePage();
        page.IsConfirmed = true;
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());

        await sut.Service.UpdatePageAsync("course_1", "page_1", new UpdatePageRequest("New Title", "New body text."));

        Assert.True(page.IsConfirmed);
    }

    // ── Story 7.4: NFR4 bounded limits ──────────────────────────────────────────────────────

    [Fact]
    public async Task CreateChapterAsync_rejects_the_101st_chapter_naming_the_limit()
    {
        var sut = MakeSut();
        sut.Repository.GetChaptersByCourseIdAsync("course_1", Arg.Any<CancellationToken>())
            .Returns(Enumerable.Range(0, 100).Select(i => MakeChapter(id: $"c{i}", order: i)).ToList());

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.CreateChapterAsync("course_1", new CreateChapterRequest("One Too Many")));
        Assert.Contains("100", ex.Message);
        sut.Repository.DidNotReceive().Add(Arg.Any<Chapter>());
    }

    [Fact]
    public async Task CreateTopicAsync_rejects_the_101st_topic_naming_the_limit()
    {
        var sut = MakeSut();
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>())
            .Returns(Enumerable.Range(0, 100).Select(i => MakeTopic(id: $"t{i}", order: i)).ToList());

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.CreateTopicAsync("course_1", "chapter_1", new CreateTopicRequest("One Too Many")));
        Assert.Contains("100", ex.Message);
    }

    [Fact]
    public async Task CreateSubtopicAsync_rejects_the_51st_subtopic_naming_the_limit()
    {
        var sut = MakeSut();
        sut.Repository.GetTopicByIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(MakeTopic());
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetSubtopicsByTopicIdAsync("topic_1", Arg.Any<CancellationToken>())
            .Returns(Enumerable.Range(0, 50).Select(i => MakeSubtopic(id: $"s{i}", order: i)).ToList());

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.CreateSubtopicAsync("course_1", "topic_1", new CreateSubtopicRequest("One Too Many")));
        Assert.Contains("50", ex.Message);
    }

    [Fact]
    public async Task CreatePageAsync_rejects_the_201st_page_under_one_node_naming_the_limit()
    {
        var sut = MakeSut();
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>())
            .Returns(Enumerable.Range(0, 200).Select(i => MakePage(id: $"p{i}", order: i)).ToList());

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.CreatePageAsync("course_1", new CreatePageRequest(ContentOwnerType.Chapter, "chapter_1", "One Too Many")));
        Assert.Contains("200", ex.Message);
    }

    [Fact]
    public async Task UpdatePageAsync_rejects_a_body_over_256_KB_before_any_write()
    {
        var sut = MakeSut();
        var page = MakePage();
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        var tooLarge = new string('a', 256 * 1024 + 1);

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.UpdatePageAsync("course_1", "page_1", new UpdatePageRequest("Title", tooLarge)));
        Assert.Contains("256", ex.Message);
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // ── Story 7.4: GET content/outline ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetOutlineAsync_returns_a_body_free_nested_tree_with_confirmation_state_at_every_level()
    {
        var sut = MakeSut();
        var chapter = MakeChapter();
        chapter.IsConfirmed = true;
        var topic = MakeTopic();
        var subtopic = MakeSubtopic();
        var chapterPage = MakePage("page_chapter", ContentOwnerType.Chapter, "chapter_1");
        chapterPage.BodyMarkdown = "This body text must never appear in the outline.";
        sut.Repository.GetChaptersByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(new List<Chapter> { chapter });
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic> { topic });
        sut.Repository.GetSubtopicsByTopicIdAsync("topic_1", Arg.Any<CancellationToken>()).Returns(new List<Subtopic> { subtopic });
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Page> { chapterPage });

        var outline = await sut.Service.GetOutlineAsync("course_1");

        var outlineChapter = Assert.Single(outline.Chapters);
        Assert.Equal("chapter_1", outlineChapter.Id);
        Assert.True(outlineChapter.IsConfirmed);
        Assert.Single(outlineChapter.Topics);
        Assert.Equal("topic_1", outlineChapter.Topics[0].Id);
        Assert.Single(outlineChapter.Topics[0].Subtopics);
        Assert.Equal("subtopic_1", outlineChapter.Topics[0].Subtopics[0].Id);
        var outlinePage = Assert.Single(outlineChapter.Pages);
        Assert.Equal("page_chapter", outlinePage.Id);
        // OutlinePageDto has no BodyMarkdown property at all -- this is a compile-time guarantee
        // (the record has no such field), verified here by asserting the DTO's own shape.
        Assert.Equal(typeof(OutlinePageDto).GetProperties().Select(p => p.Name), new[] { "Id", "Title", "IsConfirmed", "Order" });
    }

    [Fact]
    public async Task GetOutlineAsync_propagates_the_ownership_check_failure()
    {
        var sut = MakeSut();
        sut.CourseService.When(x => x.EnsureReadableAsync("course_1", Arg.Any<CancellationToken>()))
            .Do(_ => throw new NotFoundException(nameof(Course), "course_1"));

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.GetOutlineAsync("course_1"));
    }

    // ── Story 8.1: Resource ──────────────────────────────────────────────────────────────────

    // Defaults Status to Done -- most tests using this helper don't care about scan status and
    // represent the ordinary, already-clean-scanned case; tests exercising Queued/Failed pass it
    // explicitly (see the GetResourceContentAsync scan-gate tests below).
    private static Resource MakeResource(string id = "resource_1", ContentOwnerType ownerType = ContentOwnerType.Page, string ownerId = "page_1", int order = 0, string? courseFileId = null, JobItemStatus status = JobItemStatus.Done) => new()
    {
        Id = id,
        OwnerType = ownerType,
        OwnerId = ownerId,
        CourseFileId = courseFileId,
        Label = "Diagram",
        FileName = "diagram.png",
        ContentType = "image/png",
        StoredUrl = $"/uploads/course-resources/{id}.png",
        SizeBytes = 1024,
        Order = order,
        Status = status,
    };

    private static CourseFile MakeCourseFile(string id = "file_1", string courseId = "course_1", JobItemStatus status = JobItemStatus.Done) => new()
    {
        Id = id,
        CourseId = courseId,
        FileName = "source.pdf",
        ContentType = "application/pdf",
        StoredUrl = "/uploads/course-files/source.pdf",
        SizeBytes = 2048,
        Status = status,
    };

    private static void SetUpPageOwner(Sut sut, string pageId = "page_1")
    {
        sut.Repository.GetPageByIdAsync(pageId, Arg.Any<CancellationToken>()).Returns(MakePage(pageId));
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
    }

    [Fact]
    public async Task UploadResourceAsync_appends_at_the_end_resolves_a_default_role_resets_owner_confirmation_and_enqueues_the_scan_job()
    {
        var sut = MakeSut();
        SetUpPageOwner(sut);
        var page = MakePage();
        page.IsConfirmed = true;
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetResourcesByOwnerAsync(ContentOwnerType.Page, "page_1", Arg.Any<CancellationToken>())
            .Returns(new List<Resource> { MakeResource("existing", order: 0) });
        sut.IdGenerator.NewId().Returns("storage_name_id", "new_resource_id");
        sut.FileStorage.SaveAsync(Arg.Any<Stream>(), Arg.Any<string>(), "image/png", "course-resources", Arg.Any<CancellationToken>())
            .Returns("/uploads/course-resources/new.png");
        sut.CorrelationIdAccessor.Current.Returns("corr-1");

        var result = await sut.Service.UploadResourceAsync(
            "course_1", ContentOwnerType.Page, "page_1", "My Image", null, null,
            new MemoryStream([1, 2, 3]), "photo.png", "image/png", 3);

        Assert.Equal("new_resource_id", result.Id);
        Assert.Equal(1, result.Order);
        Assert.Equal("Inline", result.Role); // default role for image/* content-types
        Assert.Equal("Queued", result.Status);
        Assert.False(page.IsConfirmed);
        sut.Repository.Received(1).Add(Arg.Is<Resource>(r => r.Id == "new_resource_id" && r.OwnerType == ContentOwnerType.Page && r.OwnerId == "page_1" && r.Order == 1));
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        sut.ScanResourceJobEnqueuer.Received(1).Enqueue("new_resource_id", "corr-1");
    }

    [Fact]
    public async Task UploadResourceAsync_defaults_to_Attachment_role_for_a_non_image_content_type()
    {
        var sut = MakeSut();
        SetUpPageOwner(sut);
        sut.IdGenerator.NewId().Returns("new_resource_id", "storage_id");
        sut.FileStorage.SaveAsync(Arg.Any<Stream>(), Arg.Any<string>(), "application/pdf", "course-resources", Arg.Any<CancellationToken>())
            .Returns("/uploads/course-resources/new.pdf");

        var result = await sut.Service.UploadResourceAsync(
            "course_1", ContentOwnerType.Page, "page_1", "My Doc", null, null,
            new MemoryStream([1]), "doc.pdf", "application/pdf", 1);

        Assert.Equal("Attachment", result.Role);
    }

    [Fact]
    public async Task UploadResourceAsync_rejects_an_unsupported_extension_before_touching_storage()
    {
        var sut = MakeSut();
        SetUpPageOwner(sut);

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.UploadResourceAsync(
            "course_1", ContentOwnerType.Page, "page_1", "Label", null, null,
            new MemoryStream([1]), "malware.exe", "application/octet-stream", 1));

        await sut.FileStorage.DidNotReceiveWithAnyArgs().SaveAsync(default!, default!, default!, default!, default);
        sut.Repository.DidNotReceive().Add(Arg.Any<Resource>());
    }

    [Fact]
    public async Task UploadResourceAsync_rejects_a_26_MB_upload_before_touching_storage()
    {
        var sut = MakeSut();
        SetUpPageOwner(sut);
        var tooLarge = 26 * 1024 * 1024L;

        var ex = await Assert.ThrowsAsync<ValidationException>(() => sut.Service.UploadResourceAsync(
            "course_1", ContentOwnerType.Page, "page_1", "Label", null, null,
            new MemoryStream([1]), "big.png", "image/png", tooLarge));

        Assert.Contains(ContentService.MaxResourceContentLength.ToString(), ex.Message);
        await sut.FileStorage.DidNotReceiveWithAnyArgs().SaveAsync(default!, default!, default!, default!, default);
    }

    [Fact]
    public async Task UploadResourceAsync_rejects_a_zero_length_upload()
    {
        var sut = MakeSut();
        SetUpPageOwner(sut);

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.UploadResourceAsync(
            "course_1", ContentOwnerType.Page, "page_1", "Label", null, null,
            new MemoryStream([]), "empty.png", "image/png", 0));

        await sut.FileStorage.DidNotReceiveWithAnyArgs().SaveAsync(default!, default!, default!, default!, default);
    }

    [Fact]
    public async Task UploadResourceAsync_rejects_the_51st_resource_naming_the_limit_and_never_writes_to_storage()
    {
        var sut = MakeSut();
        SetUpPageOwner(sut);
        sut.Repository.GetResourcesByOwnerAsync(ContentOwnerType.Page, "page_1", Arg.Any<CancellationToken>())
            .Returns(Enumerable.Range(0, 50).Select(i => MakeResource(id: $"r{i}", order: i)).ToList());

        var ex = await Assert.ThrowsAsync<ValidationException>(() => sut.Service.UploadResourceAsync(
            "course_1", ContentOwnerType.Page, "page_1", "Label", null, null,
            new MemoryStream([1]), "one_too_many.png", "image/png", 1));

        Assert.Contains("50", ex.Message);
        await sut.FileStorage.DidNotReceiveWithAnyArgs().SaveAsync(default!, default!, default!, default!, default);
        sut.Repository.DidNotReceive().Add(Arg.Any<Resource>());
    }

    [Fact]
    public async Task UploadResourceAsync_marks_the_row_Failed_when_scheduling_the_scan_job_throws()
    {
        var sut = MakeSut();
        SetUpPageOwner(sut);
        sut.IdGenerator.NewId().Returns("new_resource_id", "storage_id");
        sut.FileStorage.SaveAsync(Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns("/uploads/course-resources/new.png");
        sut.ScanResourceJobEnqueuer.When(e => e.Enqueue(Arg.Any<string>(), Arg.Any<string?>()))
            .Do(_ => throw new InvalidOperationException("Hangfire storage unavailable"));

        var result = await sut.Service.UploadResourceAsync(
            "course_1", ContentOwnerType.Page, "page_1", "Label", null, null,
            new MemoryStream([1]), "photo.png", "image/png", 1);

        Assert.Equal("Failed", result.Status);
        await sut.UnitOfWork.Received(2).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AttachExistingFileAsResourceAsync_references_the_same_bytes_skips_the_async_job_and_is_immediately_Done()
    {
        var sut = MakeSut();
        SetUpPageOwner(sut);
        var page = MakePage();
        page.IsConfirmed = true;
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        var courseFile = MakeCourseFile();
        sut.CourseFileRepository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(courseFile);
        sut.IdGenerator.NewId().Returns("new_resource_id");

        var result = await sut.Service.AttachExistingFileAsResourceAsync(
            "course_1", new AttachExistingFileAsResourceRequest(ContentOwnerType.Page, "page_1", "file_1", null));

        Assert.Equal("Done", result.Status);
        Assert.Equal(courseFile.ContentType, result.ContentType);
        sut.Repository.Received(1).Add(Arg.Is<Resource>(r => r.CourseFileId == "file_1" && r.StoredUrl == courseFile.StoredUrl && r.Status == JobItemStatus.Done));
        sut.ScanResourceJobEnqueuer.DidNotReceiveWithAnyArgs().Enqueue(default!, default);
        Assert.False(page.IsConfirmed);
    }

    [Fact]
    public async Task AttachExistingFileAsResourceAsync_throws_NotFoundException_when_the_file_belongs_to_a_different_course()
    {
        var sut = MakeSut();
        SetUpPageOwner(sut);
        sut.CourseFileRepository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(MakeCourseFile(courseId: "other_course"));

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.AttachExistingFileAsResourceAsync(
            "course_1", new AttachExistingFileAsResourceRequest(ContentOwnerType.Page, "page_1", "file_1", null)));
    }

    [Fact]
    public async Task AttachExistingFileAsResourceAsync_rejects_a_file_that_has_not_finished_scanning()
    {
        var sut = MakeSut();
        SetUpPageOwner(sut);
        sut.CourseFileRepository.GetByIdAsync("file_1", Arg.Any<CancellationToken>()).Returns(MakeCourseFile(status: JobItemStatus.Queued));

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.AttachExistingFileAsResourceAsync(
            "course_1", new AttachExistingFileAsResourceRequest(ContentOwnerType.Page, "page_1", "file_1", null)));
        sut.Repository.DidNotReceive().Add(Arg.Any<Resource>());
    }

    [Fact]
    public async Task UpdateResourceAsync_text_only_Label_and_Caption_edit_never_touches_confirmation()
    {
        var sut = MakeSut();
        var resource = MakeResource();
        var page = MakePage();
        page.IsConfirmed = true;
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());

        var result = await sut.Service.UpdateResourceAsync("course_1", "resource_1", new UpdateResourceRequest("New Label", "New caption", "Attachment"));

        Assert.Equal("New Label", result.Label);
        Assert.Equal("New caption", result.Caption);
        Assert.True(page.IsConfirmed); // unchanged role -- text-only edit
    }

    [Fact]
    public async Task UpdateResourceAsync_resets_owner_confirmation_only_when_the_role_actually_changes()
    {
        var sut = MakeSut();
        var resource = MakeResource(); // Role defaults to Attachment
        var page = MakePage();
        page.IsConfirmed = true;
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());

        await sut.Service.UpdateResourceAsync("course_1", "resource_1", new UpdateResourceRequest("Label", null, "Attachment"));
        Assert.True(page.IsConfirmed); // same role -- no-op guard, no reset

        await sut.Service.UpdateResourceAsync("course_1", "resource_1", new UpdateResourceRequest("Label", null, "Inline"));
        Assert.False(page.IsConfirmed); // real role change -- FR-44 re-role reset
    }

    [Fact]
    public async Task UpdateResourceAsync_rejects_an_invalid_role_string()
    {
        var sut = MakeSut();
        var resource = MakeResource();
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        SetUpPageOwner(sut);

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.UpdateResourceAsync(
            "course_1", "resource_1", new UpdateResourceRequest("Label", null, "NotARole")));
    }

    [Fact]
    public async Task GetResourcesByOwnerAsync_returns_the_mapped_resources_for_the_given_owner()
    {
        var sut = MakeSut();
        SetUpPageOwner(sut);
        sut.Repository.GetResourcesByOwnerAsync(ContentOwnerType.Page, "page_1", Arg.Any<CancellationToken>())
            .Returns(new List<Resource> { MakeResource("r1"), MakeResource("r2", order: 1) });

        var result = await sut.Service.GetResourcesByOwnerAsync("course_1", ContentOwnerType.Page, "page_1");

        Assert.Equal(2, result.Count);
        Assert.Equal("r1", result[0].Id);
    }

    [Theory]
    [InlineData(0, "up")]
    [InlineData(1, "down")]
    public async Task ReorderResourceAsync_is_a_no_op_at_either_boundary_and_never_touches_confirmation(int startIndex, string direction)
    {
        var sut = MakeSut();
        var resources = new List<Resource> { MakeResource("r1", order: 0), MakeResource("r2", order: 1) };
        SetUpPageOwner(sut);
        var page = MakePage();
        page.IsConfirmed = true;
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetResourceByIdAsync(resources[startIndex].Id, Arg.Any<CancellationToken>()).Returns(resources[startIndex]);
        sut.Repository.GetResourcesByOwnerAsync(ContentOwnerType.Page, "page_1", Arg.Any<CancellationToken>()).Returns(resources);

        await sut.Service.ReorderResourceAsync("course_1", resources[startIndex].Id, direction);

        Assert.Equal(0, resources[0].Order);
        Assert.Equal(1, resources[1].Order);
        Assert.True(page.IsConfirmed);
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReorderResourceAsync_swaps_Order_with_the_next_sibling_and_never_resets_confirmation()
    {
        var sut = MakeSut();
        var resources = new List<Resource> { MakeResource("r1", order: 0), MakeResource("r2", order: 1) };
        SetUpPageOwner(sut);
        var page = MakePage();
        page.IsConfirmed = true;
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetResourceByIdAsync("r1", Arg.Any<CancellationToken>()).Returns(resources[0]);
        sut.Repository.GetResourcesByOwnerAsync(ContentOwnerType.Page, "page_1", Arg.Any<CancellationToken>()).Returns(resources);

        await sut.Service.ReorderResourceAsync("course_1", "r1", "down");

        Assert.Equal(1, resources[0].Order);
        Assert.Equal(0, resources[1].Order);
        Assert.True(page.IsConfirmed); // reordering isn't in FR-44's reset list
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteResourceAsync_removes_the_resource_resets_owner_confirmation_and_deletes_its_own_exclusively_owned_file()
    {
        var sut = MakeSut();
        var resource = MakeResource(); // CourseFileId is null -- directly-uploaded, exclusive bytes
        var page = MakePage();
        page.IsConfirmed = true;
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.Repository.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(page);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());

        await sut.Service.DeleteResourceAsync("course_1", "resource_1");

        sut.Repository.Received(1).Remove(resource);
        Assert.False(page.IsConfirmed);
        await sut.FileStorage.Received(1).DeleteAsync(resource.StoredUrl, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteResourceAsync_never_deletes_shared_bytes_for_a_resource_promoted_from_an_existing_CourseFile()
    {
        var sut = MakeSut();
        var resource = MakeResource(courseFileId: "file_1"); // shares bytes with a CourseFile
        SetUpPageOwner(sut);
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);

        await sut.Service.DeleteResourceAsync("course_1", "resource_1");

        sut.Repository.Received(1).Remove(resource);
        await sut.FileStorage.DidNotReceiveWithAnyArgs().DeleteAsync(default!, default);
    }

    [Fact]
    public async Task DeleteResourceAsync_throws_NotFoundException_when_the_resource_does_not_exist()
    {
        var sut = MakeSut();
        sut.Repository.GetResourceByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Resource?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.DeleteResourceAsync("course_1", "missing"));
    }

    [Fact]
    public async Task GetChapterDeleteImpactAsync_counts_NodeResources_and_PageResources_separately()
    {
        var sut = MakeSut();
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic>());
        sut.Repository.GetResourcesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>())
            .Returns(new List<Resource> { MakeResource("r1", ContentOwnerType.Chapter, "chapter_1") });
        var chapterPage = MakePage("p1", ContentOwnerType.Chapter, "chapter_1");
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Page> { chapterPage });
        sut.Repository.GetResourcesByOwnerAsync(ContentOwnerType.Page, "p1", Arg.Any<CancellationToken>())
            .Returns(new List<Resource> { MakeResource("r2", ContentOwnerType.Page, "p1"), MakeResource("r3", ContentOwnerType.Page, "p1", order: 1) });

        var impact = await sut.Service.GetChapterDeleteImpactAsync("course_1", "chapter_1");

        Assert.Equal(1, impact.NodeResources);
        Assert.Equal(2, impact.PageResources);
    }

    [Fact]
    public async Task DeleteChapterAsync_cascades_to_resources_owned_directly_by_the_chapter_and_by_its_pages()
    {
        var sut = MakeSut();
        var chapter = MakeChapter();
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(chapter);
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic>());
        var nodeResource = MakeResource("node_res", ContentOwnerType.Chapter, "chapter_1");
        sut.Repository.GetResourcesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Resource> { nodeResource });
        var chapterPage = MakePage("p1", ContentOwnerType.Chapter, "chapter_1");
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Page> { chapterPage });
        var pageResource = MakeResource("page_res", ContentOwnerType.Page, "p1");
        sut.Repository.GetResourcesByOwnerAsync(ContentOwnerType.Page, "p1", Arg.Any<CancellationToken>()).Returns(new List<Resource> { pageResource });

        await sut.Service.DeleteChapterAsync("course_1", "chapter_1");

        sut.Repository.Received(1).Remove(nodeResource);
        sut.Repository.Received(1).Remove(pageResource);
        sut.Repository.Received(1).Remove(chapterPage);
        sut.Repository.Received(1).Remove(chapter);
        await sut.FileStorage.Received(1).DeleteAsync(nodeResource.StoredUrl, Arg.Any<CancellationToken>());
        await sut.FileStorage.Received(1).DeleteAsync(pageResource.StoredUrl, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteChapterAsync_never_deletes_the_stored_bytes_of_a_resource_promoted_from_an_existing_CourseFile()
    {
        var sut = MakeSut();
        var chapter = MakeChapter();
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(chapter);
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic>());
        var sharedResource = MakeResource("shared_res", ContentOwnerType.Chapter, "chapter_1", courseFileId: "file_1");
        sut.Repository.GetResourcesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Resource> { sharedResource });
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Page>());

        await sut.Service.DeleteChapterAsync("course_1", "chapter_1");

        sut.Repository.Received(1).Remove(sharedResource);
        await sut.FileStorage.DidNotReceiveWithAnyArgs().DeleteAsync(default!, default);
    }

    [Fact]
    public async Task GetChapterDocumentAsync_populates_resources_on_the_chapter_a_topic_a_subtopic_and_a_page()
    {
        var sut = MakeSut();
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic>());
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>())
            .Returns(new List<Page> { MakePage("page_1", ContentOwnerType.Chapter, "chapter_1") });
        sut.Repository.GetResourcesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>())
            .Returns(new List<Resource> { MakeResource("r_chapter", ContentOwnerType.Chapter, "chapter_1") });
        sut.Repository.GetResourcesByOwnerAsync(ContentOwnerType.Page, "page_1", Arg.Any<CancellationToken>())
            .Returns(new List<Resource> { MakeResource("r_page", ContentOwnerType.Page, "page_1") });

        var result = await sut.Service.GetChapterDocumentAsync("course_1", "chapter_1");

        Assert.Equal("r_chapter", Assert.Single(result.Resources).Id);
        Assert.Equal("r_page", Assert.Single(result.Pages[0].Resources).Id);
    }

    // ── Story 8.3: delete-in-use guard (FR-31) ──────────────────────────────────────────────

    [Fact]
    public async Task DeleteResourceAsync_blocks_when_a_page_body_references_it_via_a_hand_typed_resource_uri_naming_the_page()
    {
        // AC #3's own explicit test requirement: the only way a `resource:{id}` reference can
        // exist in a Page's BodyMarkdown during this epic is via Story 7.3's raw-Markdown edit
        // path -- simulated here by setting BodyMarkdown directly, exactly what that editor path
        // would have produced.
        var sut = MakeSut();
        var resource = MakeResource(ownerType: ContentOwnerType.Chapter, ownerId: "chapter_1");
        var referencingPage = MakePage("referencing_page", ContentOwnerType.Chapter, "chapter_1");
        referencingPage.Title = "Combustion Basics";
        referencingPage.BodyMarkdown = "See ![Diagram](resource:resource_1) for details.";
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetChaptersByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(new List<Chapter> { MakeChapter() });
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic>());
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>())
            .Returns(new List<Page> { referencingPage });

        var ex = await Assert.ThrowsAsync<ConflictException>(() => sut.Service.DeleteResourceAsync("course_1", "resource_1"));

        Assert.Contains("Combustion Basics", ex.Message);
        sut.Repository.DidNotReceive().Remove(Arg.Any<Resource>());
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // Code-review fix regression test: a bare substring match on "resource:{id}" false-positives
    // when one resource's id is a text prefix of another's -- deleting "resource_1" must not
    // treat a page that only references "resource_10" as blocking it.
    [Fact]
    public async Task DeleteResourceAsync_does_not_match_a_reference_to_a_different_resource_whose_id_shares_this_ones_prefix()
    {
        var sut = MakeSut();
        var resource = MakeResource("resource_1", ContentOwnerType.Chapter, "chapter_1");
        var unrelatedPage = MakePage("unrelated_page", ContentOwnerType.Chapter, "chapter_1");
        unrelatedPage.BodyMarkdown = "See ![Diagram](resource:resource_10) for details.";
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetChaptersByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(new List<Chapter> { MakeChapter() });
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic>());
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>())
            .Returns(new List<Page> { unrelatedPage });

        await sut.Service.DeleteResourceAsync("course_1", "resource_1"); // does not throw ConflictException

        sut.Repository.Received(1).Remove(resource);
    }

    [Fact]
    public async Task DeleteResourceAsync_still_succeeds_unconditionally_for_a_resource_no_page_references()
    {
        // No regression against Story 8.1's original unconditional-delete behavior when nothing
        // actually references the resource.
        var sut = MakeSut();
        var resource = MakeResource(ownerType: ContentOwnerType.Chapter, ownerId: "chapter_1");
        var unrelatedPage = MakePage("other_page", ContentOwnerType.Chapter, "chapter_1");
        unrelatedPage.BodyMarkdown = "Nothing referencing anything here.";
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetChaptersByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(new List<Chapter> { MakeChapter() });
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic>());
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>())
            .Returns(new List<Page> { unrelatedPage });

        await sut.Service.DeleteResourceAsync("course_1", "resource_1");

        sut.Repository.Received(1).Remove(resource);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteResourceAsync_with_forceRemoveFromContent_strips_the_reference_from_every_referencing_page_and_deletes_in_one_commit()
    {
        var sut = MakeSut();
        var resource = MakeResource(ownerType: ContentOwnerType.Chapter, ownerId: "chapter_1");
        var pageA = MakePage("page_a", ContentOwnerType.Chapter, "chapter_1");
        pageA.BodyMarkdown = "Intro ![Diagram](resource:resource_1) more text.";
        var pageB = MakePage("page_b", ContentOwnerType.Chapter, "chapter_1", order: 1);
        pageB.BodyMarkdown = "See resource:resource_1 and also resource:resource_1 again.";
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.Repository.GetChaptersByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(new List<Chapter> { MakeChapter() });
        sut.Repository.GetTopicsByChapterIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(new List<Topic>());
        sut.Repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, "chapter_1", Arg.Any<CancellationToken>())
            .Returns(new List<Page> { pageA, pageB });

        await sut.Service.DeleteResourceAsync("course_1", "resource_1", forceRemoveFromContent: true);

        Assert.DoesNotContain("resource:resource_1", pageA.BodyMarkdown);
        Assert.DoesNotContain("resource:resource_1", pageB.BodyMarkdown);
        Assert.Contains("Intro", pageA.BodyMarkdown);
        sut.Repository.Received(1).Remove(resource);
        // Both the Markdown edits and the resource delete land in the same single commit.
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // ── Story 8.3: GetResourceContentAsync (AD-29) ──────────────────────────────────────────

    [Fact]
    public async Task GetResourceContentAsync_returns_the_stream_content_type_and_file_name_for_the_resources_owner()
    {
        var sut = MakeSut();
        var resource = MakeResource(ownerType: ContentOwnerType.Chapter, ownerId: "chapter_1");
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        var stream = new MemoryStream([1, 2, 3]);
        sut.FileStorage.OpenReadAsync(resource.StoredUrl, Arg.Any<CancellationToken>()).Returns(stream);

        var result = await sut.Service.GetResourceContentAsync("course_1", "resource_1");

        Assert.Same(stream, result.Content);
        Assert.Equal(resource.ContentType, result.ContentType);
        Assert.Equal(resource.FileName, result.FileName);
    }

    [Fact]
    public async Task GetResourceContentAsync_is_ownership_only_not_Draft_gated()
    {
        var sut = MakeSut();
        var resource = MakeResource(ownerType: ContentOwnerType.Chapter, ownerId: "chapter_1");
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        sut.FileStorage.OpenReadAsync(resource.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));

        await sut.Service.GetResourceContentAsync("course_1", "resource_1");

        await sut.CourseService.Received(1).EnsureReadableAsync("course_1", Arg.Any<CancellationToken>());
        await sut.CourseService.DidNotReceive().EnsureOwnedDraftAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    // Code-review fix regression test: previously this method served StoredUrl bytes back
    // regardless of scan status -- a resource still Queued for its malware/SVG scan, or one the
    // scan already Failed, was downloadable exactly like a clean Done resource.
    [Theory]
    [InlineData(JobItemStatus.Queued)]
    [InlineData(JobItemStatus.Failed)]
    public async Task GetResourceContentAsync_throws_ConflictException_when_the_resource_has_not_finished_scanning(JobItemStatus status)
    {
        var sut = MakeSut();
        var resource = MakeResource(ownerType: ContentOwnerType.Chapter, ownerId: "chapter_1", status: status);
        sut.Repository.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(resource);
        sut.Repository.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());

        await Assert.ThrowsAsync<ConflictException>(() => sut.Service.GetResourceContentAsync("course_1", "resource_1"));
        await sut.FileStorage.DidNotReceive().OpenReadAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetResourceContentAsync_throws_NotFoundException_when_the_resource_does_not_exist()
    {
        var sut = MakeSut();
        sut.Repository.GetResourceByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Resource?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.GetResourceContentAsync("course_1", "missing"));
    }

    // -- Story 11.3, Task 4: retrofit integration tests -------------------------------------------
    //
    // Wires a REAL CourseService (not a mock) as ContentService's ICourseService dependency, so
    // each retrofitted read genuinely exercises EnsureReadableAsync's own branch logic end-to-end,
    // not just "was some method called" against a mock. This is the closest equivalent this
    // codebase's test infrastructure supports to a real HTTP integration test (Backend/CLAUDE.md's
    // own documented gap: no WebApplicationFactory-based integration tests exist anywhere in this
    // codebase) -- service-layer wiring, per this epic's own established testing convention.
    private static (ContentService contentService, ICourseRepository courseRepository) MakeRetrofitSut(
        string? currentUserId,
        UserRole? role,
        out IContentRepository contentRepository,
        out IFileStorageService fileStorage
    )
    {
        var courseRepository = Substitute.For<ICourseRepository>();
        var currentUserService = Substitute.For<ICurrentUserService>();
        currentUserService.UserId.Returns(currentUserId);
        currentUserService.Role.Returns(role);
        // CourseService's own HasUnconfirmedContentAsync dependency (Story 11.1) -- irrelevant to
        // every read this story retrofits, never invoked by EnsureReadableAsync.
        var courseServiceContentRepository = Substitute.For<IContentRepository>();
        var realCourseService = new CourseService(
            courseRepository,
            Substitute.For<IUnitOfWork>(),
            Substitute.For<IIdGenerator>(),
            Substitute.For<IFileStorageService>(),
            currentUserService,
            courseServiceContentRepository);

        var repository = Substitute.For<IContentRepository>();
        contentRepository = repository;
        fileStorage = Substitute.For<IFileStorageService>();
        var contentService = new ContentService(
            repository,
            realCourseService,
            Substitute.For<IUnitOfWork>(),
            Substitute.For<IIdGenerator>(),
            fileStorage,
            Substitute.For<IScanResourceJobEnqueuer>(),
            Substitute.For<ICorrelationIdAccessor>(),
            Substitute.For<ICourseFileRepository>());

        return (contentService, courseRepository);
    }

    private static Course MakeCourseForRetrofit(LifecycleState lifecycleState, string tutorId = "owner_1") =>
        new() { Id = "course_1", Title = "Chemical Reactions", LifecycleState = lifecycleState, TutorId = tutorId };

    [Fact]
    public async Task Retrofit_GetChapterListAsync_rejects_a_Draft_course_non_owner_and_accepts_a_Master_reviewer_at_InReview()
    {
        var (draftSut, draftRepo) = MakeRetrofitSut("stranger", UserRole.Student, out _, out _);
        draftRepo.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseForRetrofit(LifecycleState.Draft));
        await Assert.ThrowsAsync<NotFoundException>(() => draftSut.GetChapterListAsync("course_1"));

        var (reviewSut, reviewRepo) = MakeRetrofitSut("stranger", UserRole.Master, out var reviewContentRepo, out _);
        reviewRepo.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseForRetrofit(LifecycleState.InReview));
        reviewContentRepo.GetChaptersByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        await reviewSut.GetChapterListAsync("course_1"); // does not throw
    }

    [Fact]
    public async Task Retrofit_GetChapterDocumentAsync_rejects_a_Draft_course_non_owner_and_accepts_a_Master_reviewer_at_InReview()
    {
        var (draftSut, draftRepo) = MakeRetrofitSut("stranger", UserRole.Student, out _, out _);
        draftRepo.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseForRetrofit(LifecycleState.Draft));
        await Assert.ThrowsAsync<NotFoundException>(() => draftSut.GetChapterDocumentAsync("course_1", "chapter_1"));

        var (reviewSut, reviewRepo) = MakeRetrofitSut("stranger", UserRole.Master, out var reviewContentRepo, out _);
        reviewRepo.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseForRetrofit(LifecycleState.InReview));
        reviewContentRepo.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        await reviewSut.GetChapterDocumentAsync("course_1", "chapter_1"); // does not throw
    }

    [Fact]
    public async Task Retrofit_GetOutlineAsync_rejects_a_Draft_course_non_owner_and_accepts_a_Support_reviewer_at_InReview()
    {
        var (draftSut, draftRepo) = MakeRetrofitSut("stranger", UserRole.Tutor, out _, out _);
        draftRepo.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseForRetrofit(LifecycleState.Draft));
        await Assert.ThrowsAsync<NotFoundException>(() => draftSut.GetOutlineAsync("course_1"));

        var (reviewSut, reviewRepo) = MakeRetrofitSut("stranger", UserRole.Support, out var reviewContentRepo, out _);
        reviewRepo.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseForRetrofit(LifecycleState.InReview));
        reviewContentRepo.GetChaptersByCourseIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(new List<Chapter>());
        await reviewSut.GetOutlineAsync("course_1"); // does not throw
    }

    [Fact]
    public async Task Retrofit_GetPageAsync_rejects_a_Draft_course_non_owner_and_accepts_a_Master_reviewer_at_InReview()
    {
        var (draftSut, draftRepo) = MakeRetrofitSut("stranger", UserRole.Student, out var draftContentRepo, out _);
        draftRepo.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseForRetrofit(LifecycleState.Draft));
        draftContentRepo.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(MakePage());
        await Assert.ThrowsAsync<NotFoundException>(() => draftSut.GetPageAsync("course_1", "page_1"));

        var (reviewSut, reviewRepo) = MakeRetrofitSut("stranger", UserRole.Master, out var reviewContentRepo, out _);
        reviewRepo.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseForRetrofit(LifecycleState.InReview));
        reviewContentRepo.GetPageByIdAsync("page_1", Arg.Any<CancellationToken>()).Returns(MakePage());
        reviewContentRepo.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        await reviewSut.GetPageAsync("course_1", "page_1"); // does not throw
    }

    [Fact]
    public async Task Retrofit_GetResourceContentAsync_rejects_a_Draft_course_non_owner_and_accepts_a_Master_reviewer_at_InReview()
    {
        var draftResource = MakeResource(ownerType: ContentOwnerType.Chapter, ownerId: "chapter_1");
        var (draftSut, draftRepo) = MakeRetrofitSut("stranger", UserRole.Student, out var draftContentRepo, out _);
        draftRepo.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseForRetrofit(LifecycleState.Draft));
        draftContentRepo.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(draftResource);
        await Assert.ThrowsAsync<NotFoundException>(() => draftSut.GetResourceContentAsync("course_1", "resource_1"));

        var reviewResource = MakeResource(ownerType: ContentOwnerType.Chapter, ownerId: "chapter_1");
        var (reviewSut, reviewRepo) = MakeRetrofitSut("stranger", UserRole.Master, out var reviewContentRepo, out var reviewFileStorage);
        reviewRepo.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourseForRetrofit(LifecycleState.InReview));
        reviewContentRepo.GetResourceByIdAsync("resource_1", Arg.Any<CancellationToken>()).Returns(reviewResource);
        reviewContentRepo.GetChapterByIdAsync("chapter_1", Arg.Any<CancellationToken>()).Returns(MakeChapter());
        reviewFileStorage.OpenReadAsync(reviewResource.StoredUrl, Arg.Any<CancellationToken>()).Returns(new MemoryStream([1]));
        await reviewSut.GetResourceContentAsync("course_1", "resource_1"); // does not throw
    }
}

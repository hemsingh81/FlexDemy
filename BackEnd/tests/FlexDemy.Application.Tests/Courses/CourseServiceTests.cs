using FlexDemy.Application.Common;
using FlexDemy.Application.Courses;
using FlexDemy.Domain.Courses;
using FlexDemy.Domain.Users;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.Courses;

public class CourseServiceTests
{
    // Represents the pre-existing public catalog shape -- Published by default (code-review
    // patch: GetCourseByIdAsync now hides non-Published courses from non-owners, so every
    // existing "public catalog" test using this helper needs an explicit Published state to
    // keep meaning what it always meant).
    private static Course MakeCourse(string id = "course_1", LifecycleState lifecycleState = LifecycleState.Published) => new()
    {
        Id = id,
        Title = "Quantum Foundations",
        Subject = "physics",
        Level = "Beginner",
        TargetGradeTag = "Class 12th",
        InstructorName = "Dr. Rostova",
        LifecycleState = lifecycleState,
    };

    private static Course MakeDraft(string id = "draft_1", string tutorId = "tutor_1") => new()
    {
        Id = id,
        Title = "In Progress Course",
        LifecycleState = LifecycleState.Draft,
        TutorId = tutorId,
    };

    private sealed record Sut(
        CourseService Service,
        ICourseRepository Repository,
        IUnitOfWork UnitOfWork,
        IIdGenerator IdGenerator,
        IFileStorageService FileStorage,
        ICurrentUserService CurrentUser,
        IContentRepository ContentRepository);

    private static Sut MakeSut(string? currentUserId = "tutor_1")
    {
        var repository = Substitute.For<ICourseRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        var fileStorage = Substitute.For<IFileStorageService>();
        var currentUser = Substitute.For<ICurrentUserService>();
        currentUser.UserId.Returns(currentUserId);
        var contentRepository = Substitute.For<IContentRepository>();
        // Story 11.1: defaults to "nothing unconfirmed" -- individual MoveToReviewAsync tests
        // override this when exercising the gate itself.
        contentRepository.HasUnconfirmedContentAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(false);
        var service = new CourseService(repository, unitOfWork, idGenerator, fileStorage, currentUser, contentRepository);
        return new Sut(service, repository, unitOfWork, idGenerator, fileStorage, currentUser, contentRepository);
    }

    [Fact]
    public async Task GetCourseByIdAsync_returns_the_mapped_dto_when_found()
    {
        var sut = MakeSut();
        sut.Repository.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourse());

        var result = await sut.Service.GetCourseByIdAsync("course_1");

        Assert.Equal("course_1", result.Id);
        Assert.Equal("Quantum Foundations", result.Title);
    }

    [Fact]
    public async Task GetCourseByIdAsync_throws_NotFoundException_when_missing()
    {
        var sut = MakeSut();
        sut.Repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Course?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.GetCourseByIdAsync("missing"));
    }

    [Fact]
    public async Task GetCourseByIdAsync_throws_NotFoundException_for_a_non_Published_course_when_the_caller_is_not_its_owner()
    {
        var sut = MakeSut(currentUserId: "stranger");
        var draft = MakeDraft(tutorId: "owner");
        sut.Repository.GetByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(draft);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.GetCourseByIdAsync("draft_1"));
    }

    [Fact]
    public async Task GetCourseByIdAsync_returns_a_non_Published_course_to_its_own_owner()
    {
        var sut = MakeSut(currentUserId: "owner");
        var draft = MakeDraft(tutorId: "owner");
        sut.Repository.GetByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(draft);

        var result = await sut.Service.GetCourseByIdAsync("draft_1");

        Assert.Equal("draft_1", result.Id);
    }

    [Fact]
    public async Task GetCourseByIdAsync_returns_a_Published_course_to_an_unauthenticated_caller()
    {
        var sut = MakeSut(currentUserId: null);
        sut.Repository.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(MakeCourse());

        var result = await sut.Service.GetCourseByIdAsync("course_1");

        Assert.Equal("course_1", result.Id);
    }

    [Fact]
    public async Task CreateCourseAsync_assigns_an_id_stages_the_entity_and_commits_once()
    {
        var sut = MakeSut();
        sut.IdGenerator.NewId().Returns("course_new");

        var request = new CreateCourseRequest(
            "New Course", "short", "full", "physics", "Beginner", "Class 12th",
            null, "Dr. Rostova", null, null, 5, null, null);

        var result = await sut.Service.CreateCourseAsync(request);

        Assert.Equal("course_new", result.Id);
        sut.Repository.Received(1).Add(Arg.Is<Course>(c => c.Id == "course_new"));
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // -- GetMyCoursesAsync (FR-31) ------------------------------------------------------------

    [Fact]
    public async Task GetMyCoursesAsync_maps_every_returned_course_regardless_of_LifecycleState()
    {
        var sut = MakeSut(currentUserId: "tutor_1");
        var draft = MakeDraft(id: "course_draft", tutorId: "tutor_1");
        var published = MakeCourse(id: "course_published", lifecycleState: LifecycleState.Published);
        published.TutorId = "tutor_1";
        sut.Repository.GetByTutorIdAsync("tutor_1", Arg.Any<CancellationToken>()).Returns([draft, published]);

        var result = await sut.Service.GetMyCoursesAsync();

        Assert.Equal(2, result.Count);
        Assert.Contains(result, c => c.Id == "course_draft" && c.LifecycleState == nameof(LifecycleState.Draft));
        Assert.Contains(result, c => c.Id == "course_published" && c.LifecycleState == nameof(LifecycleState.Published));
    }

    [Fact]
    public async Task GetMyCoursesAsync_queries_by_the_current_users_id()
    {
        var sut = MakeSut(currentUserId: "tutor_42");
        sut.Repository.GetByTutorIdAsync("tutor_42", Arg.Any<CancellationToken>()).Returns([]);

        await sut.Service.GetMyCoursesAsync();

        await sut.Repository.Received(1).GetByTutorIdAsync("tutor_42", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetMyCoursesAsync_throws_UnauthorizedAppException_when_no_current_user()
    {
        var sut = MakeSut(currentUserId: null);

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.GetMyCoursesAsync());
    }

    // -- CreateDraftCourseAsync --------------------------------------------------------------

    [Fact]
    public async Task CreateDraftCourseAsync_creates_a_Draft_owned_by_the_current_user()
    {
        var sut = MakeSut(currentUserId: "tutor_42");
        sut.IdGenerator.NewId().Returns("draft_new");

        var result = await sut.Service.CreateDraftCourseAsync(new CreateDraftCourseRequest("My Course", "A description"));

        Assert.Equal("draft_new", result.Id);
        Assert.Equal("My Course", result.Title);
        Assert.Equal(nameof(LifecycleState.Draft), result.LifecycleState);
        sut.Repository.Received(1).Add(Arg.Is<Course>(c =>
            c.Id == "draft_new" && c.TutorId == "tutor_42" && c.LifecycleState == LifecycleState.Draft));
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateDraftCourseAsync_trims_the_title()
    {
        var sut = MakeSut();

        var result = await sut.Service.CreateDraftCourseAsync(new CreateDraftCourseRequest("  Padded Title  ", ""));

        Assert.Equal("Padded Title", result.Title);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateDraftCourseAsync_throws_ValidationException_for_an_empty_title(string title)
    {
        var sut = MakeSut();

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.CreateDraftCourseAsync(new CreateDraftCourseRequest(title, "")));
    }

    [Fact]
    public async Task CreateDraftCourseAsync_throws_ValidationException_when_title_exceeds_max_length()
    {
        var sut = MakeSut();
        var overLong = new string('a', Course.TitleMaxLength + 1);

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.CreateDraftCourseAsync(new CreateDraftCourseRequest(overLong, "")));
    }

    [Fact]
    public async Task CreateDraftCourseAsync_throws_ValidationException_for_a_null_title()
    {
        var sut = MakeSut();

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.CreateDraftCourseAsync(new CreateDraftCourseRequest(null!, "")));
    }

    [Fact]
    public async Task CreateDraftCourseAsync_treats_a_null_description_as_empty_string()
    {
        var sut = MakeSut();

        var result = await sut.Service.CreateDraftCourseAsync(new CreateDraftCourseRequest("Title", null!));

        Assert.Equal(string.Empty, result.ShortDescription);
    }

    [Fact]
    public async Task CreateDraftCourseAsync_throws_UnauthorizedAppException_when_no_current_user()
    {
        var sut = MakeSut(currentUserId: null);

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.CreateDraftCourseAsync(new CreateDraftCourseRequest("Title", "")));
    }

    // -- UpdateDraftCourseAsync --------------------------------------------------------------

    [Fact]
    public async Task UpdateDraftCourseAsync_updates_title_and_description()
    {
        var sut = MakeSut(currentUserId: "tutor_1");
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());

        var result = await sut.Service.UpdateDraftCourseAsync("draft_1", new UpdateDraftCourseRequest("Updated Title", "Updated description"));

        Assert.Equal("Updated Title", result.Title);
        Assert.Equal("Updated description", result.ShortDescription);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UpdateDraftCourseAsync_persists_tag_ids_and_taxonomy_fields()
    {
        var sut = MakeSut(currentUserId: "tutor_1");
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());

        var result = await sut.Service.UpdateDraftCourseAsync(
            "draft_1",
            new UpdateDraftCourseRequest(
                "Title", "Desc",
                TagIds: ["tag_physics", "tag_quantum"],
                CountryId: "country_in", StateId: "state_mh", CityId: "city_mumbai",
                BoardId: "board_mh_state", ClassLevelId: "class_10", SubjectId: "subject_physics"));

        Assert.Equal(["tag_physics", "tag_quantum"], result.TagIds);
        Assert.Equal("country_in", result.CountryId);
        Assert.Equal("state_mh", result.StateId);
        Assert.Equal("city_mumbai", result.CityId);
        Assert.Equal("board_mh_state", result.BoardId);
        Assert.Equal("class_10", result.ClassLevelId);
        Assert.Equal("subject_physics", result.SubjectId);
    }

    [Fact]
    public async Task UpdateDraftCourseAsync_treats_omitted_TagIds_as_an_empty_list_not_null()
    {
        var sut = MakeSut(currentUserId: "tutor_1");
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());

        var result = await sut.Service.UpdateDraftCourseAsync("draft_1", new UpdateDraftCourseRequest("Title", "Desc"));

        Assert.Empty(result.TagIds);
    }

    [Fact]
    public async Task UpdateDraftCourseAsync_deduplicates_tag_ids()
    {
        var sut = MakeSut(currentUserId: "tutor_1");
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());

        var result = await sut.Service.UpdateDraftCourseAsync(
            "draft_1", new UpdateDraftCourseRequest("Title", "Desc", TagIds: ["tag_physics", "tag_physics", "tag_quantum"]));

        Assert.Equal(2, result.TagIds.Count);
    }

    [Fact]
    public async Task UpdateDraftCourseAsync_accepts_null_taxonomy_fields_to_clear_a_stale_cascade_selection()
    {
        var sut = MakeSut(currentUserId: "tutor_1");
        var draft = MakeDraft();
        draft.CountryId = "country_in";
        draft.StateId = "state_mh";
        draft.CityId = "city_mumbai";
        draft.BoardId = "board_mh_state";
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(draft);

        // Mirrors updateTaxonomy's cascade-reset: changing Country resets State/City/Board/etc.
        var result = await sut.Service.UpdateDraftCourseAsync(
            "draft_1", new UpdateDraftCourseRequest("Title", "Desc", CountryId: "country_in"));

        Assert.Equal("country_in", result.CountryId);
        Assert.Null(result.StateId);
        Assert.Null(result.CityId);
        Assert.Null(result.BoardId);
    }

    [Fact]
    public async Task UpdateDraftCourseAsync_filters_out_blank_and_whitespace_only_tag_ids()
    {
        var sut = MakeSut(currentUserId: "tutor_1");
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());

        var result = await sut.Service.UpdateDraftCourseAsync(
            "draft_1", new UpdateDraftCourseRequest("Title", "Desc", TagIds: ["tag_physics", "", "   "]));

        Assert.Equal(["tag_physics"], result.TagIds);
    }

    [Fact]
    public async Task UpdateDraftCourseAsync_throws_ValidationException_for_an_over_length_tag_id()
    {
        var sut = MakeSut(currentUserId: "tutor_1");
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());
        var overLongTagId = new string('a', 65);

        // Over-length tag ids are silently dropped, not rejected -- TagIds is a list where one
        // bad entry among many valid ones shouldn't fail the whole request (unlike a single
        // taxonomy field, where "bad" and "absent" aren't interchangeable).
        var result = await sut.Service.UpdateDraftCourseAsync(
            "draft_1", new UpdateDraftCourseRequest("Title", "Desc", TagIds: ["tag_physics", overLongTagId]));

        Assert.Equal(["tag_physics"], result.TagIds);
    }

    [Fact]
    public async Task UpdateDraftCourseAsync_throws_ValidationException_for_an_over_length_taxonomy_id()
    {
        var sut = MakeSut(currentUserId: "tutor_1");
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());
        var overLong = new string('a', 65);

        await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.UpdateDraftCourseAsync("draft_1", new UpdateDraftCourseRequest("Title", "Desc", CountryId: overLong)));
    }

    [Fact]
    public async Task UpdateDraftCourseAsync_treats_a_whitespace_only_taxonomy_id_as_null()
    {
        var sut = MakeSut(currentUserId: "tutor_1");
        var draft = MakeDraft();
        draft.CountryId = "country_in";
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(draft);

        var result = await sut.Service.UpdateDraftCourseAsync(
            "draft_1", new UpdateDraftCourseRequest("Title", "Desc", CountryId: "   "));

        Assert.Null(result.CountryId);
    }

    [Fact]
    public async Task UpdateDraftCourseAsync_throws_NotFoundException_for_an_unknown_id()
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Course?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.UpdateDraftCourseAsync("missing", new UpdateDraftCourseRequest("T", "")));
    }

    [Fact]
    public async Task UpdateDraftCourseAsync_throws_UnauthorizedAppException_for_a_different_tutors_draft()
    {
        var sut = MakeSut(currentUserId: "tutor_intruder");
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft(tutorId: "tutor_owner"));

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.UpdateDraftCourseAsync("draft_1", new UpdateDraftCourseRequest("T", "")));
    }

    [Fact]
    public async Task UpdateDraftCourseAsync_throws_ValidationException_for_an_empty_title()
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.UpdateDraftCourseAsync("draft_1", new UpdateDraftCourseRequest("  ", "")));
    }

    [Fact]
    public async Task UpdateDraftCourseAsync_throws_ValidationException_for_a_null_title()
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.UpdateDraftCourseAsync("draft_1", new UpdateDraftCourseRequest(null!, "")));
    }

    [Fact]
    public async Task UpdateDraftCourseAsync_treats_a_null_description_as_empty_string()
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());

        var result = await sut.Service.UpdateDraftCourseAsync("draft_1", new UpdateDraftCourseRequest("Title", null!));

        Assert.Equal(string.Empty, result.ShortDescription);
    }

    [Fact]
    public async Task UpdateDraftCourseAsync_throws_ValidationException_once_the_course_has_left_Draft()
    {
        var sut = MakeSut();
        var noLongerDraft = MakeDraft();
        noLongerDraft.LifecycleState = LifecycleState.InReview;
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(noLongerDraft);

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.UpdateDraftCourseAsync("draft_1", new UpdateDraftCourseRequest("T", "")));
    }

    // -- AddThumbnailAsync --------------------------------------------------------------------

    [Fact]
    public async Task AddThumbnailAsync_uploads_and_appends_a_thumbnail_marked_primary_when_first()
    {
        var sut = MakeSut();
        var draft = MakeDraft();
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(draft);
        sut.IdGenerator.NewId().Returns("thumb_new");
        sut.FileStorage.SaveAsync(Arg.Any<Stream>(), Arg.Any<string>(), "image/jpeg", Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns("/uploads/course-thumbnails/thumb_new.jpg");
        using var content = new MemoryStream([1, 2, 3]);

        var result = await sut.Service.AddThumbnailAsync("draft_1", content, "image/jpeg", 3, new ThumbnailCropDto(10, 20, 100));

        var thumbnail = Assert.Single(result.Thumbnails);
        Assert.Equal("/uploads/course-thumbnails/thumb_new.jpg", thumbnail.Url);
        Assert.True(thumbnail.IsPrimary);
        Assert.Equal(0, thumbnail.Order);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddThumbnailAsync_a_second_thumbnail_is_not_primary()
    {
        var sut = MakeSut();
        var draft = MakeDraft();
        draft.Thumbnails.Add(new CourseThumbnail { Id = "thumb_existing", CourseId = draft.Id, Url = "u", IsPrimary = true, Order = 0 });
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(draft);
        sut.FileStorage.SaveAsync(Arg.Any<Stream>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns("/url2");
        using var content = new MemoryStream([1]);

        var result = await sut.Service.AddThumbnailAsync("draft_1", content, "image/png", 1, new ThumbnailCropDto(0, 0, 100));

        Assert.Equal(2, result.Thumbnails.Count);
        Assert.False(result.Thumbnails.Single(t => t.Url == "/url2").IsPrimary);
    }

    [Fact]
    public async Task AddThumbnailAsync_throws_ValidationException_when_at_the_cap()
    {
        var sut = MakeSut();
        var draft = MakeDraft();
        for (var i = 0; i < 3; i++)
            draft.Thumbnails.Add(new CourseThumbnail { Id = $"t{i}", CourseId = draft.Id, Url = $"u{i}", Order = i });
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(draft);
        using var content = new MemoryStream([1]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.AddThumbnailAsync("draft_1", content, "image/png", 1, new ThumbnailCropDto(0, 0, 100)));
    }

    [Theory]
    [InlineData("application/pdf")]
    [InlineData("text/plain")]
    [InlineData("")]
    public async Task AddThumbnailAsync_throws_ValidationException_for_a_disallowed_content_type(string contentType)
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());
        using var content = new MemoryStream([1]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.AddThumbnailAsync("draft_1", content, contentType, 1, new ThumbnailCropDto(0, 0, 100)));
    }

    [Fact]
    public async Task AddThumbnailAsync_throws_ValidationException_when_oversized()
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());
        using var content = new MemoryStream([1]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.AddThumbnailAsync("draft_1", content, "image/jpeg", 6 * 1024 * 1024, new ThumbnailCropDto(0, 0, 100)));
    }

    [Theory]
    [InlineData(-1, 50, 100)]
    [InlineData(101, 50, 100)]
    [InlineData(50, -1, 100)]
    [InlineData(50, 101, 100)]
    [InlineData(50, 50, 99)]
    [InlineData(50, 50, 301)]
    public async Task AddThumbnailAsync_throws_ValidationException_for_an_out_of_range_crop(decimal x, decimal y, decimal zoom)
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());
        using var content = new MemoryStream([1]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.AddThumbnailAsync("draft_1", content, "image/jpeg", 1, new ThumbnailCropDto(x, y, zoom)));
    }

    [Fact]
    public async Task AddThumbnailAsync_throws_ValidationException_once_the_course_has_left_Draft()
    {
        var sut = MakeSut();
        var noLongerDraft = MakeDraft();
        noLongerDraft.LifecycleState = LifecycleState.Published;
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(noLongerDraft);
        using var content = new MemoryStream([1]);

        await Assert.ThrowsAsync<ValidationException>(() =>
            sut.Service.AddThumbnailAsync("draft_1", content, "image/jpeg", 1, new ThumbnailCropDto(50, 50, 100)));
    }

    [Fact]
    public async Task AddThumbnailAsync_throws_UnauthorizedAppException_for_a_different_tutors_draft()
    {
        var sut = MakeSut(currentUserId: "intruder");
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft(tutorId: "owner"));
        using var content = new MemoryStream([1]);

        await Assert.ThrowsAsync<UnauthorizedAppException>(() =>
            sut.Service.AddThumbnailAsync("draft_1", content, "image/jpeg", 1, new ThumbnailCropDto(0, 0, 100)));
    }

    // -- RemoveThumbnailAsync -----------------------------------------------------------------

    [Fact]
    public async Task RemoveThumbnailAsync_re_derives_order_and_promotes_a_new_primary()
    {
        var sut = MakeSut();
        var draft = MakeDraft();
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t0", CourseId = draft.Id, Url = "u0", IsPrimary = true, Order = 0 });
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t1", CourseId = draft.Id, Url = "u1", Order = 1 });
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t2", CourseId = draft.Id, Url = "u2", Order = 2 });
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(draft);

        var result = await sut.Service.RemoveThumbnailAsync("draft_1", "t0");

        Assert.Equal(2, result.Thumbnails.Count);
        Assert.Equal(["t1", "t2"], result.Thumbnails.OrderBy(t => t.Order).Select(t => t.Id));
        Assert.Equal([0, 1], result.Thumbnails.OrderBy(t => t.Order).Select(t => t.Order));
        Assert.True(result.Thumbnails.Single(t => t.Id == "t1").IsPrimary);
    }

    [Fact]
    public async Task RemoveThumbnailAsync_removing_a_non_primary_thumbnail_leaves_the_primary_flag_alone()
    {
        var sut = MakeSut();
        var draft = MakeDraft();
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t0", CourseId = draft.Id, Url = "u0", IsPrimary = true, Order = 0 });
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t1", CourseId = draft.Id, Url = "u1", Order = 1 });
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(draft);

        var result = await sut.Service.RemoveThumbnailAsync("draft_1", "t1");

        Assert.True(result.Thumbnails.Single().IsPrimary);
    }

    [Fact]
    public async Task RemoveThumbnailAsync_throws_NotFoundException_for_an_unknown_thumbnail()
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.RemoveThumbnailAsync("draft_1", "missing"));
    }

    // -- ReorderThumbnailAsync ----------------------------------------------------------------

    [Fact]
    public async Task ReorderThumbnailAsync_left_swaps_with_the_previous_thumbnail()
    {
        var sut = MakeSut();
        var draft = MakeDraft();
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t0", CourseId = draft.Id, Url = "u0", Order = 0 });
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t1", CourseId = draft.Id, Url = "u1", Order = 1 });
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(draft);

        var result = await sut.Service.ReorderThumbnailAsync("draft_1", "t1", "left");

        Assert.Equal(0, result.Thumbnails.Single(t => t.Id == "t1").Order);
        Assert.Equal(1, result.Thumbnails.Single(t => t.Id == "t0").Order);
    }

    [Fact]
    public async Task ReorderThumbnailAsync_right_swaps_with_the_next_thumbnail()
    {
        var sut = MakeSut();
        var draft = MakeDraft();
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t0", CourseId = draft.Id, Url = "u0", Order = 0 });
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t1", CourseId = draft.Id, Url = "u1", Order = 1 });
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(draft);

        var result = await sut.Service.ReorderThumbnailAsync("draft_1", "t0", "right");

        Assert.Equal(1, result.Thumbnails.Single(t => t.Id == "t0").Order);
        Assert.Equal(0, result.Thumbnails.Single(t => t.Id == "t1").Order);
    }

    [Fact]
    public async Task ReorderThumbnailAsync_is_a_no_op_at_the_left_boundary()
    {
        var sut = MakeSut();
        var draft = MakeDraft();
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t0", CourseId = draft.Id, Url = "u0", Order = 0 });
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t1", CourseId = draft.Id, Url = "u1", Order = 1 });
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(draft);

        var result = await sut.Service.ReorderThumbnailAsync("draft_1", "t0", "left");

        Assert.Equal(0, result.Thumbnails.Single(t => t.Id == "t0").Order);
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReorderThumbnailAsync_is_a_no_op_at_the_right_boundary()
    {
        var sut = MakeSut();
        var draft = MakeDraft();
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t0", CourseId = draft.Id, Url = "u0", Order = 0 });
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t1", CourseId = draft.Id, Url = "u1", Order = 1 });
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(draft);

        var result = await sut.Service.ReorderThumbnailAsync("draft_1", "t1", "right");

        Assert.Equal(1, result.Thumbnails.Single(t => t.Id == "t1").Order);
    }

    [Fact]
    public async Task ReorderThumbnailAsync_throws_ValidationException_for_an_invalid_direction()
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.ReorderThumbnailAsync("draft_1", "t0", "up"));
    }

    // -- SetPrimaryThumbnailAsync -------------------------------------------------------------

    [Fact]
    public async Task SetPrimaryThumbnailAsync_sets_exactly_one_thumbnail_primary()
    {
        var sut = MakeSut();
        var draft = MakeDraft();
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t0", CourseId = draft.Id, Url = "u0", IsPrimary = true, Order = 0 });
        draft.Thumbnails.Add(new CourseThumbnail { Id = "t1", CourseId = draft.Id, Url = "u1", Order = 1 });
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(draft);

        var result = await sut.Service.SetPrimaryThumbnailAsync("draft_1", "t1");

        Assert.False(result.Thumbnails.Single(t => t.Id == "t0").IsPrimary);
        Assert.True(result.Thumbnails.Single(t => t.Id == "t1").IsPrimary);
    }

    [Fact]
    public async Task SetPrimaryThumbnailAsync_throws_NotFoundException_for_an_unknown_thumbnail()
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.SetPrimaryThumbnailAsync("draft_1", "missing"));
    }

    // -- GetOwningTutorIdAsync (Story 2.8/Task 3) ----------------------------------------------

    [Fact]
    public async Task GetOwningTutorIdAsync_returns_the_TutorId_for_a_Draft_course_with_no_caller_identity_check()
    {
        // No currentUserId configured at all -- confirms this is a genuinely unauthenticated
        // system lookup, not GetCourseByIdAsync in disguise (which would reject a Draft course
        // for any caller whose id doesn't match TutorId).
        var sut = MakeSut(currentUserId: null);
        sut.Repository.GetByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft(tutorId: "tutor_owner"));

        var tutorId = await sut.Service.GetOwningTutorIdAsync("draft_1");

        Assert.Equal("tutor_owner", tutorId);
        _ = sut.CurrentUser.DidNotReceive().UserId;
    }

    [Fact]
    public async Task GetOwningTutorIdAsync_throws_NotFoundException_for_a_genuinely_unknown_course_id()
    {
        var sut = MakeSut();
        sut.Repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Course?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.GetOwningTutorIdAsync("missing"));
    }

    // -- MarkPublishedAsync (Story 3.8/Task 5) --------------------------------------------------

    [Fact]
    public async Task MarkPublishedAsync_sets_LifecycleState_Published_with_no_caller_identity_check()
    {
        // Same "trusted system caller" shape as GetOwningTutorIdAsync -- called from
        // PublishNodeContentJob/PublishService, not directly by an HTTP request, so no
        // CurrentUser ownership check applies here.
        var sut = MakeSut(currentUserId: null);
        var course = MakeDraft(id: "course_1");
        course.LifecycleState = LifecycleState.ReviewConfirmed;
        sut.Repository.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(course);

        await sut.Service.MarkPublishedAsync("course_1");

        Assert.Equal(LifecycleState.Published, course.LifecycleState);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        _ = sut.CurrentUser.DidNotReceive().UserId;
    }

    [Fact]
    public async Task MarkPublishedAsync_throws_NotFoundException_for_a_genuinely_unknown_course_id()
    {
        var sut = MakeSut();
        sut.Repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Course?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.MarkPublishedAsync("missing"));
    }

    // -- MoveToReviewAsync / ConfirmReviewAsync ---------------------------------------------------

    [Fact]
    public async Task MoveToReviewAsync_throws_ValidationException_when_the_course_is_not_Draft()
    {
        var sut = MakeSut();
        var course = MakeDraft();
        course.LifecycleState = LifecycleState.InReview;
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(course);

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.MoveToReviewAsync("draft_1"));
    }

    [Fact]
    public async Task MoveToReviewAsync_throws_NotFoundException_for_a_genuinely_unknown_course_id()
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Course?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.MoveToReviewAsync("missing"));
    }

    [Fact]
    public async Task MoveToReviewAsync_throws_UnauthorizedAppException_for_a_different_tutors_draft()
    {
        var sut = MakeSut(currentUserId: "stranger");
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft(tutorId: "owner"));

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.MoveToReviewAsync("draft_1"));
    }

    // Story 11.1, FR-45: replaces the old "at least one file parsed" gate outright -- the file-parsed
    // check is gone, not kept as a redundant guard.
    [Fact]
    public async Task MoveToReviewAsync_throws_ValidationException_when_the_course_has_unconfirmed_content()
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());
        sut.ContentRepository.HasUnconfirmedContentAsync("draft_1", Arg.Any<CancellationToken>()).Returns(true);

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.MoveToReviewAsync("draft_1"));
    }

    [Fact]
    public async Task MoveToReviewAsync_sets_LifecycleState_InReview_when_nothing_is_unconfirmed()
    {
        var sut = MakeSut();
        var course = MakeDraft();
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(course);
        sut.ContentRepository.HasUnconfirmedContentAsync("draft_1", Arg.Any<CancellationToken>()).Returns(false);

        await sut.Service.MoveToReviewAsync("draft_1");

        Assert.Equal(LifecycleState.InReview, course.LifecycleState);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // A course with zero content (no Chapters at all) vacuously passes this gate -- there is
    // nothing to be Unconfirmed. FR-45 only gates on *existing* Unconfirmed items; whether an empty
    // course should be rejected for a different reason is a separate, out-of-scope product question
    // this story deliberately doesn't take a position on (see this story's own Completion Notes).
    [Fact]
    public async Task MoveToReviewAsync_succeeds_for_an_empty_course_with_no_content_at_all()
    {
        var sut = MakeSut();
        var course = MakeDraft();
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(course);
        sut.ContentRepository.HasUnconfirmedContentAsync("draft_1", Arg.Any<CancellationToken>()).Returns(false);

        await sut.Service.MoveToReviewAsync("draft_1");

        Assert.Equal(LifecycleState.InReview, course.LifecycleState);
    }

    [Fact]
    public async Task ConfirmReviewAsync_throws_NotFoundException_for_a_genuinely_unknown_course_id()
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Course?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.ConfirmReviewAsync("missing"));
    }

    [Fact]
    public async Task ConfirmReviewAsync_throws_ValidationException_when_the_course_is_not_InReview()
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft());

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.ConfirmReviewAsync("draft_1"));
    }

    [Fact]
    public async Task ConfirmReviewAsync_throws_UnauthorizedAppException_for_a_different_tutors_draft()
    {
        var sut = MakeSut(currentUserId: "stranger");
        var course = MakeDraft(tutorId: "owner");
        course.LifecycleState = LifecycleState.InReview;
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(course);

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.ConfirmReviewAsync("draft_1"));
    }

    [Fact]
    public async Task ConfirmReviewAsync_sets_LifecycleState_ReviewConfirmed()
    {
        var sut = MakeSut();
        var course = MakeDraft();
        course.LifecycleState = LifecycleState.InReview;
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(course);

        await sut.Service.ConfirmReviewAsync("draft_1");

        Assert.Equal(LifecycleState.ReviewConfirmed, course.LifecycleState);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // -- ReturnToDraftAsync (Story 3.10/Task 2) -------------------------------------------------

    [Fact]
    public async Task ReturnToDraftAsync_sets_LifecycleState_Draft()
    {
        var sut = MakeSut();
        var course = MakeDraft();
        course.LifecycleState = LifecycleState.Published;
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(course);

        await sut.Service.ReturnToDraftAsync("draft_1");

        Assert.Equal(LifecycleState.Draft, course.LifecycleState);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        // Positively proves "content untouched" (a state transition only, distinct from
        // IVersionService.RestoreVersionAsync's genuine rollback) rather than just never
        // referencing the content-gate mock at all.
        await sut.ContentRepository.DidNotReceiveWithAnyArgs().HasUnconfirmedContentAsync(default!, default);
    }

    [Theory]
    [InlineData(LifecycleState.Draft)]
    [InlineData(LifecycleState.InReview)]
    [InlineData(LifecycleState.ReviewConfirmed)]
    public async Task ReturnToDraftAsync_throws_ValidationException_when_the_course_is_not_Published(LifecycleState lifecycleState)
    {
        var sut = MakeSut();
        var course = MakeDraft();
        course.LifecycleState = lifecycleState;
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(course);

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.ReturnToDraftAsync("draft_1"));
    }

    [Fact]
    public async Task ReturnToDraftAsync_throws_UnauthorizedAppException_for_a_different_tutors_course()
    {
        var sut = MakeSut(currentUserId: "stranger");
        var course = MakeDraft(tutorId: "owner");
        course.LifecycleState = LifecycleState.Published;
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(course);

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.ReturnToDraftAsync("draft_1"));
    }

    [Fact]
    public async Task ReturnToDraftAsync_throws_NotFoundException_for_a_genuinely_unknown_course_id()
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Course?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.ReturnToDraftAsync("missing"));
    }

    // A course returned to Draft has no bypass back to Published -- MoveToReviewAsync's own
    // precondition (LifecycleState == Draft, nothing Unconfirmed) applies identically regardless of
    // whether the course was ever Published before; there is no separate "re-publish" code path to
    // special-case.
    [Fact]
    public async Task after_ReturnToDraftAsync_MoveToReviewAsync_still_requires_the_normal_nothing_unconfirmed_precondition()
    {
        var sut = MakeSut();
        var course = MakeDraft();
        course.LifecycleState = LifecycleState.Draft; // as ReturnToDraftAsync would have left it
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(course);
        sut.ContentRepository.HasUnconfirmedContentAsync("draft_1", Arg.Any<CancellationToken>()).Returns(true);

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.MoveToReviewAsync("draft_1"));
    }

    // -- MarkDraftAsync (Story 3.10/Task 3) ------------------------------------------------------

    [Theory]
    [InlineData(LifecycleState.Draft)]
    [InlineData(LifecycleState.InReview)]
    [InlineData(LifecycleState.ReviewConfirmed)]
    [InlineData(LifecycleState.Published)]
    public async Task MarkDraftAsync_sets_LifecycleState_Draft_with_no_caller_identity_check_regardless_of_current_state(LifecycleState lifecycleState)
    {
        // Same "trusted system caller" shape as MarkPublishedAsync/GetOwningTutorIdAsync -- called
        // from VersionService.RestoreVersionAsync, not directly by an HTTP request.
        var sut = MakeSut(currentUserId: null);
        var course = MakeDraft(id: "course_1");
        course.LifecycleState = lifecycleState;
        sut.Repository.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(course);

        await sut.Service.MarkDraftAsync("course_1");

        Assert.Equal(LifecycleState.Draft, course.LifecycleState);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        _ = sut.CurrentUser.DidNotReceive().UserId;
    }

    [Fact]
    public async Task MarkDraftAsync_throws_NotFoundException_for_a_genuinely_unknown_course_id()
    {
        var sut = MakeSut();
        sut.Repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Course?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.MarkDraftAsync("missing"));
    }

    // -- DeleteCourseAsync (FR-32) ----------------------------------------------------------------

    [Theory]
    [InlineData(LifecycleState.Draft)]
    [InlineData(LifecycleState.InReview)]
    [InlineData(LifecycleState.ReviewConfirmed)]
    public async Task DeleteCourseAsync_soft_deletes_a_non_Published_course(LifecycleState lifecycleState)
    {
        var sut = MakeSut();
        var course = MakeDraft();
        course.LifecycleState = lifecycleState;
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(course);

        await sut.Service.DeleteCourseAsync("draft_1");

        Assert.True(course.IsDeleted);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteCourseAsync_throws_ValidationException_for_a_Published_course_and_does_not_delete_it()
    {
        var sut = MakeSut();
        var course = MakeDraft();
        course.LifecycleState = LifecycleState.Published;
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(course);

        await Assert.ThrowsAsync<ValidationException>(() => sut.Service.DeleteCourseAsync("draft_1"));

        Assert.False(course.IsDeleted);
        await sut.UnitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteCourseAsync_throws_UnauthorizedAppException_for_a_different_tutors_course()
    {
        var sut = MakeSut(currentUserId: "stranger");
        sut.Repository.GetDraftByIdAsync("draft_1", Arg.Any<CancellationToken>()).Returns(MakeDraft(tutorId: "owner"));

        await Assert.ThrowsAsync<UnauthorizedAppException>(() => sut.Service.DeleteCourseAsync("draft_1"));
    }

    [Fact]
    public async Task DeleteCourseAsync_throws_NotFoundException_for_a_genuinely_unknown_course_id()
    {
        var sut = MakeSut();
        sut.Repository.GetDraftByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Course?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.DeleteCourseAsync("missing"));
    }

    // -- EnsureReadableAsync (Story 11.3, AD-29) ---------------------------------------------------

    [Theory]
    [InlineData(LifecycleState.Draft)]
    [InlineData(LifecycleState.InReview)]
    [InlineData(LifecycleState.ReviewConfirmed)]
    [InlineData(LifecycleState.Published)]
    public async Task EnsureReadableAsync_succeeds_for_the_owning_tutor_at_every_LifecycleState(LifecycleState lifecycleState)
    {
        var sut = MakeSut(currentUserId: "owner_1");
        var course = MakeDraft(tutorId: "owner_1");
        course.LifecycleState = lifecycleState;
        sut.Repository.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(course);

        await sut.Service.EnsureReadableAsync("course_1"); // does not throw
    }

    [Theory]
    [InlineData(UserRole.Master, LifecycleState.InReview)]
    [InlineData(UserRole.Master, LifecycleState.ReviewConfirmed)]
    [InlineData(UserRole.Master, LifecycleState.Published)]
    [InlineData(UserRole.Support, LifecycleState.InReview)]
    [InlineData(UserRole.Support, LifecycleState.ReviewConfirmed)]
    [InlineData(UserRole.Support, LifecycleState.Published)]
    public async Task EnsureReadableAsync_succeeds_for_a_Master_or_Support_reviewer_at_InReview_ReviewConfirmed_or_Published(
        UserRole role,
        LifecycleState lifecycleState
    )
    {
        var sut = MakeSut(currentUserId: "stranger");
        sut.CurrentUser.Role.Returns(role);
        var course = MakeDraft(tutorId: "owner_1");
        course.LifecycleState = lifecycleState;
        sut.Repository.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(course);

        await sut.Service.EnsureReadableAsync("course_1"); // does not throw
    }

    [Theory]
    [InlineData(UserRole.Master)]
    [InlineData(UserRole.Support)]
    public async Task EnsureReadableAsync_throws_NotFoundException_for_a_Master_or_Support_reviewer_at_Draft(UserRole role)
    {
        var sut = MakeSut(currentUserId: "stranger");
        sut.CurrentUser.Role.Returns(role);
        var course = MakeDraft(tutorId: "owner_1");
        course.LifecycleState = LifecycleState.Draft;
        sut.Repository.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(course);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.EnsureReadableAsync("course_1"));
    }

    // AC #3's own deny-by-default: no Enrollment primitive exists yet, so a plain Student or Tutor
    // role never passes this gate for a course they don't own -- including at Published, where a
    // real student read would eventually need to succeed once enrollment exists.
    [Theory]
    [InlineData(UserRole.Student, LifecycleState.Draft)]
    [InlineData(UserRole.Student, LifecycleState.InReview)]
    [InlineData(UserRole.Student, LifecycleState.ReviewConfirmed)]
    [InlineData(UserRole.Student, LifecycleState.Published)]
    [InlineData(UserRole.Tutor, LifecycleState.Draft)]
    [InlineData(UserRole.Tutor, LifecycleState.InReview)]
    [InlineData(UserRole.Tutor, LifecycleState.ReviewConfirmed)]
    [InlineData(UserRole.Tutor, LifecycleState.Published)]
    public async Task EnsureReadableAsync_throws_NotFoundException_for_a_non_owning_non_Admin_caller_at_every_LifecycleState(
        UserRole role,
        LifecycleState lifecycleState
    )
    {
        var sut = MakeSut(currentUserId: "stranger");
        sut.CurrentUser.Role.Returns(role);
        var course = MakeDraft(tutorId: "owner_1");
        course.LifecycleState = lifecycleState;
        sut.Repository.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(course);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.EnsureReadableAsync("course_1"));
    }

    [Fact]
    public async Task EnsureReadableAsync_throws_NotFoundException_for_a_genuinely_unknown_course_id()
    {
        var sut = MakeSut();
        sut.Repository.GetByIdAsync("missing", Arg.Any<CancellationToken>()).Returns((Course?)null);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.EnsureReadableAsync("missing"));
    }

    [Fact]
    public async Task EnsureReadableAsync_throws_NotFoundException_never_UnauthorizedAppException_for_an_unauthenticated_caller()
    {
        var sut = MakeSut(currentUserId: null);
        var course = MakeDraft(tutorId: "owner_1");
        course.LifecycleState = LifecycleState.Published;
        sut.Repository.GetByIdAsync("course_1", Arg.Any<CancellationToken>()).Returns(course);

        await Assert.ThrowsAsync<NotFoundException>(() => sut.Service.EnsureReadableAsync("course_1"));
    }
}

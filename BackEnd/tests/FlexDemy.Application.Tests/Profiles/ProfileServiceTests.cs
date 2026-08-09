using FlexDemy.Application.Common;
using FlexDemy.Application.MasterData.Board;
using FlexDemy.Application.MasterData.City;
using FlexDemy.Application.MasterData.ClassLevel;
using FlexDemy.Application.MasterData.Country;
using FlexDemy.Application.MasterData.State;
using FlexDemy.Application.MasterData.Subject;
using FlexDemy.Application.Profiles;
using FlexDemy.Application.Users;
using FlexDemy.Domain.Profiles;
using FlexDemy.Domain.Users;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.Profiles;

public class ProfileServiceTests
{
    private const string UserId = "usr_1";

    private static UserDto MakeUserDto(string role) => new(UserId, "user@x.com", "Hem", "Singh", role, true);

    private static CompleteStudentProfileRequest MakeStudentRequest() => new(
        ClassLevelId: "cl_1",
        BoardId: "board_1",
        CountryId: "country_1",
        StateId: "state_1",
        CityId: "city_1",
        SubjectIds: ["subj_1"]
    );

    private static SubmitTutorApplicationRequest MakeTutorRequest() => new(
        SubjectIds: ["subj_1"],
        CountryId: "country_1",
        StateId: "state_1",
        CityId: "city_1",
        Bio: "10 years teaching experience",
        Qualifications: "M.Sc Mathematics"
    );

    private sealed class Fixture
    {
        public IStudentProfileRepository StudentProfileRepository { get; } = Substitute.For<IStudentProfileRepository>();
        public ITutorProfileRepository TutorProfileRepository { get; } = Substitute.For<ITutorProfileRepository>();
        public IUnitOfWork UnitOfWork { get; } = Substitute.For<IUnitOfWork>();
        public IIdGenerator IdGenerator { get; } = Substitute.For<IIdGenerator>();
        public IUserService UserService { get; } = Substitute.For<IUserService>();
        public IClassLevelService ClassLevelService { get; } = Substitute.For<IClassLevelService>();
        public IBoardService BoardService { get; } = Substitute.For<IBoardService>();
        public ICountryService CountryService { get; } = Substitute.For<ICountryService>();
        public IStateService StateService { get; } = Substitute.For<IStateService>();
        public ICityService CityService { get; } = Substitute.For<ICityService>();
        public ISubjectService SubjectService { get; } = Substitute.For<ISubjectService>();

        public Fixture()
        {
            ClassLevelService.GetByIdAsync("cl_1", Arg.Any<CancellationToken>()).Returns(new ClassLevelDto("cl_1", "Class 10th", 13, true, []));
            BoardService.GetByIdAsync("board_1", Arg.Any<CancellationToken>()).Returns(new BoardDto("board_1", "CBSE", "CBSE", null, true));
            CountryService.GetByIdAsync("country_1", Arg.Any<CancellationToken>()).Returns(new CountryDto("country_1", "India", "IN", true));
            StateService.GetByIdAsync("state_1", Arg.Any<CancellationToken>()).Returns(new StateDto("state_1", "country_1", "Maharashtra", "MH", true));
            CityService.GetByIdAsync("city_1", Arg.Any<CancellationToken>()).Returns(new CityDto("city_1", "state_1", "Mumbai", true));
            SubjectService.GetByIdAsync("subj_1", Arg.Any<CancellationToken>()).Returns(new SubjectDto("subj_1", "Mathematics", "Science", true));
        }

        public ProfileService BuildSut() => new(
            StudentProfileRepository, TutorProfileRepository, UnitOfWork, IdGenerator, UserService,
            ClassLevelService, BoardService, CountryService, StateService, CityService, SubjectService);
    }

    [Fact]
    public async Task CompleteStudentProfileAsync_creates_profile_and_assigns_Student_role_when_role_is_Unassigned()
    {
        var f = new Fixture();
        f.UserService.GetByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(MakeUserDto(nameof(UserRole.Unassigned)));
        f.StudentProfileRepository.GetByUserIdAsync(UserId, Arg.Any<CancellationToken>()).Returns((StudentProfile?)null);
        f.IdGenerator.NewId().Returns("profile_new");
        var sut = f.BuildSut();

        var result = await sut.CompleteStudentProfileAsync(UserId, MakeStudentRequest());

        Assert.Equal("profile_new", result.Id);
        Assert.Equal(UserId, result.UserId);
        f.StudentProfileRepository.Received(1).Add(Arg.Is<StudentProfile>(p => p.Id == "profile_new" && p.UserId == UserId));
        await f.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        await f.UserService.Received(1).AssignRoleAsync(UserId, UserRole.Student, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CompleteStudentProfileAsync_throws_ValidationException_when_role_is_not_Unassigned()
    {
        var f = new Fixture();
        f.UserService.GetByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(MakeUserDto(nameof(UserRole.Student)));
        var sut = f.BuildSut();

        await Assert.ThrowsAsync<ValidationException>(() => sut.CompleteStudentProfileAsync(UserId, MakeStudentRequest()));

        f.StudentProfileRepository.DidNotReceive().Add(Arg.Any<StudentProfile>());
        await f.UserService.DidNotReceive().AssignRoleAsync(Arg.Any<string>(), Arg.Any<UserRole>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SwitchRejectedTutorToStudentAsync_throws_ValidationException_when_role_is_not_RejectedTutor()
    {
        var f = new Fixture();
        f.UserService.GetByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(MakeUserDto(nameof(UserRole.Unassigned)));
        var sut = f.BuildSut();

        await Assert.ThrowsAsync<ValidationException>(() => sut.SwitchRejectedTutorToStudentAsync(UserId, MakeStudentRequest()));
    }

    [Fact]
    public async Task SubmitTutorApplicationAsync_creates_profile_and_assigns_PendingTutor_role()
    {
        var f = new Fixture();
        f.UserService.GetByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(MakeUserDto(nameof(UserRole.Unassigned)));
        f.TutorProfileRepository.GetByUserIdAsync(UserId, Arg.Any<CancellationToken>()).Returns((TutorProfile?)null);
        f.IdGenerator.NewId().Returns("tutor_new");
        var sut = f.BuildSut();

        var result = await sut.SubmitTutorApplicationAsync(UserId, MakeTutorRequest());

        Assert.Equal("tutor_new", result.Id);
        Assert.Null(result.ReviewedAt);
        f.TutorProfileRepository.Received(1).Add(Arg.Is<TutorProfile>(p => p.Id == "tutor_new" && p.UserId == UserId));
        await f.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
        await f.UserService.Received(1).AssignRoleAsync(UserId, UserRole.PendingTutor, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReviewTutorApplicationAsync_approves_and_assigns_Tutor_role()
    {
        var f = new Fixture();
        const string reviewerId = "reviewer_1";
        f.UserService.GetByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(MakeUserDto(nameof(UserRole.PendingTutor)));
        var profile = new TutorProfile
        {
            Id = "tutor_1",
            UserId = UserId,
            CountryId = "country_1",
            StateId = "state_1",
            CityId = "city_1",
            SubjectIds = ["subj_1"],
        };
        f.TutorProfileRepository.GetByUserIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(profile);
        var sut = f.BuildSut();

        var result = await sut.ReviewTutorApplicationAsync(reviewerId, UserId, new ReviewTutorApplicationRequest(true, null));

        Assert.Equal(reviewerId, result.ReviewedByUserId);
        Assert.NotNull(result.ReviewedAt);
        Assert.Null(result.RejectionReason);
        f.TutorProfileRepository.Received(1).Update(Arg.Is<TutorProfile>(p => p.ReviewedByUserId == reviewerId && p.RejectionReason == null));
        await f.UserService.Received(1).AssignRoleAsync(UserId, UserRole.Tutor, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReviewTutorApplicationAsync_throws_when_rejecting_without_a_reason()
    {
        var f = new Fixture();
        f.UserService.GetByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(MakeUserDto(nameof(UserRole.PendingTutor)));
        f.TutorProfileRepository.GetByUserIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(new TutorProfile
        {
            Id = "tutor_1",
            UserId = UserId,
            CountryId = "country_1",
            StateId = "state_1",
            CityId = "city_1",
        });
        var sut = f.BuildSut();

        await Assert.ThrowsAsync<ValidationException>(
            () => sut.ReviewTutorApplicationAsync("reviewer_1", UserId, new ReviewTutorApplicationRequest(false, null)));
    }

    [Fact]
    public async Task ReviewTutorApplicationAsync_throws_when_target_is_not_PendingTutor()
    {
        var f = new Fixture();
        f.UserService.GetByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(MakeUserDto(nameof(UserRole.Student)));
        var sut = f.BuildSut();

        await Assert.ThrowsAsync<ValidationException>(
            () => sut.ReviewTutorApplicationAsync("reviewer_1", UserId, new ReviewTutorApplicationRequest(true, null)));
    }

    [Fact]
    public async Task SubmitTutorApplicationAsync_reapply_after_rejection_updates_existing_row_clears_rejection_and_reassigns_PendingTutor()
    {
        var f = new Fixture();
        f.UserService.GetByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(MakeUserDto(nameof(UserRole.RejectedTutor)));
        var existing = new TutorProfile
        {
            Id = "tutor_1",
            UserId = UserId,
            CountryId = "country_old",
            StateId = "state_old",
            CityId = "city_old",
            SubjectIds = ["subj_old"],
            ReviewedByUserId = "reviewer_1",
            ReviewedAt = DateTimeOffset.UtcNow.AddDays(-1),
            RejectionReason = "Not enough experience",
        };
        f.TutorProfileRepository.GetByUserIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(existing);
        var sut = f.BuildSut();

        var result = await sut.SubmitTutorApplicationAsync(UserId, MakeTutorRequest());

        Assert.Equal("tutor_1", result.Id); // same row updated in place, not a new one
        Assert.Null(result.RejectionReason);
        Assert.Null(result.ReviewedAt);
        Assert.Null(result.ReviewedByUserId);
        Assert.Equal(["country_1"], new[] { result.CountryId });
        f.TutorProfileRepository.DidNotReceive().Add(Arg.Any<TutorProfile>());
        f.TutorProfileRepository.Received(1).Update(Arg.Is<TutorProfile>(p => p.Id == "tutor_1" && p.RejectionReason == null && p.ReviewedAt == null));
        await f.UserService.Received(1).AssignRoleAsync(UserId, UserRole.PendingTutor, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetMyProfileStatusAsync_includes_rejection_reason_when_role_is_RejectedTutor()
    {
        var f = new Fixture();
        f.UserService.GetByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(MakeUserDto(nameof(UserRole.RejectedTutor)));
        f.TutorProfileRepository.GetByUserIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(new TutorProfile
        {
            Id = "tutor_1",
            UserId = UserId,
            CountryId = "country_1",
            StateId = "state_1",
            CityId = "city_1",
            RejectionReason = "Not enough experience",
        });
        var sut = f.BuildSut();

        var status = await sut.GetMyProfileStatusAsync(UserId);

        Assert.Equal("RejectedTutor", status.Role);
        Assert.Equal("Not enough experience", status.RejectionReason);
    }

    [Fact]
    public async Task GetMyProfileStatusAsync_omits_rejection_reason_for_other_roles()
    {
        var f = new Fixture();
        f.UserService.GetByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(MakeUserDto(nameof(UserRole.Student)));
        var sut = f.BuildSut();

        var status = await sut.GetMyProfileStatusAsync(UserId);

        Assert.Equal("Student", status.Role);
        Assert.Null(status.RejectionReason);
    }

    [Fact]
    public async Task GetPendingTutorApplicationsAsync_joins_applicant_identity_via_IUserService()
    {
        var f = new Fixture();
        var profile = new TutorProfile { Id = "tutor_1", UserId = UserId, CountryId = "country_1", StateId = "state_1", CityId = "city_1" };
        f.TutorProfileRepository.GetPendingAsync(Arg.Any<CancellationToken>()).Returns(new List<TutorProfile> { profile });
        f.UserService.GetByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(MakeUserDto(nameof(UserRole.PendingTutor)));
        var sut = f.BuildSut();

        var result = await sut.GetPendingTutorApplicationsAsync();

        Assert.Single(result);
        Assert.Equal(UserId, result[0].UserId);
        Assert.Equal("tutor_1", result[0].Profile.Id);
    }
}

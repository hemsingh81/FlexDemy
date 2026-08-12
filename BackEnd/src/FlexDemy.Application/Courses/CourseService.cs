using FlexDemy.Application.Common;
using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

public class CourseService(
    ICourseRepository repository,
    IUnitOfWork unitOfWork,
    IIdGenerator idGenerator,
    IFileStorageService fileStorage,
    ICurrentUserService currentUserService) : ICourseService
{
    // Story 2.4/AC#3: server-side twin of the frontend's MAX_THUMBNAILS -- the backend must
    // not trust the client alone here either.
    private const int MaxThumbnails = 3;
    private const long MaxThumbnailContentLength = 5 * 1024 * 1024;
    private static readonly Dictionary<string, string> AllowedThumbnailContentTypes = new()
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
    };

    public async Task<IReadOnlyList<CourseDto>> GetCoursesAsync(string? gradeTag, string? search, string? subject, CancellationToken cancellationToken = default)
    {
        var courses = await repository.GetAllAsync(gradeTag, search, subject, cancellationToken);
        return courses.Select(c => c.ToDto()).ToList();
    }

    public async Task<CourseDto> GetCourseByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var course = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Courses.Course), id);

        // Code-review patch: a non-Published course (Draft/InReview/ReviewConfirmed) is only
        // visible to its own owning tutor -- otherwise this single-course GET would let anyone
        // who has/guesses a Draft's id read its title/description/thumbnails, even though the
        // list endpoint (GetCoursesAsync) already correctly hides it. NotFoundException (not
        // UnauthorizedAppException) so a non-owner can't distinguish "doesn't exist" from
        // "exists but isn't yours" -- standard practice for hiding a private resource's existence.
        if (course.LifecycleState != LifecycleState.Published && course.TutorId != currentUserService.UserId)
            throw new NotFoundException(nameof(Domain.Courses.Course), id);

        return course.ToDto();
    }

    public async Task<CourseDto> CreateCourseAsync(CreateCourseRequest request, CancellationToken cancellationToken = default)
    {
        var course = request.ToEntity(idGenerator.NewId());
        repository.Add(course);
        // AD-11: the service commits once, after every repository call for this use-case has staged its change.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return course.ToDto();
    }

    public async Task<CourseDto> CreateDraftCourseAsync(CreateDraftCourseRequest request, CancellationToken cancellationToken = default)
    {
        var tutorId = RequireCurrentUserId();
        var title = ValidateTitle(request.Title);

        var course = new Course
        {
            Id = idGenerator.NewId(),
            Title = title,
            ShortDescription = request.Description ?? string.Empty,
            LifecycleState = LifecycleState.Draft,
            TutorId = tutorId,
        };
        repository.Add(course);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return course.ToDto();
    }

    public async Task<CourseDto> UpdateDraftCourseAsync(string id, UpdateDraftCourseRequest request, CancellationToken cancellationToken = default)
    {
        var course = await LoadOwnedDraftAsync(id, cancellationToken);
        course.Title = ValidateTitle(request.Title);
        course.ShortDescription = request.Description ?? string.Empty;
        // Story 2.5: no referential-integrity validation against ITagService/I{Entity}Service --
        // deliberate, proportionate scope decision, see this story's Dev Notes. Deduplicated
        // (a tutor can't submit the same tag twice through the real Tags-step UI, but nothing
        // stops a non-UI caller from trying). Blank/whitespace entries filtered and length-capped
        // (code-review patch) -- the ids column is HasMaxLength(64); without this, an over-length
        // or blank value would surface as an unhandled DbUpdateException/500 at SaveChangesAsync
        // instead of a clean 400, the same reasoning already applied to Title.
        course.TagIds = request.TagIds?.Where(IsValidReferenceId).Distinct().ToList() ?? [];
        course.CountryId = ValidateTaxonomyId(request.CountryId);
        course.StateId = ValidateTaxonomyId(request.StateId);
        course.CityId = ValidateTaxonomyId(request.CityId);
        course.BoardId = ValidateTaxonomyId(request.BoardId);
        course.ClassLevelId = ValidateTaxonomyId(request.ClassLevelId);
        course.SubjectId = ValidateTaxonomyId(request.SubjectId);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return course.ToDto();
    }

    public async Task<CourseDto> AddThumbnailAsync(string courseId, Stream content, string contentType, long contentLength, ThumbnailCropDto crop, CancellationToken cancellationToken = default)
    {
        var course = await LoadOwnedDraftAsync(courseId, cancellationToken);

        if (course.Thumbnails.Count >= MaxThumbnails)
            throw new ValidationException($"Maximum {MaxThumbnails} thumbnails allowed. Remove one before adding another.");

        if (!AllowedThumbnailContentTypes.TryGetValue(contentType, out var extension))
            throw new ValidationException($"Unsupported thumbnail content type '{contentType}'. Allowed: {string.Join(", ", AllowedThumbnailContentTypes.Keys)}.");

        if (contentLength <= 0 || contentLength > MaxThumbnailContentLength)
            throw new ValidationException($"Thumbnail file size must be between 1 byte and {MaxThumbnailContentLength} bytes.");

        // Code-review patch: mirrors ThumbnailCropTool.tsx's own clamped ranges. Without this,
        // an out-of-range crop value persists into a numeric(5,2) column (up to ~±999.99) and
        // permanently corrupts that thumbnail's translate()/scale() rendering math client-side.
        if (crop.X is < 0 or > 100 || crop.Y is < 0 or > 100)
            throw new ValidationException("Crop X/Y must be between 0 and 100.");
        if (crop.Zoom is < 100 or > 300)
            throw new ValidationException("Crop zoom must be between 100 and 300.");

        var fileName = $"{idGenerator.NewId()}{extension}";
        var url = await fileStorage.SaveAsync(content, fileName, contentType, category: "course-thumbnails", cancellationToken);

        course.Thumbnails.Add(new CourseThumbnail
        {
            Id = idGenerator.NewId(),
            CourseId = course.Id,
            Url = url,
            IsPrimary = course.Thumbnails.Count == 0,
            Order = course.Thumbnails.Count,
            CropX = crop.X,
            CropY = crop.Y,
            CropZoom = crop.Zoom,
        });

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return course.ToDto();
    }

    public async Task<CourseDto> RemoveThumbnailAsync(string courseId, string thumbnailId, CancellationToken cancellationToken = default)
    {
        var course = await LoadOwnedDraftAsync(courseId, cancellationToken);
        var thumbnail = course.Thumbnails.FirstOrDefault(t => t.Id == thumbnailId)
            ?? throw new NotFoundException(nameof(CourseThumbnail), thumbnailId);
        var wasPrimary = thumbnail.IsPrimary;

        course.Thumbnails.Remove(thumbnail);

        // Mirrors the frontend mock's `withOrder`/`removeThumbnail` exactly -- re-derive Order
        // from current relative position (no gaps left), and promote a new primary if the
        // removed one was it.
        var remaining = course.Thumbnails.OrderBy(t => t.Order).ToList();
        for (var i = 0; i < remaining.Count; i++)
            remaining[i].Order = i;
        if (wasPrimary && remaining.Count > 0)
            remaining[0].IsPrimary = true;

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return course.ToDto();
    }

    public async Task<CourseDto> ReorderThumbnailAsync(string courseId, string thumbnailId, string direction, CancellationToken cancellationToken = default)
    {
        if (direction is not ("left" or "right"))
            throw new ValidationException($"Invalid reorder direction '{direction}'. Expected 'left' or 'right'.");

        var course = await LoadOwnedDraftAsync(courseId, cancellationToken);
        var ordered = course.Thumbnails.OrderBy(t => t.Order).ToList();
        var index = ordered.FindIndex(t => t.Id == thumbnailId);
        if (index == -1)
            throw new NotFoundException(nameof(CourseThumbnail), thumbnailId);

        var swapWith = direction == "left" ? index - 1 : index + 1;
        if (swapWith >= 0 && swapWith < ordered.Count)
        {
            (ordered[index].Order, ordered[swapWith].Order) = (ordered[swapWith].Order, ordered[index].Order);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        // No-op at a boundary (already leftmost/rightmost) -- matches the frontend mock's
        // `return prev` (current state unchanged, not an error).

        return course.ToDto();
    }

    public async Task<CourseDto> SetPrimaryThumbnailAsync(string courseId, string thumbnailId, CancellationToken cancellationToken = default)
    {
        var course = await LoadOwnedDraftAsync(courseId, cancellationToken);
        var target = course.Thumbnails.FirstOrDefault(t => t.Id == thumbnailId)
            ?? throw new NotFoundException(nameof(CourseThumbnail), thumbnailId);

        foreach (var thumbnail in course.Thumbnails)
            thumbnail.IsPrimary = thumbnail.Id == target.Id;

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return course.ToDto();
    }

    public async Task EnsureOwnedDraftAsync(string courseId, CancellationToken cancellationToken = default) =>
        await LoadOwnedDraftAsync(courseId, cancellationToken);

    public async Task<string> GetOwningTutorIdAsync(string courseId, CancellationToken cancellationToken = default)
    {
        var course = await repository.GetByIdAsync(courseId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Courses.Course), courseId);

        return course.TutorId ?? throw new NotFoundException(nameof(Domain.Courses.Course), courseId);
    }

    private async Task<Course> LoadOwnedDraftAsync(string courseId, CancellationToken cancellationToken)
    {
        var course = await repository.GetDraftByIdAsync(courseId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Courses.Course), courseId);

        var currentUserId = RequireCurrentUserId();
        if (course.TutorId != currentUserId)
            throw new UnauthorizedAppException("You do not have permission to modify this course draft.");

        // Code-review patch: once a Course leaves Draft (a future publish/review-workflow
        // story's responsibility to transition), its title/description/thumbnails must stop
        // being editable through this wizard-only surface -- nothing in this story's own scope
        // performs that transition yet, but this guard is cheap and belongs with the state this
        // story introduced, not deferred to whichever future story adds the transition itself.
        if (course.LifecycleState != LifecycleState.Draft)
            throw new ValidationException("This course is no longer a Draft and can't be edited through the wizard.");

        return course;
    }

    private string RequireCurrentUserId() =>
        currentUserService.UserId ?? throw new UnauthorizedAppException("No authenticated user.");

    // FR-6/AC#2: trimmed, non-empty, within Course.TitleMaxLength -- mirrors the frontend's
    // isTitleStepValid exactly; the backend must not trust the client alone.
    // Code-review patch: `title` is declared non-nullable (`string`) at the C# level, but
    // System.Text.Json's deserializer doesn't enforce NRT annotations at runtime -- a request
    // body sending `"title": null` binds a real null here, which would NRE on .Trim() below
    // and surface as an unhandled 500 instead of a clean 400 without this guard.
    private static string ValidateTitle(string? title)
    {
        if (title is null)
            throw new ValidationException("Title is required.");
        var trimmed = title.Trim();
        if (trimmed.Length == 0)
            throw new ValidationException("Title is required.");
        if (trimmed.Length > Domain.Courses.Course.TitleMaxLength)
            throw new ValidationException($"Title must be {Domain.Courses.Course.TitleMaxLength} characters or fewer.");
        return trimmed;
    }

    // Story 2.5 code-review patch: TagIds/taxonomy id columns are all HasMaxLength(64) -- these
    // ids only ever come from a real backend-fetched <option>/multi-select in the UI (never
    // free-typed), so an over-length or blank value can only arrive via a non-UI caller, but the
    // backend still must not trust that alone (same reasoning as ValidateTitle).
    private const int MaxReferenceIdLength = 64;

    private static bool IsValidReferenceId(string id) =>
        !string.IsNullOrWhiteSpace(id) && id.Length <= MaxReferenceIdLength;

    // Taxonomy fields are legitimately nullable (cascade-reset clears a stale descendant, e.g.
    // changing Country resets State/City/Board/ClassLevel/Subject) -- null/blank passes through
    // as null; a non-null value that's blank-after-trim or over-length is rejected outright
    // rather than silently coerced, so a caller sending garbage finds out immediately.
    private static string? ValidateTaxonomyId(string? id)
    {
        if (id is null)
            return null;
        if (string.IsNullOrWhiteSpace(id))
            return null;
        if (id.Length > MaxReferenceIdLength)
            throw new ValidationException($"Taxonomy reference ids must be {MaxReferenceIdLength} characters or fewer.");
        return id;
    }
}

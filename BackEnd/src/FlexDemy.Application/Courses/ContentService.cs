using System.Text.RegularExpressions;
using FlexDemy.Application.Common;
using FlexDemy.Domain.Courses;
using FlexDemy.Domain.Jobs;

namespace FlexDemy.Application.Courses;

// AD-20: one service for the whole outline (Chapter/Topic/Subtopic/Page/Resource), matching
// IContentRepository's own "one repository" exception. Depends on ICourseService (never
// ICourseRepository directly, per AD-12/the Backend rule "need another feature's data? depend
// on that feature's service interface") for the ownership/Draft-state guards every method here
// reuses rather than reimplementing.
public class ContentService(
    IContentRepository repository,
    ICourseService courseService,
    IUnitOfWork unitOfWork,
    IIdGenerator idGenerator,
    IFileStorageService fileStorage,
    IScanResourceJobEnqueuer scanResourceJobEnqueuer,
    ICorrelationIdAccessor correlationIdAccessor,
    ICourseFileRepository courseFileRepository) : IContentService
{
    // ── Chapter ──────────────────────────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<ChapterSummaryDto>> GetChapterListAsync(string courseId, CancellationToken cancellationToken = default)
    {
        // AD-29: owner (tutor) reads are always allowed regardless of LifecycleState -- not
        // Draft-gated, unlike the mutations below. This is what lets a tutor open a Published
        // course read-only (Story 7.1's AC #9).
        // Story 11.3, AD-29: EnsureReadableAsync (not EnsureOwnedAsync) -- also grants a
        // Master/Support reviewer, not just the owning tutor, once the course is InReview/
        // ReviewConfirmed/Published.
        await courseService.EnsureReadableAsync(courseId, cancellationToken);

        var chapters = await repository.GetChaptersByCourseIdAsync(courseId, cancellationToken);
        return chapters.Select(c => c.ToSummaryDto()).ToList();
    }

    public async Task<ChapterDocumentDto> GetChapterDocumentAsync(string courseId, string chapterId, CancellationToken cancellationToken = default)
    {
        // Story 11.3, AD-29: EnsureReadableAsync (not EnsureOwnedAsync) -- also grants a
        // Master/Support reviewer, not just the owning tutor, once the course is InReview/
        // ReviewConfirmed/Published.
        await courseService.EnsureReadableAsync(courseId, cancellationToken);
        var chapter = await LoadChapterInCourseAsync(courseId, chapterId, cancellationToken);
        var topics = await BuildTopicDocumentsAsync(chapterId, cancellationToken);
        var pages = await BuildPageDocumentsAsync(ContentOwnerType.Chapter, chapterId, cancellationToken);
        var resources = await BuildResourceDtosAsync(ContentOwnerType.Chapter, chapterId, cancellationToken);
        return chapter.ToDocumentDto(topics, pages, resources);
    }

    public async Task<ChapterSummaryDto> CreateChapterAsync(string courseId, CreateChapterRequest request, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var title = ValidateTitle(request.Title, Chapter.TitleMaxLength);

        var siblingCount = (await repository.GetChaptersByCourseIdAsync(courseId, cancellationToken)).Count;
        EnforceLimit(siblingCount, MaxChaptersPerCourse, "chapters per course");

        var chapter = new Chapter
        {
            Id = idGenerator.NewId(),
            CourseId = courseId,
            Title = title,
            Order = siblingCount,
        };
        repository.Add(chapter);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return chapter.ToSummaryDto();
    }

    public async Task<ChapterDocumentDto> UpdateChapterAsync(string courseId, string chapterId, UpdateChapterRequest request, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var chapter = await LoadChapterInCourseAsync(courseId, chapterId, cancellationToken);

        chapter.Title = ValidateTitle(request.Title, Chapter.TitleMaxLength);
        chapter.Description = ValidateDescription(request.Description, Chapter.DescriptionMaxLength);

        // Text-only edit -- Story 7.4 owns FR-44's structural-edit-resets-confirmation
        // semantics (and retrofits it into this story's create/delete/reorder methods below);
        // this update never touches IsConfirmed.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        var topics = await BuildTopicDocumentsAsync(chapterId, cancellationToken);
        var pages = await BuildPageDocumentsAsync(ContentOwnerType.Chapter, chapterId, cancellationToken);
        var resources = await BuildResourceDtosAsync(ContentOwnerType.Chapter, chapterId, cancellationToken);
        return chapter.ToDocumentDto(topics, pages, resources);
    }

    public async Task<DeleteImpactDto> GetChapterDeleteImpactAsync(string courseId, string chapterId, CancellationToken cancellationToken = default)
    {
        // Ownership-only, not Draft-gated -- a tutor can see what a delete would do on a
        // non-Draft course even though the actual delete (below) is blocked there.
        // Story 11.3, AD-29: EnsureReadableAsync (not EnsureOwnedAsync) -- also grants a
        // Master/Support reviewer, not just the owning tutor, once the course is InReview/
        // ReviewConfirmed/Published.
        await courseService.EnsureReadableAsync(courseId, cancellationToken);
        await LoadChapterInCourseAsync(courseId, chapterId, cancellationToken);

        var topics = await repository.GetTopicsByChapterIdAsync(chapterId, cancellationToken);
        var subtopicCount = 0;
        var pageCount = 0;
        var pageResourceCount = 0;
        var nodeResourceCount = (await repository.GetResourcesByOwnerAsync(ContentOwnerType.Chapter, chapterId, cancellationToken)).Count;

        pageResourceCount += await CountPageResourcesAsync(ContentOwnerType.Chapter, chapterId, cancellationToken);
        pageCount += (await repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, chapterId, cancellationToken)).Count;

        foreach (var topic in topics)
        {
            var subtopics = await repository.GetSubtopicsByTopicIdAsync(topic.Id, cancellationToken);
            subtopicCount += subtopics.Count;
            nodeResourceCount += (await repository.GetResourcesByOwnerAsync(ContentOwnerType.Topic, topic.Id, cancellationToken)).Count;
            pageCount += (await repository.GetPagesByOwnerAsync(ContentOwnerType.Topic, topic.Id, cancellationToken)).Count;
            pageResourceCount += await CountPageResourcesAsync(ContentOwnerType.Topic, topic.Id, cancellationToken);
            foreach (var subtopic in subtopics)
            {
                nodeResourceCount += (await repository.GetResourcesByOwnerAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken)).Count;
                pageCount += (await repository.GetPagesByOwnerAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken)).Count;
                pageResourceCount += await CountPageResourcesAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken);
            }
        }

        return new DeleteImpactDto(topics.Count, subtopicCount, Pages: pageCount, PageResources: pageResourceCount, NodeResources: nodeResourceCount);
    }

    public async Task DeleteChapterAsync(string courseId, string chapterId, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var chapter = await LoadChapterInCourseAsync(courseId, chapterId, cancellationToken);
        var filesToDelete = new List<string>();

        // Service-layer cascade (AD-20 -- no DB-level ON DELETE CASCADE exists for this outline).
        filesToDelete.AddRange(await StageResourceRemovalAsync(ContentOwnerType.Chapter, chapterId, cancellationToken));
        foreach (var page in await repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, chapterId, cancellationToken))
        {
            filesToDelete.AddRange(await StageResourceRemovalAsync(ContentOwnerType.Page, page.Id, cancellationToken));
            repository.Remove(page);
        }

        var topics = await repository.GetTopicsByChapterIdAsync(chapterId, cancellationToken);
        foreach (var topic in topics)
        {
            filesToDelete.AddRange(await StageResourceRemovalAsync(ContentOwnerType.Topic, topic.Id, cancellationToken));
            foreach (var page in await repository.GetPagesByOwnerAsync(ContentOwnerType.Topic, topic.Id, cancellationToken))
            {
                filesToDelete.AddRange(await StageResourceRemovalAsync(ContentOwnerType.Page, page.Id, cancellationToken));
                repository.Remove(page);
            }

            var subtopics = await repository.GetSubtopicsByTopicIdAsync(topic.Id, cancellationToken);
            foreach (var subtopic in subtopics)
            {
                filesToDelete.AddRange(await StageResourceRemovalAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken));
                foreach (var page in await repository.GetPagesByOwnerAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken))
                {
                    filesToDelete.AddRange(await StageResourceRemovalAsync(ContentOwnerType.Page, page.Id, cancellationToken));
                    repository.Remove(page);
                }
                repository.Remove(subtopic);
            }
            repository.Remove(topic);
        }
        repository.Remove(chapter);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        await DeleteStoredFilesBestEffortAsync(filesToDelete, cancellationToken);
    }

    public async Task ReorderChapterAsync(string courseId, string chapterId, string direction, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var parsedDirection = ParseReorderDirection(direction);

        var siblings = (await repository.GetChaptersByCourseIdAsync(courseId, cancellationToken))
            .OrderBy(c => c.Order).ToList();
        var index = siblings.FindIndex(c => c.Id == chapterId);
        if (index == -1)
            throw new NotFoundException(nameof(Chapter), chapterId);

        // A Chapter's own immediate parent is the Course itself, which has no IsConfirmed
        // concept in this outline (FR-44 only names Topic/Subtopic/Page-owner resets) -- nothing
        // to reset here.
        await SwapOrderAsync(siblings, index, parsedDirection, cancellationToken);
    }

    // ── Topic ────────────────────────────────────────────────────────────────────────────────

    public async Task<TopicDocumentDto> CreateTopicAsync(string courseId, string chapterId, CreateTopicRequest request, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var chapter = await LoadChapterInCourseAsync(courseId, chapterId, cancellationToken);
        var title = ValidateTitle(request.Title, Topic.TitleMaxLength);

        var siblingCount = (await repository.GetTopicsByChapterIdAsync(chapterId, cancellationToken)).Count;
        EnforceLimit(siblingCount, MaxTopicsPerChapter, "topics per chapter");
        var topic = new Topic { Id = idGenerator.NewId(), ChapterId = chapterId, Title = title, Order = siblingCount };
        repository.Add(topic);
        // FR-44: adding a child structurally changes its immediate parent -- resets the Chapter
        // to Unconfirmed, same commit as the Add above (rule 4: exactly one SaveChangesAsync).
        chapter.IsConfirmed = false;
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return topic.ToDocumentDto([], [], []);
    }

    public async Task<TopicDocumentDto> UpdateTopicAsync(string courseId, string topicId, UpdateTopicRequest request, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var topic = await LoadTopicInCourseAsync(courseId, topicId, cancellationToken);

        topic.Title = ValidateTitle(request.Title, Topic.TitleMaxLength);
        topic.Description = ValidateDescription(request.Description, Topic.DescriptionMaxLength);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        var subtopics = await BuildSubtopicDocumentsAsync(topicId, cancellationToken);
        var pages = await BuildPageDocumentsAsync(ContentOwnerType.Topic, topicId, cancellationToken);
        var resources = await BuildResourceDtosAsync(ContentOwnerType.Topic, topicId, cancellationToken);
        return topic.ToDocumentDto(subtopics, pages, resources);
    }

    public async Task<DeleteImpactDto> GetTopicDeleteImpactAsync(string courseId, string topicId, CancellationToken cancellationToken = default)
    {
        // Story 11.3, AD-29: EnsureReadableAsync (not EnsureOwnedAsync) -- also grants a
        // Master/Support reviewer, not just the owning tutor, once the course is InReview/
        // ReviewConfirmed/Published.
        await courseService.EnsureReadableAsync(courseId, cancellationToken);
        await LoadTopicInCourseAsync(courseId, topicId, cancellationToken);

        var subtopics = await repository.GetSubtopicsByTopicIdAsync(topicId, cancellationToken);
        var pageCount = (await repository.GetPagesByOwnerAsync(ContentOwnerType.Topic, topicId, cancellationToken)).Count;
        var nodeResourceCount = (await repository.GetResourcesByOwnerAsync(ContentOwnerType.Topic, topicId, cancellationToken)).Count;
        var pageResourceCount = await CountPageResourcesAsync(ContentOwnerType.Topic, topicId, cancellationToken);
        foreach (var subtopic in subtopics)
        {
            pageCount += (await repository.GetPagesByOwnerAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken)).Count;
            nodeResourceCount += (await repository.GetResourcesByOwnerAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken)).Count;
            pageResourceCount += await CountPageResourcesAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken);
        }

        return new DeleteImpactDto(Topics: 0, subtopics.Count, Pages: pageCount, PageResources: pageResourceCount, NodeResources: nodeResourceCount);
    }

    public async Task DeleteTopicAsync(string courseId, string topicId, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var topic = await LoadTopicInCourseAsync(courseId, topicId, cancellationToken);
        var chapter = await LoadChapterInCourseAsync(courseId, topic.ChapterId, cancellationToken);
        var filesToDelete = new List<string>();

        filesToDelete.AddRange(await StageResourceRemovalAsync(ContentOwnerType.Topic, topicId, cancellationToken));
        foreach (var page in await repository.GetPagesByOwnerAsync(ContentOwnerType.Topic, topicId, cancellationToken))
        {
            filesToDelete.AddRange(await StageResourceRemovalAsync(ContentOwnerType.Page, page.Id, cancellationToken));
            repository.Remove(page);
        }

        var subtopics = await repository.GetSubtopicsByTopicIdAsync(topicId, cancellationToken);
        foreach (var subtopic in subtopics)
        {
            filesToDelete.AddRange(await StageResourceRemovalAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken));
            foreach (var page in await repository.GetPagesByOwnerAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken))
            {
                filesToDelete.AddRange(await StageResourceRemovalAsync(ContentOwnerType.Page, page.Id, cancellationToken));
                repository.Remove(page);
            }
            repository.Remove(subtopic);
        }
        repository.Remove(topic);
        chapter.IsConfirmed = false; // FR-44: deleting a child resets the immediate parent.

        await unitOfWork.SaveChangesAsync(cancellationToken);
        await DeleteStoredFilesBestEffortAsync(filesToDelete, cancellationToken);
    }

    public async Task ReorderTopicAsync(string courseId, string topicId, string direction, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var parsedDirection = ParseReorderDirection(direction);
        var topic = await LoadTopicInCourseAsync(courseId, topicId, cancellationToken);
        var chapter = await LoadChapterInCourseAsync(courseId, topic.ChapterId, cancellationToken);

        var siblings = (await repository.GetTopicsByChapterIdAsync(topic.ChapterId, cancellationToken))
            .OrderBy(t => t.Order).ToList();
        var index = siblings.FindIndex(t => t.Id == topicId);
        // FR-44: only a real reorder (not a boundary no-op) resets the immediate parent --
        // onWillSwap fires only once the swap is confirmed to happen, before the shared commit.
        await SwapOrderAsync(siblings, index, parsedDirection, cancellationToken, () => chapter.IsConfirmed = false);
    }

    // ── Subtopic ─────────────────────────────────────────────────────────────────────────────

    public async Task<SubtopicDocumentDto> CreateSubtopicAsync(string courseId, string topicId, CreateSubtopicRequest request, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var topic = await LoadTopicInCourseAsync(courseId, topicId, cancellationToken);
        var title = ValidateTitle(request.Title, Subtopic.TitleMaxLength);

        var siblingCount = (await repository.GetSubtopicsByTopicIdAsync(topicId, cancellationToken)).Count;
        EnforceLimit(siblingCount, MaxSubtopicsPerTopic, "sub-topics per topic");
        var subtopic = new Subtopic { Id = idGenerator.NewId(), TopicId = topicId, Title = title, Order = siblingCount };
        repository.Add(subtopic);
        topic.IsConfirmed = false; // FR-44
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return subtopic.ToDocumentDto([], []);
    }

    public async Task<SubtopicDocumentDto> UpdateSubtopicAsync(string courseId, string subtopicId, UpdateSubtopicRequest request, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var subtopic = await LoadSubtopicInCourseAsync(courseId, subtopicId, cancellationToken);

        subtopic.Title = ValidateTitle(request.Title, Subtopic.TitleMaxLength);
        subtopic.Description = ValidateDescription(request.Description, Subtopic.DescriptionMaxLength);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        var pages = await BuildPageDocumentsAsync(ContentOwnerType.Subtopic, subtopicId, cancellationToken);
        var resources = await BuildResourceDtosAsync(ContentOwnerType.Subtopic, subtopicId, cancellationToken);
        return subtopic.ToDocumentDto(pages, resources);
    }

    public async Task<DeleteImpactDto> GetSubtopicDeleteImpactAsync(string courseId, string subtopicId, CancellationToken cancellationToken = default)
    {
        // Story 11.3, AD-29: EnsureReadableAsync (not EnsureOwnedAsync) -- also grants a
        // Master/Support reviewer, not just the owning tutor, once the course is InReview/
        // ReviewConfirmed/Published.
        await courseService.EnsureReadableAsync(courseId, cancellationToken);
        await LoadSubtopicInCourseAsync(courseId, subtopicId, cancellationToken);

        // A Subtopic has no structural child nodes of its own (only Pages/Resources attach to it).
        var pageCount = (await repository.GetPagesByOwnerAsync(ContentOwnerType.Subtopic, subtopicId, cancellationToken)).Count;
        var nodeResourceCount = (await repository.GetResourcesByOwnerAsync(ContentOwnerType.Subtopic, subtopicId, cancellationToken)).Count;
        var pageResourceCount = await CountPageResourcesAsync(ContentOwnerType.Subtopic, subtopicId, cancellationToken);
        return new DeleteImpactDto(Topics: 0, Subtopics: 0, Pages: pageCount, PageResources: pageResourceCount, NodeResources: nodeResourceCount);
    }

    public async Task DeleteSubtopicAsync(string courseId, string subtopicId, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var subtopic = await LoadSubtopicInCourseAsync(courseId, subtopicId, cancellationToken);
        var topic = await LoadTopicInCourseAsync(courseId, subtopic.TopicId, cancellationToken);
        var filesToDelete = new List<string>();

        filesToDelete.AddRange(await StageResourceRemovalAsync(ContentOwnerType.Subtopic, subtopicId, cancellationToken));
        foreach (var page in await repository.GetPagesByOwnerAsync(ContentOwnerType.Subtopic, subtopicId, cancellationToken))
        {
            filesToDelete.AddRange(await StageResourceRemovalAsync(ContentOwnerType.Page, page.Id, cancellationToken));
            repository.Remove(page);
        }
        repository.Remove(subtopic);
        topic.IsConfirmed = false; // FR-44
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await DeleteStoredFilesBestEffortAsync(filesToDelete, cancellationToken);
    }

    public async Task ReorderSubtopicAsync(string courseId, string subtopicId, string direction, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var parsedDirection = ParseReorderDirection(direction);
        var subtopic = await LoadSubtopicInCourseAsync(courseId, subtopicId, cancellationToken);
        var topic = await LoadTopicInCourseAsync(courseId, subtopic.TopicId, cancellationToken);

        var siblings = (await repository.GetSubtopicsByTopicIdAsync(subtopic.TopicId, cancellationToken))
            .OrderBy(s => s.Order).ToList();
        var index = siblings.FindIndex(s => s.Id == subtopicId);
        await SwapOrderAsync(siblings, index, parsedDirection, cancellationToken, () => topic.IsConfirmed = false);
    }

    // ── Page ─────────────────────────────────────────────────────────────────────────────────

    public async Task<PageDocumentDto> CreatePageAsync(string courseId, CreatePageRequest request, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        // A Page's own OwnerType is restricted to Chapter/Topic/Subtopic (AC #1's "cursor under a
        // Topic or Sub-Topic heading") -- unlike a Resource (Story 8.1), a Page can never be
        // owned by another Page. LoadOwnerInCourseAsync itself now accepts Page generically
        // (Resource's own broader ownership rule), so this guard enforces Page's narrower one
        // explicitly, before it ever tries to load a "parent" Page.
        if (request.OwnerType == ContentOwnerType.Page)
            throw new ValidationException("A Page cannot be owned by another Page.");
        var owner = await LoadOwnerInCourseAsync(courseId, request.OwnerType, request.OwnerId, cancellationToken);
        var title = ValidateTitle(request.Title, Page.TitleMaxLength);

        var siblingCount = (await repository.GetPagesByOwnerAsync(request.OwnerType, request.OwnerId, cancellationToken)).Count;
        EnforceLimit(siblingCount, MaxPagesPerNode, "pages per node");
        var page = new Page { Id = idGenerator.NewId(), OwnerType = request.OwnerType, OwnerId = request.OwnerId, Title = title, Order = siblingCount };
        repository.Add(page);
        ResetConfirmation(owner); // FR-44
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return page.ToDocumentDto([]);
    }

    // Story 11.2, FR-46: page-scope Preview as Student's own fetch -- also reused by Story 11.4's
    // real Course Player. Not Draft-gated (AD-29's "owner reads are always allowed" posture, same
    // as GetChapterDocumentAsync above), so a tutor can preview a Published course too.
    public async Task<PageDocumentDto> GetPageAsync(string courseId, string pageId, CancellationToken cancellationToken = default)
    {
        // Story 11.3, AD-29: EnsureReadableAsync (not EnsureOwnedAsync) -- also grants a
        // Master/Support reviewer, not just the owning tutor, once the course is InReview/
        // ReviewConfirmed/Published.
        await courseService.EnsureReadableAsync(courseId, cancellationToken);
        var page = await LoadPageInCourseAsync(courseId, pageId, cancellationToken);
        var resources = await BuildResourceDtosAsync(ContentOwnerType.Page, pageId, cancellationToken);
        return page.ToDocumentDto(resources);
    }

    public async Task<PageDocumentDto> UpdatePageAsync(string courseId, string pageId, UpdatePageRequest request, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var page = await LoadPageInCourseAsync(courseId, pageId, cancellationToken);

        page.Title = ValidateTitle(request.Title, Page.TitleMaxLength);
        var bodyMarkdown = request.BodyMarkdown ?? string.Empty;
        if (System.Text.Encoding.UTF8.GetByteCount(bodyMarkdown) > MaxPageBodyBytes)
            throw new ValidationException($"Page body must be {MaxPageBodyBytes / 1024} KB or fewer.");
        page.BodyMarkdown = bodyMarkdown;
        // Text-only edit -- FR-44 never resets confirmation for a body/title-text update, only
        // for a structural edit (create/delete/reorder/move a child, or the child itself moving).
        await unitOfWork.SaveChangesAsync(cancellationToken);
        var resources = await BuildResourceDtosAsync(ContentOwnerType.Page, pageId, cancellationToken);
        return page.ToDocumentDto(resources);
    }

    public async Task<DeleteImpactDto> GetPageDeleteImpactAsync(string courseId, string pageId, CancellationToken cancellationToken = default)
    {
        // Story 11.3, AD-29: EnsureReadableAsync (not EnsureOwnedAsync) -- also grants a
        // Master/Support reviewer, not just the owning tutor, once the course is InReview/
        // ReviewConfirmed/Published.
        await courseService.EnsureReadableAsync(courseId, cancellationToken);
        await LoadPageInCourseAsync(courseId, pageId, cancellationToken);

        // A Page has no structural children of its own -- only Resources attach to it directly,
        // counted here as NodeResources (the resources on the node being deleted itself).
        var nodeResourceCount = (await repository.GetResourcesByOwnerAsync(ContentOwnerType.Page, pageId, cancellationToken)).Count;
        return new DeleteImpactDto(Topics: 0, Subtopics: 0, Pages: 0, PageResources: 0, NodeResources: nodeResourceCount);
    }

    public async Task DeletePageAsync(string courseId, string pageId, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var page = await LoadPageInCourseAsync(courseId, pageId, cancellationToken);
        var owner = await LoadOwnerInCourseAsync(courseId, page.OwnerType, page.OwnerId, cancellationToken);
        var filesToDelete = await StageResourceRemovalAsync(ContentOwnerType.Page, pageId, cancellationToken);
        repository.Remove(page);
        ResetConfirmation(owner); // FR-44
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await DeleteStoredFilesBestEffortAsync(filesToDelete, cancellationToken);
    }

    public async Task ReorderPageAsync(string courseId, string pageId, string direction, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var parsedDirection = ParseReorderDirection(direction);
        var page = await LoadPageInCourseAsync(courseId, pageId, cancellationToken);
        var owner = await LoadOwnerInCourseAsync(courseId, page.OwnerType, page.OwnerId, cancellationToken);

        var siblings = (await repository.GetPagesByOwnerAsync(page.OwnerType, page.OwnerId, cancellationToken))
            .OrderBy(p => p.Order).ToList();
        var index = siblings.FindIndex(p => p.Id == pageId);
        await SwapOrderAsync(siblings, index, parsedDirection, cancellationToken, () => ResetConfirmation(owner));
    }

    public async Task<PageDocumentDto> MovePageAsync(string courseId, string pageId, MovePageRequest request, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        if (request.OwnerType == ContentOwnerType.Page)
            throw new ValidationException("A Page cannot be owned by another Page.");
        var page = await LoadPageInCourseAsync(courseId, pageId, cancellationToken);
        // Captured before OwnerType/OwnerId are overwritten below -- FR-44's third explicit case
        // resets BOTH the source and destination immediate parents, plus the page itself.
        var sourceOwner = await LoadOwnerInCourseAsync(courseId, page.OwnerType, page.OwnerId, cancellationToken);
        var destinationOwner = await LoadOwnerInCourseAsync(courseId, request.OwnerType, request.OwnerId, cancellationToken);

        var newSiblingCount = (await repository.GetPagesByOwnerAsync(request.OwnerType, request.OwnerId, cancellationToken)).Count;
        // Code-review fix: CreatePageAsync enforces MaxPagesPerNode on its destination; a move
        // into an already-full node bypassed that same cap entirely.
        EnforceLimit(newSiblingCount, MaxPagesPerNode, "pages per node");
        page.OwnerType = request.OwnerType;
        page.OwnerId = request.OwnerId;
        page.Order = newSiblingCount;
        page.IsConfirmed = false;
        ResetConfirmation(sourceOwner);
        ResetConfirmation(destinationOwner);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Story 8.2's downward inheritance (a Page showing its ancestors' node-level resources) is
        // resolved entirely client-side (FrontEnd/resolveInheritedResources.ts), computed fresh
        // from the ChapterDocumentDto tree on every fetch -- there is no server-side cached/stored
        // inherited-resource state to re-resolve here. The frontend's own onReload() after this
        // move already refetches that tree, so the new ancestry is picked up automatically with no
        // backend action needed. The Page's own directly-attached resources (below) move with it
        // automatically too -- they're just rows scoped by OwnerId=pageId, unaffected by
        // OwnerType/OwnerId changing.
        var resources = await BuildResourceDtosAsync(ContentOwnerType.Page, pageId, cancellationToken);
        return page.ToDocumentDto(resources);
    }

    // ── Resource ─────────────────────────────────────────────────────────────────────────────

    // Story 8.1/AD-15: the hardened upload path (Story 2.6's CourseFileService.UploadFileAsync,
    // read in full before writing this) -- validate size/type/50-cap before touching storage,
    // save bytes, create the row at Status=Queued, commit, then enqueue an async scan job. The
    // HTTP response returns immediately (tab-close-safety) -- the scan runs after this call
    // returns.
    public async Task<ResourceDto> UploadResourceAsync(string courseId, ContentOwnerType ownerType, string ownerId, string label, string? caption, string? role, Stream content, string fileName, string contentType, long contentLength, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var owner = await LoadOwnerInCourseAsync(courseId, ownerType, ownerId, cancellationToken);

        var extension = Path.GetExtension(fileName);
        if (string.IsNullOrEmpty(extension) || !AllowedResourceExtensions.Contains(extension))
            throw new ValidationException($"Unsupported file type '{extension}'. Allowed: images, documents, and common code/text files.");

        if (contentLength <= 0 || contentLength > MaxResourceContentLength)
            throw new ValidationException($"Resource size must be between 1 byte and {MaxResourceContentLength} bytes.");

        if (string.IsNullOrWhiteSpace(fileName) || fileName.Length > Resource.FileNameMaxLength)
            throw new ValidationException($"File name must be 1-{Resource.FileNameMaxLength} characters.");

        var validatedLabel = ValidateLabel(label, Resource.LabelMaxLength);
        var validatedCaption = ValidateCaption(caption, Resource.CaptionMaxLength);
        var normalizedContentType = contentType.Split(';')[0].Trim();
        var resolvedRole = ResolveRoleForCreate(role, normalizedContentType);

        // AC #8: checked before any file I/O, per this story's own explicit ordering.
        var siblingCount = (await repository.GetResourcesByOwnerAsync(ownerType, ownerId, cancellationToken)).Count;
        EnforceLimit(siblingCount, MaxResourcesPerOwner, "resources per node");

        var storedFileName = $"{idGenerator.NewId()}{extension}";
        var storedUrl = await fileStorage.SaveAsync(content, storedFileName, normalizedContentType, category: "course-resources", cancellationToken);

        var resource = new Resource
        {
            Id = idGenerator.NewId(),
            OwnerType = ownerType,
            OwnerId = ownerId,
            Label = validatedLabel,
            Caption = validatedCaption,
            Role = resolvedRole,
            FileName = fileName,
            ContentType = normalizedContentType,
            SizeBytes = contentLength,
            StoredUrl = storedUrl,
            Status = JobItemStatus.Queued,
            Order = siblingCount,
        };
        repository.Add(resource);
        ResetConfirmation(owner); // FR-44: adding a resource is a structural edit.
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Code-review-pattern compensation (mirrors CourseFileService.UploadFileAsync exactly):
        // the row is already committed -- if scheduling the scan itself fails, mark it Failed
        // rather than leaving it silently stuck at Queued forever.
        try
        {
            scanResourceJobEnqueuer.Enqueue(resource.Id, correlationIdAccessor.Current);
        }
        catch (Exception)
        {
            resource.Status = JobItemStatus.Failed;
            resource.FailureReason = "Could not schedule malware scan. Please retry.";
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return resource.ToDto();
    }

    // Story 8.1, Task 2/FR-37: "Attach existing file" -- references the same StoredUrl/
    // ContentType/SizeBytes/FileName as the source CourseFile, no byte duplication, no re-upload,
    // no re-scan (it's already scanned). Status = Done immediately, skipping the async job
    // entirely -- this is the literal meaning of "references the already-scanned file."
    public async Task<ResourceDto> AttachExistingFileAsResourceAsync(string courseId, AttachExistingFileAsResourceRequest request, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var owner = await LoadOwnerInCourseAsync(courseId, request.OwnerType, request.OwnerId, cancellationToken);

        var courseFile = await courseFileRepository.GetByIdAsync(request.CourseFileId, cancellationToken);
        if (courseFile is null || courseFile.CourseId != courseId)
            throw new NotFoundException(nameof(Domain.Courses.CourseFile), request.CourseFileId);
        if (courseFile.Status != JobItemStatus.Done)
            throw new ValidationException("This file hasn't finished scanning yet and can't be attached.");

        var siblingCount = (await repository.GetResourcesByOwnerAsync(request.OwnerType, request.OwnerId, cancellationToken)).Count;
        EnforceLimit(siblingCount, MaxResourcesPerOwner, "resources per node");

        var resource = new Resource
        {
            Id = idGenerator.NewId(),
            OwnerType = request.OwnerType,
            OwnerId = request.OwnerId,
            CourseFileId = courseFile.Id,
            Label = ValidateLabel(courseFile.FileName, Resource.LabelMaxLength),
            Role = ResolveRoleForCreate(request.Role, courseFile.ContentType),
            FileName = courseFile.FileName,
            ContentType = courseFile.ContentType,
            SizeBytes = courseFile.SizeBytes,
            StoredUrl = courseFile.StoredUrl,
            Status = JobItemStatus.Done,
            Order = siblingCount,
        };
        repository.Add(resource);
        ResetConfirmation(owner); // FR-44
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return resource.ToDto();
    }

    public async Task<ResourceDto> UpdateResourceAsync(string courseId, string resourceId, UpdateResourceRequest request, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var resource = await LoadResourceInCourseAsync(courseId, resourceId, cancellationToken);

        resource.Label = ValidateLabel(request.Label, Resource.LabelMaxLength);
        resource.Caption = ValidateCaption(request.Caption, Resource.CaptionMaxLength);

        // FR-44: Label/Caption are text-only edits (no reset); a genuine role CHANGE is an
        // explicit "re-role a resource" structural edit -- only reset when the value actually
        // changes, same no-op-guard discipline as ReorderTopicAsync's onWillSwap.
        var newRole = ParseRole(request.Role);
        if (newRole != resource.Role)
        {
            resource.Role = newRole;
            var owner = await LoadOwnerInCourseAsync(courseId, resource.OwnerType, resource.OwnerId, cancellationToken);
            ResetConfirmation(owner);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return resource.ToDto();
    }

    public async Task<IReadOnlyList<ResourceDto>> GetResourcesByOwnerAsync(string courseId, ContentOwnerType ownerType, string ownerId, CancellationToken cancellationToken = default)
    {
        // Story 11.3, AD-29: EnsureReadableAsync (not EnsureOwnedAsync) -- also grants a
        // Master/Support reviewer, not just the owning tutor, once the course is InReview/
        // ReviewConfirmed/Published.
        await courseService.EnsureReadableAsync(courseId, cancellationToken);
        await LoadOwnerInCourseAsync(courseId, ownerType, ownerId, cancellationToken);
        return await BuildResourceDtosAsync(ownerType, ownerId, cancellationToken);
    }

    public async Task ReorderResourceAsync(string courseId, string resourceId, string direction, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var parsedDirection = ParseReorderDirection(direction);
        var resource = await LoadResourceInCourseAsync(courseId, resourceId, cancellationToken);

        var siblings = (await repository.GetResourcesByOwnerAsync(resource.OwnerType, resource.OwnerId, cancellationToken))
            .OrderBy(r => r.Order).ToList();
        var index = siblings.FindIndex(r => r.Id == resourceId);
        // Reordering isn't in FR-44's reset list (only add/delete/re-role) -- no confirmation
        // reset here, matching the story's own scope.
        await SwapOrderAsync(siblings, index, parsedDirection, cancellationToken);
    }

    // Story 8.1's own scope note: no delete-in-use guard here -- Story 8.3 owns FR-31's "blocked
    // while referenced" guard.
    // Story 8.3, FR-31: now guarded -- blocked (ConflictException naming the referencing Page(s))
    // when at least one Page's BodyMarkdown contains a `resource:{id}` reference, unless the
    // caller explicitly passes forceRemoveFromContent (FR-31's "Remove from content and delete"
    // second action), which strips every reference then deletes, both in this same commit.
    public async Task DeleteResourceAsync(string courseId, string resourceId, bool forceRemoveFromContent = false, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var resource = await LoadResourceInCourseAsync(courseId, resourceId, cancellationToken);
        var owner = await LoadOwnerInCourseAsync(courseId, resource.OwnerType, resource.OwnerId, cancellationToken);

        var referencingPages = await FindPagesReferencingResourceAsync(courseId, resourceId, cancellationToken);
        if (referencingPages.Count > 0)
        {
            if (!forceRemoveFromContent)
            {
                var names = string.Join(", ", referencingPages.Select(p => string.IsNullOrWhiteSpace(p.Title) ? "(untitled page)" : p.Title));
                throw new ConflictException($"This resource is referenced in: {names}. Remove it from that content first, or choose \"Remove from content and delete\".");
            }

            var marker = ResourceMarkerPattern(resourceId);
            foreach (var page in referencingPages)
                page.BodyMarkdown = marker.Replace(page.BodyMarkdown, string.Empty);
        }

        repository.Remove(resource);
        ResetConfirmation(owner); // FR-44
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // A resource promoted from an existing CourseFile (FR-37) shares that file's bytes --
        // must never delete them here, only a directly-uploaded resource's own exclusive bytes.
        if (resource.CourseFileId is null)
        {
            try
            {
                await fileStorage.DeleteAsync(resource.StoredUrl, cancellationToken);
            }
            catch (Exception)
            {
                // Best-effort, same posture as CourseFileService.DeleteFileAsync.
            }
        }
    }

    // Story 8.3, AD-29: mirrors CourseFileService.DownloadFileAsync exactly, applied to a
    // Resource -- ownership-only (not Draft-gated), matching every other read on this controller.
    public async Task<ResourceContentDto> GetResourceContentAsync(string courseId, string resourceId, CancellationToken cancellationToken = default)
    {
        // Story 11.3, AD-29: EnsureReadableAsync (not EnsureOwnedAsync) -- also grants a
        // Master/Support reviewer, not just the owning tutor, once the course is InReview/
        // ReviewConfirmed/Published.
        await courseService.EnsureReadableAsync(courseId, cancellationToken);
        var resource = await LoadResourceInCourseAsync(courseId, resourceId, cancellationToken);
        // Code-review fix: a resource still Queued for its malware/SVG scan, or one the scan
        // already Failed, was previously served identically to a clean Done resource -- the scan
        // gate existed at upload/attach time but not here, its one actual enforcement point.
        if (resource.Status != JobItemStatus.Done)
            throw new ConflictException("This resource hasn't finished scanning yet and can't be downloaded.");

        var content = await fileStorage.OpenReadAsync(resource.StoredUrl, cancellationToken);
        return new ResourceContentDto(content, resource.ContentType, resource.FileName);
    }

    // Story 8.3, Task 3: the only way to find every Page that could reference a resource --
    // BodyMarkdown is unvalidated text (DD-3), no structured index of in-body references exists
    // to query instead, so a plain substring scan across every Page in the course is correct here.
    private async Task<IReadOnlyList<Page>> FindPagesReferencingResourceAsync(string courseId, string resourceId, CancellationToken cancellationToken)
    {
        var marker = ResourceMarkerPattern(resourceId);
        var allPages = await GetAllPagesInCourseAsync(courseId, cancellationToken);
        return allPages.Where(p => marker.IsMatch(p.BodyMarkdown)).ToList();
    }

    // Code-review fix: a plain "resource:{id}" substring match/replace would false-positive
    // whenever one resource's id happens to be a text prefix of another's -- the id boundary
    // (never followed by another id character) is required on both the find and strip sides
    // below, one shared regex so they can't drift out of sync with each other.
    private static Regex ResourceMarkerPattern(string resourceId) =>
        new($@"resource:{Regex.Escape(resourceId)}(?![\w-])");

    // Every Page in a course, regardless of which node owns it -- a Page is never owned by
    // another Page (CreatePageAsync/MovePageAsync's own guard), so Chapter/Topic/Subtopic
    // ownership is the complete set of places a Page can attach; same traversal shape as
    // DeleteChapterAsync's own cascade walk, reused here for a read instead of a cascade delete.
    private async Task<IReadOnlyList<Page>> GetAllPagesInCourseAsync(string courseId, CancellationToken cancellationToken)
    {
        var pages = new List<Page>();
        var chapters = await repository.GetChaptersByCourseIdAsync(courseId, cancellationToken);
        foreach (var chapter in chapters)
        {
            pages.AddRange(await repository.GetPagesByOwnerAsync(ContentOwnerType.Chapter, chapter.Id, cancellationToken));
            var topics = await repository.GetTopicsByChapterIdAsync(chapter.Id, cancellationToken);
            foreach (var topic in topics)
            {
                pages.AddRange(await repository.GetPagesByOwnerAsync(ContentOwnerType.Topic, topic.Id, cancellationToken));
                var subtopics = await repository.GetSubtopicsByTopicIdAsync(topic.Id, cancellationToken);
                foreach (var subtopic in subtopics)
                    pages.AddRange(await repository.GetPagesByOwnerAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken));
            }
        }
        return pages;
    }

    private async Task<Resource> LoadResourceInCourseAsync(string courseId, string resourceId, CancellationToken cancellationToken)
    {
        var resource = await repository.GetResourceByIdAsync(resourceId, cancellationToken);
        if (resource is null)
            throw new NotFoundException(nameof(Resource), resourceId);

        await LoadOwnerInCourseAsync(courseId, resource.OwnerType, resource.OwnerId, cancellationToken);
        return resource;
    }

    // ── Outline ──────────────────────────────────────────────────────────────────────────────

    public async Task<OutlineDto> GetOutlineAsync(string courseId, CancellationToken cancellationToken = default)
    {
        // Ownership-only, not Draft-gated -- same read posture as every other list/document read.
        // Story 11.3, AD-29: EnsureReadableAsync (not EnsureOwnedAsync) -- also grants a
        // Master/Support reviewer, not just the owning tutor, once the course is InReview/
        // ReviewConfirmed/Published.
        await courseService.EnsureReadableAsync(courseId, cancellationToken);

        var chapters = await repository.GetChaptersByCourseIdAsync(courseId, cancellationToken);
        var result = new List<OutlineChapterDto>(chapters.Count);
        foreach (var chapter in chapters)
        {
            var topics = await BuildOutlineTopicsAsync(chapter.Id, cancellationToken);
            var pages = await BuildOutlinePagesAsync(ContentOwnerType.Chapter, chapter.Id, cancellationToken);
            result.Add(new OutlineChapterDto(chapter.Id, chapter.Title, chapter.Description, chapter.IsConfirmed, chapter.Order, topics, pages));
        }
        return new OutlineDto(result);
    }

    private async Task<IReadOnlyList<OutlineTopicDto>> BuildOutlineTopicsAsync(string chapterId, CancellationToken cancellationToken)
    {
        var topics = await repository.GetTopicsByChapterIdAsync(chapterId, cancellationToken);
        var result = new List<OutlineTopicDto>(topics.Count);
        foreach (var topic in topics)
        {
            var subtopics = await BuildOutlineSubtopicsAsync(topic.Id, cancellationToken);
            var pages = await BuildOutlinePagesAsync(ContentOwnerType.Topic, topic.Id, cancellationToken);
            result.Add(new OutlineTopicDto(topic.Id, topic.Title, topic.Description, topic.IsConfirmed, topic.Order, subtopics, pages));
        }
        return result;
    }

    private async Task<IReadOnlyList<OutlineSubtopicDto>> BuildOutlineSubtopicsAsync(string topicId, CancellationToken cancellationToken)
    {
        var subtopics = await repository.GetSubtopicsByTopicIdAsync(topicId, cancellationToken);
        var result = new List<OutlineSubtopicDto>(subtopics.Count);
        foreach (var subtopic in subtopics)
        {
            var pages = await BuildOutlinePagesAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken);
            result.Add(new OutlineSubtopicDto(subtopic.Id, subtopic.Title, subtopic.Description, subtopic.IsConfirmed, subtopic.Order, pages));
        }
        return result;
    }

    private async Task<IReadOnlyList<OutlinePageDto>> BuildOutlinePagesAsync(ContentOwnerType ownerType, string ownerId, CancellationToken cancellationToken) =>
        (await repository.GetPagesByOwnerAsync(ownerType, ownerId, cancellationToken))
            .Select(p => new OutlinePageDto(p.Id, p.Title, p.IsConfirmed, p.Order))
            .ToList();

    // ── Shared helpers ───────────────────────────────────────────────────────────────────────

    private async Task<IReadOnlyList<TopicDocumentDto>> BuildTopicDocumentsAsync(string chapterId, CancellationToken cancellationToken)
    {
        var topics = await repository.GetTopicsByChapterIdAsync(chapterId, cancellationToken);
        var result = new List<TopicDocumentDto>(topics.Count);
        foreach (var topic in topics)
        {
            var subtopics = await BuildSubtopicDocumentsAsync(topic.Id, cancellationToken);
            var pages = await BuildPageDocumentsAsync(ContentOwnerType.Topic, topic.Id, cancellationToken);
            var resources = await BuildResourceDtosAsync(ContentOwnerType.Topic, topic.Id, cancellationToken);
            result.Add(topic.ToDocumentDto(subtopics, pages, resources));
        }
        return result;
    }

    private async Task<IReadOnlyList<SubtopicDocumentDto>> BuildSubtopicDocumentsAsync(string topicId, CancellationToken cancellationToken)
    {
        var subtopics = await repository.GetSubtopicsByTopicIdAsync(topicId, cancellationToken);
        var result = new List<SubtopicDocumentDto>(subtopics.Count);
        foreach (var subtopic in subtopics)
        {
            var pages = await BuildPageDocumentsAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken);
            var resources = await BuildResourceDtosAsync(ContentOwnerType.Subtopic, subtopic.Id, cancellationToken);
            result.Add(subtopic.ToDocumentDto(pages, resources));
        }
        return result;
    }

    private async Task<IReadOnlyList<PageDocumentDto>> BuildPageDocumentsAsync(ContentOwnerType ownerType, string ownerId, CancellationToken cancellationToken)
    {
        var pages = await repository.GetPagesByOwnerAsync(ownerType, ownerId, cancellationToken);
        var result = new List<PageDocumentDto>(pages.Count);
        foreach (var page in pages)
        {
            var resources = await BuildResourceDtosAsync(ContentOwnerType.Page, page.Id, cancellationToken);
            result.Add(page.ToDocumentDto(resources));
        }
        return result;
    }

    private async Task<IReadOnlyList<ResourceDto>> BuildResourceDtosAsync(ContentOwnerType ownerType, string ownerId, CancellationToken cancellationToken) =>
        (await repository.GetResourcesByOwnerAsync(ownerType, ownerId, cancellationToken)).Select(r => r.ToDto()).ToList();

    // Sums the resource counts of every Page owned by (ownerType, ownerId) -- used by the
    // delete-impact reads to report "PageResources" (resources living on a descendant Page)
    // separately from "NodeResources" (resources attached directly to a non-Page node).
    private async Task<int> CountPageResourcesAsync(ContentOwnerType ownerType, string ownerId, CancellationToken cancellationToken)
    {
        var total = 0;
        foreach (var page in await repository.GetPagesByOwnerAsync(ownerType, ownerId, cancellationToken))
            total += (await repository.GetResourcesByOwnerAsync(ContentOwnerType.Page, page.Id, cancellationToken)).Count;
        return total;
    }

    // Stages every resource owned by (ownerType, ownerId) for removal (repository.Remove -- part
    // of the caller's own single commit) and returns the StoredUrls whose bytes this resource
    // exclusively owns (CourseFileId is null) -- a resource promoted from an existing CourseFile
    // (FR-37) shares that file's bytes and must never have them deleted here. The caller deletes
    // the returned URLs best-effort, after the commit succeeds (DeleteStoredFilesBestEffortAsync).
    private async Task<IReadOnlyList<string>> StageResourceRemovalAsync(ContentOwnerType ownerType, string ownerId, CancellationToken cancellationToken)
    {
        var filesToDelete = new List<string>();
        foreach (var resource in await repository.GetResourcesByOwnerAsync(ownerType, ownerId, cancellationToken))
        {
            repository.Remove(resource);
            if (resource.CourseFileId is null) filesToDelete.Add(resource.StoredUrl);
        }
        return filesToDelete;
    }

    // Best-effort, same posture as CourseFileService.DeleteFileAsync's own storage cleanup -- the
    // tutor asked for this content gone; an orphaned blob is a cheap, recoverable cost, a failed
    // cascade delete because storage hiccuped is not.
    private async Task DeleteStoredFilesBestEffortAsync(IReadOnlyList<string> storedUrls, CancellationToken cancellationToken)
    {
        foreach (var storedUrl in storedUrls)
        {
            try
            {
                await fileStorage.DeleteAsync(storedUrl, cancellationToken);
            }
            catch (Exception)
            {
                // Swallowed deliberately.
            }
        }
    }

    private async Task<Page> LoadPageInCourseAsync(string courseId, string pageId, CancellationToken cancellationToken)
    {
        var page = await repository.GetPageByIdAsync(pageId, cancellationToken);
        if (page is null)
            throw new NotFoundException(nameof(Page), pageId);

        await LoadOwnerInCourseAsync(courseId, page.OwnerType, page.OwnerId, cancellationToken);
        return page;
    }

    // A Page's OwnerType/OwnerId is polymorphic (AD-20, no FK) -- verifying it belongs to this
    // course means loading the actual owner entity and reusing that entity's own
    // course-ownership check, same "don't leak existence across courses" posture as
    // LoadChapterInCourseAsync/LoadTopicInCourseAsync/LoadSubtopicInCourseAsync. Returns the
    // loaded (tracked) owner entity itself -- Story 7.4 callers use it to flip IsConfirmed
    // without a second, redundant fetch.
    // Story 8.1: extended with the Page case -- a Resource (unlike a Page) can be owned by any of
    // the four ContentOwnerType members, Page included (AC #1's "cursor inside a page body").
    private async Task<object> LoadOwnerInCourseAsync(string courseId, ContentOwnerType ownerType, string ownerId, CancellationToken cancellationToken) =>
        ownerType switch
        {
            ContentOwnerType.Chapter => await LoadChapterInCourseAsync(courseId, ownerId, cancellationToken),
            ContentOwnerType.Topic => await LoadTopicInCourseAsync(courseId, ownerId, cancellationToken),
            ContentOwnerType.Subtopic => await LoadSubtopicInCourseAsync(courseId, ownerId, cancellationToken),
            ContentOwnerType.Page => await LoadPageInCourseAsync(courseId, ownerId, cancellationToken),
            _ => throw new ValidationException($"Unsupported owner type '{ownerType}'."),
        };

    // NotFoundException both when the id doesn't exist and when it belongs to a different
    // course -- same "don't leak existence" posture CourseService.GetCourseByIdAsync uses,
    // applied here to prevent a chapterId from one course being readable/writable via another
    // course's courseId in the URL.
    private async Task<Chapter> LoadChapterInCourseAsync(string courseId, string chapterId, CancellationToken cancellationToken)
    {
        var chapter = await repository.GetChapterByIdAsync(chapterId, cancellationToken);
        if (chapter is null || chapter.CourseId != courseId)
            throw new NotFoundException(nameof(Chapter), chapterId);

        return chapter;
    }

    private async Task<Topic> LoadTopicInCourseAsync(string courseId, string topicId, CancellationToken cancellationToken)
    {
        var topic = await repository.GetTopicByIdAsync(topicId, cancellationToken);
        if (topic is null)
            throw new NotFoundException(nameof(Topic), topicId);

        // Verifies the owning Chapter belongs to this course -- reuses LoadChapterInCourseAsync's
        // own existence+ownership check rather than duplicating the comparison here.
        await LoadChapterInCourseAsync(courseId, topic.ChapterId, cancellationToken);
        return topic;
    }

    private async Task<Subtopic> LoadSubtopicInCourseAsync(string courseId, string subtopicId, CancellationToken cancellationToken)
    {
        var subtopic = await repository.GetSubtopicByIdAsync(subtopicId, cancellationToken);
        if (subtopic is null)
            throw new NotFoundException(nameof(Subtopic), subtopicId);

        await LoadTopicInCourseAsync(courseId, subtopic.TopicId, cancellationToken);
        return subtopic;
    }

    // Generic sibling-swap for the direction-based reorder convention (matches
    // CoursesController.ReorderThumbnail's own {Direction} shape, "up"/"down" vocabulary per
    // Application/Common/ReorderDirection.cs's own documented precedent). No-op at either end of
    // the list, same as ReorderThumbnailAsync's own boundary behavior. `onWillSwap` (Story 7.4,
    // FR-44) fires only once a real swap is confirmed to happen -- before the shared commit, and
    // never on a boundary no-op, so a reorder that didn't actually move anything never falsely
    // resets a parent's confirmation.
    private async Task<bool> SwapOrderAsync<T>(IReadOnlyList<T> orderedSiblings, int index, ReorderDirection direction, CancellationToken cancellationToken, Action? onWillSwap = null)
        where T : class
    {
        if (index == -1) throw new NotFoundException(typeof(T).Name, "(not found among its siblings)");

        var swapWith = direction == ReorderDirection.Backward ? index - 1 : index + 1;
        if (swapWith < 0 || swapWith >= orderedSiblings.Count) return false; // boundary no-op

        var current = orderedSiblings[index];
        var target = orderedSiblings[swapWith];
        var currentOrder = GetOrder(current);
        var targetOrder = GetOrder(target);
        SetOrder(current, targetOrder);
        SetOrder(target, currentOrder);
        onWillSwap?.Invoke();

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return true;
    }

    // Story 7.4, FR-44: flips a Chapter/Topic/Subtopic/Page's own confirmation state to
    // Unconfirmed -- used both for a node's own confirmation (Page move) and for flipping an
    // immediate parent after a structural child edit. A shared helper (not per-call-site
    // duplication) so Story 8.1's own resource mutations can call it identically once Resource
    // exists, per this story's own scope note.
    private static void ResetConfirmation(object entity)
    {
        switch (entity)
        {
            case Chapter c: c.IsConfirmed = false; break;
            case Topic t: t.IsConfirmed = false; break;
            case Subtopic s: s.IsConfirmed = false; break;
            case Page p: p.IsConfirmed = false; break;
            default: throw new InvalidOperationException($"Unsupported confirmable type '{entity.GetType().Name}'.");
        }
    }

    // Story 7.4, NFR4: per-course bounded limits, enforced server-side with a specific message
    // naming the limit -- never a silent failure or an unhandled DB constraint violation.
    private const int MaxChaptersPerCourse = 100;
    private const int MaxTopicsPerChapter = 100;
    private const int MaxSubtopicsPerTopic = 50;
    private const int MaxPagesPerNode = 200;
    private const int MaxPageBodyBytes = 256 * 1024;

    // Story 8.1, AC #8/#9: a different limit from CourseFileService.MaxFileContentLength's 50 MB
    // for source files -- deliberately not reused, this is a distinct feature's own bound. Public
    // so ContentController's [RequestSizeLimit] can reference it, matching CourseFileService's
    // own MaxFileContentLength precedent.
    public const long MaxResourceContentLength = 25 * 1024 * 1024;
    private const int MaxResourcesPerOwner = 50;

    // FR-42: images, documents, and a bounded code/text extension allowlist (PRD Appendix A,
    // read verbatim rather than guessed). Extension-keyed, not content-type-keyed like
    // CourseFileService's own allowlist -- a browser's reported Content-Type for a .py/.ts/.md
    // file is unreliable (often "text/plain" or "application/octet-stream" for all of them),
    // unlike the small, well-known MIME set CourseFileService validates against. The extension is
    // still taken from the tutor-supplied file name here (not re-derived from a trusted lookup),
    // a deliberate, narrower trust boundary than CourseFileService's -- acceptable because this
    // story's stored file name is never used to choose how the bytes are served back (Story
    // 8.3's authenticated content endpoint always serves the DB's own recorded ContentType), so
    // there is no reflected-extension risk the way an attacker-chosen extension paired with a
    // trusted Content-Type would create on a route that infers behavior from the file name.
    private static readonly HashSet<string> AllowedResourceExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
        ".pdf", ".doc", ".docx", ".txt", ".xls", ".xlsx",
        ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".c", ".cpp", ".cs", ".go", ".rb", ".php",
        ".html", ".css", ".json", ".xml", ".sql", ".sh", ".yaml", ".yml", ".md",
    };

    private static void EnforceLimit(int currentCount, int max, string what)
    {
        if (currentCount >= max)
            throw new ValidationException($"This course has reached its limit of {max} {what}.");
    }

    private static int GetOrder(object entity) => entity switch
    {
        Chapter c => c.Order,
        Topic t => t.Order,
        Subtopic s => s.Order,
        Page p => p.Order,
        Resource r => r.Order,
        _ => throw new InvalidOperationException($"Unsupported reorderable type '{entity.GetType().Name}'."),
    };

    private static void SetOrder(object entity, int order)
    {
        switch (entity)
        {
            case Chapter c: c.Order = order; break;
            case Topic t: t.Order = order; break;
            case Subtopic s: s.Order = order; break;
            case Page p: p.Order = order; break;
            case Resource r: r.Order = order; break;
            default: throw new InvalidOperationException($"Unsupported reorderable type '{entity.GetType().Name}'.");
        }
    }

    private static ReorderDirection ParseReorderDirection(string direction) => direction switch
    {
        "up" => ReorderDirection.Backward,
        "down" => ReorderDirection.Forward,
        _ => throw new ValidationException($"Invalid reorder direction '{direction}'. Expected 'up' or 'down'."),
    };

    private static string ValidateTitle(string? title, int maxLength)
    {
        if (title is null)
            throw new ValidationException("Title is required.");
        var trimmed = title.Trim();
        if (trimmed.Length == 0)
            throw new ValidationException("Title is required.");
        if (trimmed.Length > maxLength)
            throw new ValidationException($"Title must be {maxLength} characters or fewer.");
        return trimmed;
    }

    private static string ValidateDescription(string? description, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(description))
            return string.Empty;
        var trimmed = description.Trim();
        if (trimmed.Length > maxLength)
            throw new ValidationException($"Description must be {maxLength} characters or fewer.");
        return trimmed;
    }

    private static string ValidateLabel(string? label, int maxLength)
    {
        if (label is null)
            throw new ValidationException("Label is required.");
        var trimmed = label.Trim();
        if (trimmed.Length == 0)
            throw new ValidationException("Label is required.");
        if (trimmed.Length > maxLength)
            throw new ValidationException($"Label must be {maxLength} characters or fewer.");
        return trimmed;
    }

    private static string? ValidateCaption(string? caption, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(caption))
            return null;
        var trimmed = caption.Trim();
        if (trimmed.Length > maxLength)
            throw new ValidationException($"Caption must be {maxLength} characters or fewer.");
        return trimmed;
    }

    // Story 8.1, FR-38: default role by content-type at create time when the caller didn't
    // specify one explicitly (the frontend's own Task 8 computes this same default client-side
    // and sends it explicitly; this is the server-side fallback/authority).
    private static ResourceRole ResolveRoleForCreate(string? role, string contentType)
    {
        if (string.IsNullOrWhiteSpace(role))
            return contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase) ? ResourceRole.Inline : ResourceRole.Attachment;
        return ParseRole(role);
    }

    private static ResourceRole ParseRole(string? role) => role?.Trim() switch
    {
        "Inline" => ResourceRole.Inline,
        "Attachment" => ResourceRole.Attachment,
        "Both" => ResourceRole.Both,
        _ => throw new ValidationException($"Invalid role '{role}'. Expected 'Inline', 'Attachment', or 'Both'."),
    };
}

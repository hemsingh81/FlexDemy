using System.Text.Json;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.Common;
using FlexDemy.Domain.Courses;
using Microsoft.Extensions.Logging;

namespace FlexDemy.Application.Courses;

// AD-12: depends on ICourseService for the ownership+Draft-state guard (CourseFileService's
// established precedent), and on ICourseFileRepository directly since CourseFile/Chapter/Topic/
// Subtopic/ContentBlock all live under the same Courses feature (Task 6's materialization reads
// and claims CourseFile rows, not a cross-feature concern). Story 2.10 adds IAiTaskGateway --
// DescribeNotationAsync runs inline/synchronously here per AD-14 (authoring-time accessibility,
// not a Hangfire job).
public class ContentTreeService(
    IContentTreeRepository repository,
    ICourseFileRepository courseFileRepository,
    ICourseService courseService,
    IIdGenerator idGenerator,
    IUnitOfWork unitOfWork,
    IAiTaskGateway aiTaskGateway,
    ILogger<ContentTreeService> logger) : IContentTreeService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    // Code-review patch: match ChapterConfiguration.cs/TopicConfiguration.cs/SubtopicConfiguration.cs's
    // Title HasMaxLength(255) and ContentBlockConfiguration.cs's Lang HasMaxLength(8) -- without a
    // service-level check, an over-length value reached SaveChangesAsync as a raw, un-mapped DB
    // exception (ExceptionHandlingMiddleware only translates AppException subtypes into a clean
    // ProblemDetails response) instead of a client-facing ValidationException.
    private const int MaxTitleLength = 255;
    private const int MaxLangLength = 8;

    public async Task<IReadOnlyList<ChapterDto>> GetTreeAsync(string courseId, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        await MaterializePendingExtractionsAsync(courseId, cancellationToken);

        var tree = await repository.GetTreeAsync(courseId, cancellationToken);
        return tree.Select(c => c.ToDto()).ToList();
    }

    // Task 6: pulls Story 2.8's staged ExtractedStructureJson into real entities the first time a
    // tutor opens the editor after extraction completes. The atomic per-file claim (TryClaimForMaterializationAsync)
    // is what actually closes the concurrent-GetTreeAsync-calls race -- see Dev Notes/ICourseFileRepository.
    private async Task MaterializePendingExtractionsAsync(string courseId, CancellationToken cancellationToken)
    {
        var pending = await courseFileRepository.GetPendingMaterializationAsync(courseId, cancellationToken);
        if (pending.Count == 0)
            return;

        var existingChapters = await repository.GetChaptersByCourseIdAsync(courseId, cancellationToken);
        var nextChapterOrder = existingChapters.Count == 0 ? 0 : existingChapters.Max(c => c.Order) + 1;
        var materializedAny = false;

        // Code-review patch: resolving this before the per-file loop meant a failure here aborted
        // the whole materialization pass -- not just the one file/chapter it should be isolated to,
        // unlike every other failure mode below. GetTreeAsync must still return the tutor's existing
        // tree even if this lookup fails; materialization simply retries on a later call.
        string tutorId;
        try
        {
            // Story 2.10/Task 2: resolved once per pass, not per block -- attribution for every
            // DescribeNotationAsync call this materialization pass makes (AI usage recording, FR-4).
            tutorId = await courseService.GetOwningTutorIdAsync(courseId, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Could not resolve owning tutor for course {CourseId}; skipping materialization this pass", courseId);
            return;
        }

        foreach (var file in pending)
        {
            if (!await courseFileRepository.TryClaimForMaterializationAsync(file.Id, cancellationToken))
                continue; // lost the race -- another concurrent request already claimed this file

            // Code-review patch: the claim above already committed (its own raw-SQL statement, not
            // gated by the SaveChangesAsync below) -- a file can never be reclaimed once IsMaterialized
            // flips true. Previously, an unhandled exception here (malformed staged JSON, an
            // unexpected Format value) propagated straight out of this method, so the one
            // SaveChangesAsync at the end of the loop never ran -- silently discarding every
            // already-staged Chapter from every file processed earlier in this same pass, while the
            // file that actually failed (and every file before it) stayed permanently marked
            // materialized with no retry path. Every failure mode below is now isolated to the one
            // file/chapter it belongs to; every other pending file in this pass still succeeds.
            if (string.IsNullOrWhiteSpace(file.ExtractedStructureJson))
                continue;

            ProposedStructure? structure;
            try
            {
                structure = JsonSerializer.Deserialize<ProposedStructure>(file.ExtractedStructureJson, JsonOptions);
            }
            catch (JsonException)
            {
                structure = null;
            }
            if (structure is null)
                continue;

            foreach (var proposedChapter in structure.Chapters)
            {
                try
                {
                    // BuildChapterAsync only returns a fully-built Chapter -- if it throws partway
                    // through (e.g. Enum.Parse<ContentBlockFormat> rejecting an unexpected Format
                    // value), repository.AddChapter is never reached for it, so no partial chapter
                    // is ever staged.
                    var chapter = await BuildChapterAsync(proposedChapter, courseId, tutorId, nextChapterOrder, cancellationToken);
                    repository.AddChapter(chapter);
                    materializedAny = true;
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    // Code-review patch: widened from ArgumentException-only. Story 2.10's
                    // DescribeNotationAsync call inside BuildContentBlockAsync can throw an exception
                    // type TryDescribeNotationAsync's own narrow catch doesn't handle (by design, for
                    // EditContentBlockAsync's tutor-facing call site -- a tutor's own save should fail
                    // loudly on a genuine bug, per Task 2). That reasoning doesn't transfer here: this
                    // file is already permanently claimed (raw SQL, committed independent of the
                    // SaveChangesAsync below) regardless of what happens next, and an uncaught
                    // exception would also silently discard every already-built sibling chapter staged
                    // earlier in this same pass. Isolating to the one chapter that failed, logging it,
                    // and continuing is strictly safer than losing everything.
                    logger.LogError(ex, "Failed to materialize a chapter for course {CourseId}", courseId);
                }
                finally
                {
                    nextChapterOrder++; // consume the Order slot regardless -- keeps the counter monotonic.
                }
            }
        }

        if (materializedAny)
            await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task<Chapter> BuildChapterAsync(ProposedChapter proposed, string courseId, string tutorId, int order, CancellationToken cancellationToken)
    {
        var chapter = new Chapter
        {
            Id = idGenerator.NewId(),
            CourseId = courseId,
            Title = proposed.Title,
            Confirmation = NodeConfirmation.Unconfirmed,
            Order = order,
        };

        var topicOrder = 0;
        foreach (var proposedTopic in proposed.Topics)
        {
            var topic = new Topic
            {
                Id = idGenerator.NewId(),
                ChapterId = chapter.Id,
                Title = proposedTopic.Title,
                Confirmation = NodeConfirmation.Unconfirmed,
                Order = topicOrder++,
            };

            // Code-review patch: each ContentBlock in this topic that's Math format makes its own
            // AI Gateway HTTP round-trip inside BuildContentBlockAsync (TryDescribeNotationAsync)
            // -- awaiting them one at a time here meant a topic with N math blocks took roughly
            // N x gateway-latency to materialize. RunWithBoundedConcurrencyAsync below fans these
            // out with a capped number in flight at once (never unbounded -- an extraction with
            // many blocks must not hammer the AI Gateway with one simultaneous request per block)
            // while still reproducing the exact same per-block Order values and the exact same
            // resulting ContentBlocks order the original sequential foreach produced.
            var topicBlocks = await RunWithBoundedConcurrencyAsync(
                proposedTopic.ContentBlocks,
                (proposedBlock, blockOrder) => BuildContentBlockAsync(proposedBlock, topicId: topic.Id, subtopicId: null, blockOrder, courseId, tutorId, cancellationToken),
                cancellationToken);
            topic.ContentBlocks.AddRange(topicBlocks);

            var subtopicOrder = 0;
            foreach (var proposedSubtopic in proposedTopic.Subtopics)
            {
                var subtopic = new Subtopic
                {
                    Id = idGenerator.NewId(),
                    TopicId = topic.Id,
                    Title = proposedSubtopic.Title,
                    Confirmation = NodeConfirmation.Unconfirmed,
                    Order = subtopicOrder++,
                };

                var subtopicBlocks = await RunWithBoundedConcurrencyAsync(
                    proposedSubtopic.ContentBlocks,
                    (proposedBlock, blockOrder) => BuildContentBlockAsync(proposedBlock, topicId: null, subtopicId: subtopic.Id, blockOrder, courseId, tutorId, cancellationToken),
                    cancellationToken);
                subtopic.ContentBlocks.AddRange(subtopicBlocks);

                topic.Subtopics.Add(subtopic);
            }

            chapter.Topics.Add(topic);
        }

        return chapter;
    }

    private async Task<ContentBlock> BuildContentBlockAsync(
        ProposedContentBlock proposed, string? topicId, string? subtopicId, int order, string courseId, string tutorId, CancellationToken cancellationToken)
    {
        var block = new ContentBlock
        {
            Id = idGenerator.NewId(),
            TopicId = topicId,
            SubtopicId = subtopicId,
            // ProposedContentBlock.Format is ExtractionResponseParser's validated lowercase wire value
            // ("text"/"math") -- ContentBlockFormat's PascalCase member names parse case-insensitively.
            Format = Enum.Parse<ContentBlockFormat>(proposed.Format, ignoreCase: true),
            Confirmation = NodeConfirmation.Unconfirmed,
            Order = order,
            Text = proposed.Text,
            // Story 2.10: overrides Story 2.8's own AI-guessed Lang unconditionally -- a
            // deterministic script-detection check is strictly more reliable than an LLM's own
            // guess for this narrow classification (this story's own Dev Notes).
            Lang = ContentBlockLanguageDetector.DetectsHindi(proposed.Text) ? "hi" : "en",
            Notation = proposed.Notation,
        };

        // Story 2.10/Task 2: Story 2.8's staged JSON never carries AltText at all -- every
        // materialized Math block needs its own DescribeNotationAsync call. Best-effort,
        // non-blocking: a failure here must not fail the whole tree load.
        if (block.Format == ContentBlockFormat.Math && !string.IsNullOrWhiteSpace(block.Notation))
            block.AltText = await TryDescribeNotationAsync(block.Notation, courseId, tutorId, cancellationToken);

        return block;
    }

    // Code-review patch: bounded fan-out for BuildContentBlockAsync's per-block AI Gateway call --
    // no existing concurrency-limiting helper in Application/Common to reuse, so this is a small,
    // local one. `body` receives each source item together with its list index, which doubles as
    // the block's `order` argument -- assigning it here (synchronously, before any task starts)
    // rather than via a shared mutable counter is what keeps the result list's ordering identical
    // to the original sequential foreach, even though the tasks themselves may complete out of
    // order. A `SemaphoreSlim` caps how many of `body`'s calls (i.e. AI Gateway HTTP round-trips)
    // run at once -- deliberately not Task.WhenAll over the raw enumerable, which would fan out
    // one simultaneous request per content block with no cap at all.
    private const int MaxConcurrentAiCalls = 4;

    private static async Task<List<TResult>> RunWithBoundedConcurrencyAsync<TSource, TResult>(
        IReadOnlyList<TSource> source, Func<TSource, int, Task<TResult>> body, CancellationToken cancellationToken)
    {
        if (source.Count == 0)
            return [];

        using var gate = new SemaphoreSlim(MaxConcurrentAiCalls);

        async Task<TResult> RunOneAsync(TSource item, int index)
        {
            await gate.WaitAsync(cancellationToken);
            try
            {
                return await body(item, index);
            }
            finally
            {
                gate.Release();
            }
        }

        var tasks = new Task<TResult>[source.Count];
        for (var i = 0; i < source.Count; i++)
            tasks[i] = RunOneAsync(source[i], i);

        return [.. await Task.WhenAll(tasks)];
    }

    // Story 2.10/Task 2: AD-14's inline/authoring-time rule -- never a Hangfire job. Catches only
    // the two expected, non-bug failure modes (gateway briefly down / budget exceeded); anything
    // else propagates rather than being silently absorbed (an earlier draft caught every exception
    // type indiscriminately, which would also hide a genuine bug in this new code).
    private async Task<string?> TryDescribeNotationAsync(string notation, string courseId, string tutorId, CancellationToken cancellationToken)
    {
        try
        {
            var messages = NotationDescriptionPromptBuilder.BuildMessages(notation);
            var result = await aiTaskGateway.DescribeNotationAsync(
                new AiTaskRequest(messages, CourseId: courseId, TutorId: tutorId), cancellationToken);
            return result.Content;
        }
        catch (AiTaskUnavailableException ex)
        {
            logger.LogWarning(ex, "describeNotation unavailable for course {CourseId}; leaving AltText unset", courseId);
            return null;
        }
        catch (AiTaskBudgetExceededException ex)
        {
            logger.LogWarning(ex, "describeNotation budget exceeded for course {CourseId}; leaving AltText unset", courseId);
            return null;
        }
    }

    public async Task<ChapterDto> AddChapterAsync(string courseId, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);

        var siblings = await repository.GetChaptersByCourseIdAsync(courseId, cancellationToken);
        var chapter = new Chapter
        {
            Id = idGenerator.NewId(),
            CourseId = courseId,
            Title = "New Chapter",
            Confirmation = NodeConfirmation.Unconfirmed,
            Order = siblings.Count == 0 ? 0 : siblings.Max(c => c.Order) + 1,
        };
        repository.AddChapter(chapter);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return chapter.ToDto();
    }

    public async Task<TopicDto> AddTopicAsync(string courseId, string chapterId, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var chapter = await ResolveChapterAsync(courseId, chapterId, cancellationToken);

        var siblings = await repository.GetTopicsByChapterIdAsync(chapterId, cancellationToken);
        var topic = new Topic
        {
            Id = idGenerator.NewId(),
            ChapterId = chapterId,
            Title = "New Topic",
            Confirmation = NodeConfirmation.Unconfirmed,
            Order = siblings.Count == 0 ? 0 : siblings.Max(t => t.Order) + 1,
        };
        repository.AddTopic(topic);
        ResetIfConfirmed(chapter);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return topic.ToDto();
    }

    public async Task<SubtopicDto> AddSubtopicAsync(string courseId, string topicId, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var topic = await ResolveTopicAsync(courseId, topicId, cancellationToken);

        var siblings = await repository.GetSubtopicsByTopicIdAsync(topicId, cancellationToken);
        var subtopic = new Subtopic
        {
            Id = idGenerator.NewId(),
            TopicId = topicId,
            Title = "New Subtopic",
            Confirmation = NodeConfirmation.Unconfirmed,
            Order = siblings.Count == 0 ? 0 : siblings.Max(s => s.Order) + 1,
        };
        repository.AddSubtopic(subtopic);
        ResetIfConfirmed(topic);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return subtopic.ToDto();
    }

    public async Task<ContentBlockDto> AddContentBlockAsync(string courseId, string parentId, string parentType, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);

        ContentBlock block;
        switch (parentType)
        {
            case "topic":
            {
                // Code-review patch: distinguishes "parentId doesn't exist at all" (NotFoundException)
                // from "parentId is real but resolves to a Subtopic, not a Topic" (ValidationException,
                // per Task 4's explicit callout of this exact mismatch scenario) -- ResolveTopicAsync's
                // own NotFoundException-always shape couldn't tell the two apart.
                var node = await repository.FindNodeAsync(courseId, parentId, cancellationToken)
                    ?? throw new NotFoundException(nameof(Topic), parentId);
                var topic = node.Topic ?? throw new ValidationException($"'{parentId}' is not a Topic.");
                var siblings = await repository.GetContentBlocksByTopicIdAsync(parentId, cancellationToken);
                block = NewContentBlock(topicId: parentId, subtopicId: null, siblings.Count == 0 ? 0 : siblings.Max(b => b.Order) + 1);
                repository.AddContentBlock(block);
                ResetIfConfirmed(topic);
                break;
            }
            case "subtopic":
            {
                var node = await repository.FindNodeAsync(courseId, parentId, cancellationToken)
                    ?? throw new NotFoundException(nameof(Subtopic), parentId);
                var subtopic = node.Subtopic ?? throw new ValidationException($"'{parentId}' is not a Subtopic.");
                var siblings = await repository.GetContentBlocksBySubtopicIdAsync(parentId, cancellationToken);
                block = NewContentBlock(topicId: null, subtopicId: parentId, siblings.Count == 0 ? 0 : siblings.Max(b => b.Order) + 1);
                repository.AddContentBlock(block);
                ResetIfConfirmed(subtopic);
                break;
            }
            default:
                throw new ValidationException($"Invalid parentType '{parentType}'. Expected 'topic' or 'subtopic'.");
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
        return block.ToDto();
    }

    private ContentBlock NewContentBlock(string? topicId, string? subtopicId, int order) => new()
    {
        Id = idGenerator.NewId(),
        TopicId = topicId,
        SubtopicId = subtopicId,
        Format = ContentBlockFormat.Text,
        Confirmation = NodeConfirmation.Unconfirmed,
        Order = order,
        Text = "",
        Lang = "en",
    };

    // FR-15: a title edit is always text-only -- confirmation is never touched here.
    public async Task EditNodeTitleAsync(string courseId, string nodeId, string title, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);

        if (string.IsNullOrWhiteSpace(title) || title.Length > MaxTitleLength)
            throw new ValidationException($"Title must be 1-{MaxTitleLength} characters.");

        var node = await repository.FindNodeAsync(courseId, nodeId, cancellationToken)
            ?? throw new NotFoundException("Node", nodeId);

        if (node.Chapter is not null) node.Chapter.Title = title;
        else if (node.Topic is not null) node.Topic.Title = title;
        else if (node.Subtopic is not null) node.Subtopic.Title = title;
        else throw new ValidationException("A Content Block has no title.");

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task EditContentBlockAsync(string courseId, string blockId, UpdateContentBlockRequest patch, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var node = await repository.FindNodeAsync(courseId, blockId, cancellationToken);
        if (node?.ContentBlock is null)
            throw new NotFoundException(nameof(ContentBlock), blockId);
        var block = node.ContentBlock;

        // Byte-for-byte replication of useCourseContentTree.ts:269's isTextOnly check -- vacuously
        // true for a completely empty patch (Array.every on an empty array is always true), which
        // must therefore preserve confirmation, not reset it.
        var isTextOnly = patch.TouchedFields.All(field => field is "text" or "lang");

        if (patch.TouchedFields.Contains("lang") && patch.Lang is { Length: > MaxLangLength })
            throw new ValidationException($"lang must be at most {MaxLangLength} characters.");

        if (patch.TouchedFields.Contains("text")) block.Text = patch.Text;
        if (patch.TouchedFields.Contains("lang")) block.Lang = patch.Lang;
        if (patch.TouchedFields.Contains("notation")) block.Notation = patch.Notation;
        if (patch.TouchedFields.Contains("imageUrl")) block.ImageUrl = patch.ImageUrl;
        if (patch.TouchedFields.Contains("altText")) block.AltText = patch.AltText;
        if (patch.TouchedFields.Contains("format"))
        {
            if (patch.Format is null || !Enum.TryParse<ContentBlockFormat>(patch.Format, ignoreCase: true, out var parsedFormat))
                throw new ValidationException($"Invalid content block format '{patch.Format}'.");
            block.Format = parsedFormat;
        }

        // Story 2.10/Task 2: auto-generates alt-text for a Math block whose Notation this call
        // just set (first time or changed) -- unless the same request also explicitly supplies
        // AltText, which is a deliberate tutor override, never silently replaced.
        if (block.Format == ContentBlockFormat.Math && patch.TouchedFields.Contains("notation") && !patch.TouchedFields.Contains("altText"))
        {
            if (string.IsNullOrWhiteSpace(block.Notation))
            {
                // Code-review patch: Notation was cleared -- nothing left to describe, so the
                // now-stale AltText (describing notation that no longer exists) must go with it.
                block.AltText = null;
            }
            else
            {
                var tutorId = await courseService.GetOwningTutorIdAsync(courseId, cancellationToken);
                var described = await TryDescribeNotationAsync(block.Notation, courseId, tutorId, cancellationToken);
                // Code-review patch: only overwrite on an actual result. TryDescribeNotationAsync
                // returns null on the two expected AI failure modes (gateway down/budget exceeded) --
                // an unconditional assignment previously clobbered a perfectly good, already-generated
                // (or tutor-written) AltText with null on a merely transient failure, directly
                // contradicting Task 2's own "leaving AltText unchanged" requirement.
                if (described is not null)
                    block.AltText = described;
            }
        }

        // Story 2.10/Task 2: auto-detects language for a Text field this call just set -- unless
        // the same request also explicitly supplies Lang (same override precedent as above).
        if (patch.TouchedFields.Contains("text") && !patch.TouchedFields.Contains("lang"))
            block.Lang = ContentBlockLanguageDetector.DetectsHindi(block.Text) ? "hi" : "en";

        if (!isTextOnly)
            ResetIfConfirmed(block);

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteNodeAsync(string courseId, string nodeId, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var node = await repository.FindNodeAsync(courseId, nodeId, cancellationToken)
            ?? throw new NotFoundException("Node", nodeId);

        if (node.Chapter is not null)
        {
            var siblings = await repository.GetChaptersByCourseIdAsync(courseId, cancellationToken);
            repository.RemoveChapter(node.Chapter);
            Renumber(siblings.Where(c => c.Id != node.Chapter.Id), (c, i) => c.Order = i);
            // Top-level Chapter has no parent to reset, matching the mock's own chapter deletion.
        }
        else if (node.Topic is not null)
        {
            var parent = await repository.GetChapterByIdAsync(node.Topic.ChapterId, cancellationToken);
            var siblings = await repository.GetTopicsByChapterIdAsync(node.Topic.ChapterId, cancellationToken);
            repository.RemoveTopic(node.Topic);
            Renumber(siblings.Where(t => t.Id != node.Topic.Id), (t, i) => t.Order = i);
            if (parent is not null) ResetIfConfirmed(parent);
        }
        else if (node.Subtopic is not null)
        {
            var parent = await repository.GetTopicByIdAsync(node.Subtopic.TopicId, cancellationToken);
            var siblings = await repository.GetSubtopicsByTopicIdAsync(node.Subtopic.TopicId, cancellationToken);
            repository.RemoveSubtopic(node.Subtopic);
            Renumber(siblings.Where(s => s.Id != node.Subtopic.Id), (s, i) => s.Order = i);
            if (parent is not null) ResetIfConfirmed(parent);
        }
        else
        {
            var block = node.ContentBlock!;
            repository.RemoveContentBlock(block);
            if (block.TopicId is not null)
            {
                var parent = await repository.GetTopicByIdAsync(block.TopicId, cancellationToken);
                var siblings = await repository.GetContentBlocksByTopicIdAsync(block.TopicId, cancellationToken);
                Renumber(siblings.Where(b => b.Id != block.Id), (b, i) => b.Order = i);
                if (parent is not null) ResetIfConfirmed(parent);
            }
            else
            {
                var parent = await repository.GetSubtopicByIdAsync(block.SubtopicId!, cancellationToken);
                var siblings = await repository.GetContentBlocksBySubtopicIdAsync(block.SubtopicId!, cancellationToken);
                Renumber(siblings.Where(b => b.Id != block.Id), (b, i) => b.Order = i);
                if (parent is not null) ResetIfConfirmed(parent);
            }
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task ReorderNodeAsync(string courseId, string nodeId, string direction, CancellationToken cancellationToken = default)
    {
        // Code-review patch: the ownership+Draft-state guard now runs before validating `direction`,
        // matching every other mutator in this file (this was the one outlier that checked its own
        // input before confirming the caller may even touch this course).
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);

        var parsedDirection = ParseNodeDirection(direction);

        var node = await repository.FindNodeAsync(courseId, nodeId, cancellationToken)
            ?? throw new NotFoundException("Node", nodeId);

        if (node.Chapter is not null)
        {
            var siblings = await repository.GetChaptersByCourseIdAsync(courseId, cancellationToken);
            SwapAdjacent(siblings, node.Chapter.Id, parsedDirection, (a, b) => (a.Order, b.Order) = (b.Order, a.Order));
            // No parent to reset, matching the mock.
        }
        else if (node.Topic is not null)
        {
            var siblings = await repository.GetTopicsByChapterIdAsync(node.Topic.ChapterId, cancellationToken);
            SwapAdjacent(siblings, node.Topic.Id, parsedDirection, (a, b) => (a.Order, b.Order) = (b.Order, a.Order));
            // Mock's own resetIfConfirmed wrap is unconditional once the id is found at this level
            // -- even a boundary no-op swap still resets the parent's confirmation. Replicated as-is.
            var parent = await repository.GetChapterByIdAsync(node.Topic.ChapterId, cancellationToken);
            if (parent is not null) ResetIfConfirmed(parent);
        }
        else if (node.Subtopic is not null)
        {
            var siblings = await repository.GetSubtopicsByTopicIdAsync(node.Subtopic.TopicId, cancellationToken);
            SwapAdjacent(siblings, node.Subtopic.Id, parsedDirection, (a, b) => (a.Order, b.Order) = (b.Order, a.Order));
            var parent = await repository.GetTopicByIdAsync(node.Subtopic.TopicId, cancellationToken);
            if (parent is not null) ResetIfConfirmed(parent);
        }
        else
        {
            var block = node.ContentBlock!;
            if (block.TopicId is not null)
            {
                var siblings = await repository.GetContentBlocksByTopicIdAsync(block.TopicId, cancellationToken);
                SwapAdjacent(siblings, block.Id, parsedDirection, (a, b) => (a.Order, b.Order) = (b.Order, a.Order));
                var parent = await repository.GetTopicByIdAsync(block.TopicId, cancellationToken);
                if (parent is not null) ResetIfConfirmed(parent);
            }
            else
            {
                var siblings = await repository.GetContentBlocksBySubtopicIdAsync(block.SubtopicId!, cancellationToken);
                SwapAdjacent(siblings, block.Id, parsedDirection, (a, b) => (a.Order, b.Order) = (b.Order, a.Order));
                var parent = await repository.GetSubtopicByIdAsync(block.SubtopicId!, cancellationToken);
                if (parent is not null) ResetIfConfirmed(parent);
            }
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task MoveNodeAsync(string courseId, string draggedId, string targetId, CancellationToken cancellationToken = default)
    {
        if (draggedId == targetId)
            return;

        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var dragged = await repository.FindNodeAsync(courseId, draggedId, cancellationToken);
        var target = await repository.FindNodeAsync(courseId, targetId, cancellationToken);
        if (dragged is null || target is null)
            return; // Matches the mock's own guard: a match that isn't found anywhere is a no-op, not an error.

        if (dragged.Chapter is not null && target.Chapter is not null)
        {
            var siblings = await repository.GetChaptersByCourseIdAsync(courseId, cancellationToken);
            Reposition(siblings, draggedId, targetId, (c, i) => c.Order = i);
        }
        else if (dragged.Topic is not null && target.Topic is not null && dragged.Topic.ChapterId == target.Topic.ChapterId)
        {
            var siblings = await repository.GetTopicsByChapterIdAsync(dragged.Topic.ChapterId, cancellationToken);
            Reposition(siblings, draggedId, targetId, (t, i) => t.Order = i);
            var parent = await repository.GetChapterByIdAsync(dragged.Topic.ChapterId, cancellationToken);
            if (parent is not null) ResetIfConfirmed(parent);
        }
        else if (dragged.Subtopic is not null && target.Subtopic is not null && dragged.Subtopic.TopicId == target.Subtopic.TopicId)
        {
            var siblings = await repository.GetSubtopicsByTopicIdAsync(dragged.Subtopic.TopicId, cancellationToken);
            Reposition(siblings, draggedId, targetId, (s, i) => s.Order = i);
            var parent = await repository.GetTopicByIdAsync(dragged.Subtopic.TopicId, cancellationToken);
            if (parent is not null) ResetIfConfirmed(parent);
        }
        else if (dragged.ContentBlock is not null && target.ContentBlock is not null
                 && dragged.ContentBlock.TopicId is not null && dragged.ContentBlock.TopicId == target.ContentBlock.TopicId)
        {
            var siblings = await repository.GetContentBlocksByTopicIdAsync(dragged.ContentBlock.TopicId, cancellationToken);
            Reposition(siblings, draggedId, targetId, (b, i) => b.Order = i);
            var parent = await repository.GetTopicByIdAsync(dragged.ContentBlock.TopicId, cancellationToken);
            if (parent is not null) ResetIfConfirmed(parent);
        }
        else if (dragged.ContentBlock is not null && target.ContentBlock is not null
                 && dragged.ContentBlock.SubtopicId is not null && dragged.ContentBlock.SubtopicId == target.ContentBlock.SubtopicId)
        {
            var siblings = await repository.GetContentBlocksBySubtopicIdAsync(dragged.ContentBlock.SubtopicId, cancellationToken);
            Reposition(siblings, draggedId, targetId, (b, i) => b.Order = i);
            var parent = await repository.GetSubtopicByIdAsync(dragged.ContentBlock.SubtopicId, cancellationToken);
            if (parent is not null) ResetIfConfirmed(parent);
        }
        else
        {
            return; // Different levels/parents -- matches the mock's own no-op guard, no state change.
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    public async Task ConfirmNodeAsync(string courseId, string nodeId, CancellationToken cancellationToken = default)
    {
        await courseService.EnsureOwnedDraftAsync(courseId, cancellationToken);
        var node = await repository.FindNodeAsync(courseId, nodeId, cancellationToken)
            ?? throw new NotFoundException("Node", nodeId);

        if (node.Chapter is not null) node.Chapter.Confirmation = NodeConfirmation.Confirmed;
        else if (node.Topic is not null) node.Topic.Confirmation = NodeConfirmation.Confirmed;
        else if (node.Subtopic is not null) node.Subtopic.Confirmation = NodeConfirmation.Confirmed;
        else node.ContentBlock!.Confirmation = NodeConfirmation.Confirmed;

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private async Task<Chapter> ResolveChapterAsync(string courseId, string chapterId, CancellationToken cancellationToken)
    {
        var node = await repository.FindNodeAsync(courseId, chapterId, cancellationToken);
        return node?.Chapter ?? throw new NotFoundException(nameof(Chapter), chapterId);
    }

    private async Task<Topic> ResolveTopicAsync(string courseId, string topicId, CancellationToken cancellationToken)
    {
        var node = await repository.FindNodeAsync(courseId, topicId, cancellationToken);
        return node?.Topic ?? throw new NotFoundException(nameof(Topic), topicId);
    }

    private async Task<Subtopic> ResolveSubtopicAsync(string courseId, string subtopicId, CancellationToken cancellationToken)
    {
        var node = await repository.FindNodeAsync(courseId, subtopicId, cancellationToken);
        return node?.Subtopic ?? throw new NotFoundException(nameof(Subtopic), subtopicId);
    }

    private static void Renumber<T>(IEnumerable<T> orderedRemainingSiblings, Action<T, int> setOrder)
    {
        var i = 0;
        foreach (var sibling in orderedRemainingSiblings)
            setOrder(sibling, i++);
    }

    // `siblings` is already Order-sorted (repository contract). Swaps by list index, not by
    // arithmetic on Order values -- CourseService.ReorderThumbnailAsync's own established pattern.
    // A no-op at either end, matching swapAdjacent's own bounds check.
    private static void SwapAdjacent<T>(IReadOnlyList<T> siblings, string id, ReorderDirection direction, Action<T, T> swapOrders) where T : class
    {
        var index = -1;
        for (var i = 0; i < siblings.Count; i++)
        {
            if (GetId(siblings[i]) == id) { index = i; break; }
        }
        if (index == -1)
            return;

        var swapWith = direction == ReorderDirection.Backward ? index - 1 : index + 1;
        if (swapWith >= 0 && swapWith < siblings.Count)
            swapOrders(siblings[index], siblings[swapWith]);
    }

    // Parses this endpoint's own "up"/"down" wire vocabulary into the shared ReorderDirection enum
    // (Application/Common/ReorderDirection.cs) -- see that file for why this isn't parsed further
    // out at the controller boundary instead.
    private static ReorderDirection ParseNodeDirection(string direction) => direction switch
    {
        "up" => ReorderDirection.Backward,
        "down" => ReorderDirection.Forward,
        _ => throw new ValidationException($"Invalid reorder direction '{direction}'. Expected 'up' or 'down'."),
    };

    // `siblings` is already Order-sorted. Splice-and-reinsert (moveToIndex's exact semantics: the
    // target index is captured from the ORIGINAL list before the dragged item is removed), then
    // the whole affected group is renumbered 0..n-1 in the new arrangement.
    private static void Reposition<T>(IReadOnlyList<T> siblings, string draggedId, string targetId, Action<T, int> setOrder) where T : class
    {
        var fromIndex = -1;
        var targetIndex = -1;
        for (var i = 0; i < siblings.Count; i++)
        {
            var id = GetId(siblings[i]);
            if (id == draggedId) fromIndex = i;
            if (id == targetId) targetIndex = i;
        }
        if (fromIndex == -1 || targetIndex == -1 || fromIndex == targetIndex)
            return;

        var next = new List<T>(siblings);
        var moved = next[fromIndex];
        next.RemoveAt(fromIndex);
        next.Insert(targetIndex, moved);

        Renumber(next, setOrder);
    }

    private static string GetId<T>(T entity) where T : class => entity switch
    {
        Chapter c => c.Id,
        Topic t => t.Id,
        Subtopic s => s.Id,
        ContentBlock b => b.Id,
        _ => throw new InvalidOperationException($"Unsupported sibling type '{typeof(T).Name}'."),
    };

    private static void ResetIfConfirmed(Chapter chapter) { if (chapter.Confirmation == NodeConfirmation.Confirmed) chapter.Confirmation = NodeConfirmation.Unconfirmed; }
    private static void ResetIfConfirmed(Topic topic) { if (topic.Confirmation == NodeConfirmation.Confirmed) topic.Confirmation = NodeConfirmation.Unconfirmed; }
    private static void ResetIfConfirmed(Subtopic subtopic) { if (subtopic.Confirmation == NodeConfirmation.Confirmed) subtopic.Confirmation = NodeConfirmation.Unconfirmed; }
    private static void ResetIfConfirmed(ContentBlock block) { if (block.Confirmation == NodeConfirmation.Confirmed) block.Confirmation = NodeConfirmation.Unconfirmed; }
}

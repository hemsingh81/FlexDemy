using FlexDemy.Application.AiConfig;
using FlexDemy.Application.AiGateway;
using FlexDemy.Application.Common;
using FlexDemy.Domain.AiUsage;
using Microsoft.Extensions.Logging;

namespace FlexDemy.Application.AiUsage;

public class AiUsageService(
    IAiTaskUsageRepository repository,
    IAiConfigService configService,
    IUnitOfWork unitOfWork,
    IIdGenerator idGenerator,
    ILogger<AiUsageService> logger) : IAiUsageService
{
    private static readonly HashSet<string> KnownRanges = ["last7", "last30", "all"];

    public async Task<decimal> RecordUsageAsync(
        string taskId, string provider, string model, AiGatewayUsage usage, bool isFallbackServed,
        string? courseId, string? tutorId, CancellationToken cancellationToken = default)
    {
        var config = await configService.GetTaskConfigAsync(taskId, cancellationToken);

        // Separate primary/fallback price pairs (review finding, 2026-08-11) -- a fallback
        // provider is frequently a different price tier than the primary (e.g. a free-tier
        // primary with a paid fallback), so which pair applies must follow which one actually
        // served the call, not a single shared rate.
        var (priceIn, priceOut) = isFallbackServed
            ? (config.FallbackPricePerMillionInputTokens, config.FallbackPricePerMillionOutputTokens)
            : (config.PricePerMillionInputTokens, config.PricePerMillionOutputTokens);

        var cost =
            usage.PromptTokens / 1_000_000m * priceIn +
            usage.CompletionTokens / 1_000_000m * priceOut;

        repository.Add(new AiTaskUsage
        {
            Id = idGenerator.NewId(),
            TaskId = taskId,
            Provider = provider,
            Model = model,
            PromptTokens = usage.PromptTokens,
            CompletionTokens = usage.CompletionTokens,
            TotalTokens = usage.TotalTokens,
            Cost = cost,
            IsFallbackServed = isFallbackServed,
            CourseId = courseId,
            TutorId = tutorId,
        });

        // AD-11: the service commits once, after every repository call for this use-case has staged its change.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Recorded AI Task usage for '{TaskId}': {PromptTokens}+{CompletionTokens} tokens, cost {Cost}, fallback={IsFallbackServed}.",
            taskId, usage.PromptTokens, usage.CompletionTokens, cost, isFallbackServed);

        return cost;
    }

    public async Task<IReadOnlyList<AiUsageEntryDto>> GetUsageAsync(string range, CancellationToken cancellationToken = default)
    {
        if (!KnownRanges.Contains(range))
        {
            throw new ValidationException($"'{range}' is not a known usage date range.");
        }

        DateTimeOffset? cutoffUtc = range switch
        {
            "last7" => DateTimeOffset.UtcNow.AddDays(-7),
            "last30" => DateTimeOffset.UtcNow.AddDays(-30),
            _ => null,
        };

        var entries = await repository.GetSinceAsync(cutoffUtc, cancellationToken);

        return entries
            .Select(u => new AiUsageEntryDto(u.TaskId, DateOnly.FromDateTime(u.CreatedAt.UtcDateTime), u.Cost, u.IsFallbackServed))
            .ToList();
    }
}

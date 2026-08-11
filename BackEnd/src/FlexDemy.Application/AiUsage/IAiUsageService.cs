using FlexDemy.Application.AiGateway;

namespace FlexDemy.Application.AiUsage;

public interface IAiUsageService
{
    // Called once per successful AI Task invocation (never for a failed one -- there is no
    // AiGatewayUsage to record). courseId/tutorId are "where applicable" (FR-4) -- pass null when
    // the caller has no such context. Returns the real computed cost (Story 1.8: the caller,
    // AiTaskGateway, uses this to settle its pre-flight budget reservation).
    Task<decimal> RecordUsageAsync(
        string taskId, string provider, string model, AiGatewayUsage usage, bool isFallbackServed,
        string? courseId, string? tutorId, CancellationToken cancellationToken = default);

    // range is "last7" | "last30" | "all" -- throws ValidationException for anything else.
    Task<IReadOnlyList<AiUsageEntryDto>> GetUsageAsync(string range, CancellationToken cancellationToken = default);
}

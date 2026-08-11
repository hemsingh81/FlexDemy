namespace FlexDemy.Application.AiUsage;

// Field names/shape deliberately mirror FrontEnd's useAiUsage.ts AiUsageEntry interface exactly
// (taskId, date, cost, isFallbackServed). System.Text.Json serializes DateOnly as "yyyy-MM-dd" by
// default (.NET 8+) -- the same ISO date-only string shape the frontend already expects, so no
// frontend date-parsing/reformatting is needed.
public sealed record AiUsageEntryDto(string TaskId, DateOnly Date, decimal Cost, bool IsFallbackServed);

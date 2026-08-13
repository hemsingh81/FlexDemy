namespace FlexDemy.Application.AdaptiveLearning;

// Definition is null when generation failed (a best-effort, non-blocking call site -- the popover
// shows "Definition unavailable", never a blank/broken shell) or hasn't happened at all yet.
public sealed record KeywordDefinitionDto(string Keyword, string? Definition, bool IsOverridden);

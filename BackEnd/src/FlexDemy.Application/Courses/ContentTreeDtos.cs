namespace FlexDemy.Application.Courses;

// AD-10: DTOs only cross the service boundary, never Domain entities. Confirmation/Format are
// .ToString()'d PascalCase strings, matching CourseMapper.cs's own enum-serialization convention
// (there is no JsonStringEnumConverter/naming policy configured anywhere in FlexDemy.Api) --
// translating that to the frontend's lowercase union types is contentTreeService.ts/the hook's
// job (Task 10), not this DTO's.
public record ChapterDto(string Id, string Title, string Confirmation, int Order, IReadOnlyList<TopicDto> Topics);

public record TopicDto(string Id, string Title, string Confirmation, int Order, IReadOnlyList<SubtopicDto> Subtopics, IReadOnlyList<ContentBlockDto> ContentBlocks);

public record SubtopicDto(string Id, string Title, string Confirmation, int Order, IReadOnlyList<ContentBlockDto> ContentBlocks);

public record ContentBlockDto(string Id, string Format, string Confirmation, int Order, string? Text, string? Lang, string? Notation, string? ImageUrl, string? AltText);

// Tri-state patch: a field absent from the request body must not be treated as "clear it to
// null" -- TouchedFields carries which of the six property names the caller's JSON body actually
// included (built by ContentTreeController from the raw request body, since a plain nullable-field
// DTO alone can't distinguish "field omitted" from "field explicitly set to null"). Every field
// name in TouchedFields is expected lowercase-first (the camelCase wire name), matching
// ASP.NET Core's default Web JSON casing for request bodies.
public sealed record UpdateContentBlockRequest(
    string? Text,
    string? Lang,
    string? Notation,
    string? ImageUrl,
    string? AltText,
    string? Format,
    IReadOnlySet<string> TouchedFields
);

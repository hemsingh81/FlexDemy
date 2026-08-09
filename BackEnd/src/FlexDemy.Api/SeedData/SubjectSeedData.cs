namespace FlexDemy.Api.SeedData;

// Dev-only master-data seed (plan §2, Phase 0): subjects, grouped by stream where applicable
// (Science / Commerce / Humanities); null Stream means the subject applies across streams.
public static class SubjectSeedData
{
    public record SubjectSeed(string Name, string? Stream);

    public static readonly IReadOnlyList<SubjectSeed> Subjects =
    [
        new("Physics", "Science"),
        new("Chemistry", "Science"),
        new("Biology", "Science"),
        new("Mathematics", "Science"),
        new("Biotechnology", "Science"),
        new("Accountancy", "Commerce"),
        new("Business Studies", "Commerce"),
        new("Economics", "Commerce"),
        new("History", "Humanities"),
        new("Political Science", "Humanities"),
        new("Geography", "Humanities"),
        new("Sociology", "Humanities"),
        new("Psychology", "Humanities"),
        new("Philosophy", "Humanities"),
        new("English", null),
        new("Hindi", null),
        new("Regional Language", null),
        new("Computer Science", null),
        new("Physical Education", null),
    ];
}

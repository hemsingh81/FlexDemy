namespace FlexDemy.Api.SeedData;

// Dev-only master-data seed (plan §2, Phase 0): SortOrder controls display order
// Pre-Nursery -> PhD/Doctorate. Names match the grade tag strings already used by
// Course.Tags/TargetGradeTag (FrontEnd/src/features/Dashboard/Dashboard.tsx).
//
// SubjectNames carries each class level's applicable Subject *names* (not ids -- Subject rows
// don't have generated ids yet at seed-definition time; DatabaseSeeder.EnsureMasterDataAsync
// resolves these to the just-inserted Subject.Id values before building each ClassLevel).
// Mapping is CBSE-pattern researched, not invented:
//   - Pre-Nursery..UKG: no formal subjects yet -- left unmapped.
//   - Class 1st..10th: CBSE keeps Science/Social Science unified and unsplit through Class 10,
//     and those aren't in the 19-subject seed list below, so only the cross-grade subjects apply.
//   - Class 11th/12th: all 19 subjects are "available" at the class level; streams pick a subset
//     at enrollment time, not seedable at this granularity.
//   - Undergraduate/Postgraduate/PhD: programme-specific choice drives the rest, so only the two
//     subjects that apply regardless of programme are seeded here.
public static class ClassLevelSeedData
{
    public record ClassLevelSeed(string Name, int SortOrder, IReadOnlyList<string> SubjectNames);

    private static readonly string[] NoSubjects = [];

    private static readonly string[] CoreSchoolSubjects =
    [
        "Mathematics", "English", "Hindi", "Regional Language", "Computer Science", "Physical Education",
    ];

    // All 19 seeded subjects (SubjectSeedData.Subjects) -- Class 11th/12th streams pick a subset
    // at enrollment time, but every subject is "available" at the class level.
    private static readonly string[] AllSubjects = SubjectSeedData.Subjects.Select(s => s.Name).ToArray();

    private static readonly string[] HigherEducationSubjects = ["English", "Computer Science"];

    public static readonly IReadOnlyList<ClassLevelSeed> ClassLevels =
    [
        new("Pre-Nursery", 0, NoSubjects),
        new("Nursery", 1, NoSubjects),
        new("LKG", 2, NoSubjects),
        new("UKG", 3, NoSubjects),
        new("Class 1st", 4, CoreSchoolSubjects),
        new("Class 2nd", 5, CoreSchoolSubjects),
        new("Class 3rd", 6, CoreSchoolSubjects),
        new("Class 4th", 7, CoreSchoolSubjects),
        new("Class 5th", 8, CoreSchoolSubjects),
        new("Class 6th", 9, CoreSchoolSubjects),
        new("Class 7th", 10, CoreSchoolSubjects),
        new("Class 8th", 11, CoreSchoolSubjects),
        new("Class 9th", 12, CoreSchoolSubjects),
        new("Class 10th", 13, CoreSchoolSubjects),
        new("Class 11th", 14, AllSubjects),
        new("Class 12th", 15, AllSubjects),
        new("Undergraduate", 16, HigherEducationSubjects),
        new("Postgraduate", 17, HigherEducationSubjects),
        new("PhD / Doctorate", 18, HigherEducationSubjects),
    ];
}

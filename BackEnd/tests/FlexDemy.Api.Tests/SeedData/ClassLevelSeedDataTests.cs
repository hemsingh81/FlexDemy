using FlexDemy.Api.SeedData;

namespace FlexDemy.Api.Tests.SeedData;

// Static assertions of the researched CBSE-pattern Class-Subject mapping (Domain research
// already done, not re-derived here) -- no DB access, exercises ClassLevelSeedData directly.
public class ClassLevelSeedDataTests
{
    private static IReadOnlyList<string> SubjectNamesFor(string className) =>
        ClassLevelSeedData.ClassLevels.Single(c => c.Name == className).SubjectNames;

    [Theory]
    [InlineData("Pre-Nursery")]
    [InlineData("Nursery")]
    [InlineData("LKG")]
    [InlineData("UKG")]
    public void Pre_formal_class_levels_have_no_mapped_subjects(string className)
    {
        Assert.Empty(SubjectNamesFor(className));
    }

    [Theory]
    [InlineData("Class 1st")]
    [InlineData("Class 5th")]
    [InlineData("Class 10th")]
    public void Class_1st_through_10th_map_to_the_six_core_cross_grade_subjects(string className)
    {
        Assert.Equal(
            ["Mathematics", "English", "Hindi", "Regional Language", "Computer Science", "Physical Education"],
            SubjectNamesFor(className));
    }

    [Fact]
    public void Class_1st_through_10th_do_not_include_stream_specific_subjects()
    {
        // CBSE keeps Science/Social Science unified and unsplit through Class 10 -- Physics,
        // Chemistry, Biology, History, Geography, Political Science, Economics, Sociology,
        // Psychology, and Philosophy are Class 11-12 stream-specific only, so none of them
        // should appear anywhere in the Class 1st-10th mapping.
        string[] streamSpecificSubjects =
        [
            "Physics", "Chemistry", "Biology", "History", "Geography",
            "Political Science", "Economics", "Sociology", "Psychology", "Philosophy",
        ];
        string[] gradeSchoolClasses =
        [
            "Class 1st", "Class 2nd", "Class 3rd", "Class 4th", "Class 5th",
            "Class 6th", "Class 7th", "Class 8th", "Class 9th", "Class 10th",
        ];

        foreach (var className in gradeSchoolClasses)
        {
            var subjectNames = SubjectNamesFor(className);
            foreach (var streamSubject in streamSpecificSubjects)
                Assert.DoesNotContain(streamSubject, subjectNames);
        }
    }

    [Theory]
    [InlineData("Class 11th")]
    [InlineData("Class 12th")]
    public void Class_11th_and_12th_map_to_all_19_seeded_subjects(string className)
    {
        var subjectNames = SubjectNamesFor(className);

        Assert.Equal(19, subjectNames.Count);
        Assert.Equal(SubjectSeedData.Subjects.Select(s => s.Name), subjectNames);
    }

    [Theory]
    [InlineData("Undergraduate")]
    [InlineData("Postgraduate")]
    [InlineData("PhD / Doctorate")]
    public void Higher_education_levels_map_to_English_and_Computer_Science_only(string className)
    {
        Assert.Equal(["English", "Computer Science"], SubjectNamesFor(className));
    }

    [Fact]
    public void Every_class_level_appears_exactly_once_with_a_unique_SortOrder()
    {
        Assert.Equal(19, ClassLevelSeedData.ClassLevels.Count);
        Assert.Equal(ClassLevelSeedData.ClassLevels.Count, ClassLevelSeedData.ClassLevels.Select(c => c.Name).Distinct().Count());
        Assert.Equal(ClassLevelSeedData.ClassLevels.Count, ClassLevelSeedData.ClassLevels.Select(c => c.SortOrder).Distinct().Count());
    }

    [Fact]
    public void Every_referenced_subject_name_exists_in_SubjectSeedData()
    {
        // Guards against typos drifting the two seed tables apart -- DatabaseSeeder.EnsureMasterDataAsync
        // resolves these names against a dictionary built from SubjectSeedData.Subjects and would
        // throw KeyNotFoundException at startup if one didn't match.
        var validSubjectNames = SubjectSeedData.Subjects.Select(s => s.Name).ToHashSet();

        foreach (var classLevel in ClassLevelSeedData.ClassLevels)
        {
            foreach (var subjectName in classLevel.SubjectNames)
                Assert.Contains(subjectName, validSubjectNames);
        }
    }
}

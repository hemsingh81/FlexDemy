namespace FlexDemy.Api.SeedData;

// Dev-only seed values -- mirrors FrontEnd/src/features/Admin/TagManagement/TagManagement.tsx's
// INITIAL_TAGS exactly (Story 1.3), so an admin sees identical values on first real load.
// Trigonometry is seeded inactive -- the mock's one deliberately-inactive row.
public static class TagSeedData
{
    public record TagSeed(string Name, bool IsActive = true);

    public static readonly IReadOnlyList<TagSeed> Tags =
    [
        new("Algebra"),
        new("Photosynthesis"),
        new("World War II"),
        new("Grammar"),
        new("Trigonometry", IsActive: false),
        new("Cell Biology"),
        new("Geometry"),
    ];
}

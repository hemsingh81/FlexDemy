namespace FlexDemy.Api.SeedData;

// Dev-only master-data seed (plan §2, Phase 0): national exam boards, plus the naming rule
// Program.cs's EnsureMasterDataSeedAsync uses to derive a state board per India state (states
// only -- union territories don't get one; see IndiaLocationSeedData).
public static class BoardSeedData
{
    public record BoardSeed(string Name, string Code);

    public static readonly IReadOnlyList<BoardSeed> NationalBoards =
    [
        new("CBSE", "CBSE"),
        new("ICSE", "ICSE"),
        new("ISC", "ISC"),
        new("IB", "IB"),
        new("IGCSE", "IGCSE"),
        new("NIOS", "NIOS"),
    ];

    public static string StateBoardName(string stateName) => $"{stateName} State Board";

    public static string StateBoardCode(string stateCode) => $"{stateCode}SB";
}

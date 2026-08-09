namespace FlexDemy.Api.SeedData;

// Dev-only master-data seed (plan §2, Phase 0): India + its states/UTs + a handful of major
// cities. See Program.cs's EnsureMasterDataSeedAsync for the idempotent seed logic that
// consumes this data (skipped entirely once a Country row with IsoCode "IN" already exists).
public static class IndiaLocationSeedData
{
    public const string CountryName = "India";
    public const string CountryIsoCode = "IN";

    public record StateSeed(string Name, string Code, string[] Cities);

    // 28 states -- 12 of them (the most populous) get 2-5 major cities, the rest get one
    // capital city. Each of these 28 (not the UTs below) also gets a "<State> State Board"
    // (see BoardSeedData for the naming rule).
    public static readonly IReadOnlyList<StateSeed> States =
    [
        new("Andhra Pradesh", "AP", ["Amaravati"]),
        new("Arunachal Pradesh", "AR", ["Itanagar"]),
        new("Assam", "AS", ["Guwahati"]),
        new("Bihar", "BR", ["Patna"]),
        new("Chhattisgarh", "CG", ["Raipur"]),
        new("Goa", "GA", ["Panaji"]),
        new("Gujarat", "GJ", ["Ahmedabad", "Surat", "Vadodara", "Rajkot"]),
        new("Haryana", "HR", ["Gurugram", "Faridabad"]),
        new("Himachal Pradesh", "HP", ["Shimla"]),
        new("Jharkhand", "JH", ["Ranchi"]),
        new("Karnataka", "KA", ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi"]),
        new("Kerala", "KL", ["Kochi", "Thiruvananthapuram", "Kozhikode"]),
        new("Madhya Pradesh", "MP", ["Bhopal"]),
        new("Maharashtra", "MH", ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane"]),
        new("Manipur", "MN", ["Imphal"]),
        new("Meghalaya", "ML", ["Shillong"]),
        new("Mizoram", "MZ", ["Aizawl"]),
        new("Nagaland", "NL", ["Kohima"]),
        new("Odisha", "OD", ["Bhubaneswar"]),
        new("Punjab", "PB", ["Chandigarh", "Ludhiana", "Amritsar"]),
        new("Rajasthan", "RJ", ["Jaipur", "Jodhpur", "Udaipur"]),
        new("Sikkim", "SK", ["Gangtok"]),
        new("Tamil Nadu", "TN", ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli"]),
        new("Telangana", "TS", ["Hyderabad", "Warangal"]),
        new("Tripura", "TR", ["Agartala"]),
        new("Uttar Pradesh", "UP", ["Lucknow", "Kanpur", "Noida", "Varanasi", "Agra"]),
        new("Uttarakhand", "UK", ["Dehradun"]),
        new("West Bengal", "WB", ["Kolkata", "Howrah", "Siliguri"]),
    ];

    // 8 union territories -- one city each, no state board (state boards are only for the
    // 28 states above).
    public static readonly IReadOnlyList<StateSeed> UnionTerritories =
    [
        new("Andaman and Nicobar Islands", "AN", ["Port Blair"]),
        new("Chandigarh", "CH", ["Chandigarh"]),
        new("Dadra and Nagar Haveli and Daman and Diu", "DH", ["Daman"]),
        new("Delhi (NCT)", "DL", ["New Delhi"]),
        new("Jammu and Kashmir", "JK", ["Srinagar"]),
        new("Ladakh", "LA", ["Leh"]),
        new("Lakshadweep", "LD", ["Kavaratti"]),
        new("Puducherry", "PY", ["Puducherry"]),
    ];
}

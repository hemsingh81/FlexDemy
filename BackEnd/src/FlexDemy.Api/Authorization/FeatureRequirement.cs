using Microsoft.AspNetCore.Authorization;

namespace FlexDemy.Api.Authorization;

// Backs the dynamic, database-driven authorization policies FeaturePolicyProvider builds on the
// fly for any policy name matching a FeatureKeys constant (plan §3).
public record FeatureRequirement(string FeatureKey) : IAuthorizationRequirement;

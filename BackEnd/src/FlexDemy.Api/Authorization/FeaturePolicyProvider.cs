using FlexDemy.Application.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace FlexDemy.Api.Authorization;

// Dynamic IAuthorizationPolicyProvider (plan §3): for any policy name matching a FeatureKeys
// constant, builds a FeatureRequirement-backed policy on the fly, so a new feature key never
// needs a hand-registered AddPolicy() call in Program.cs. Every other policy name (attribute
// routing policies, anything registered normally, [Authorize(Roles = "...")], etc.) falls
// through to a wrapped DefaultAuthorizationPolicyProvider -- the standard "decorate the default
// provider" idiom for a partially-dynamic policy set.
public class FeaturePolicyProvider : IAuthorizationPolicyProvider
{
    private static readonly HashSet<string> KnownFeatureKeys = new(FeatureKeys.AllKeys, StringComparer.Ordinal);

    private readonly DefaultAuthorizationPolicyProvider fallbackPolicyProvider;

    public FeaturePolicyProvider(IOptions<AuthorizationOptions> options)
    {
        fallbackPolicyProvider = new DefaultAuthorizationPolicyProvider(options);
    }

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (KnownFeatureKeys.Contains(policyName))
        {
            var policy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .AddRequirements(new FeatureRequirement(policyName))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }

        return fallbackPolicyProvider.GetPolicyAsync(policyName);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() => fallbackPolicyProvider.GetDefaultPolicyAsync();

    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() => fallbackPolicyProvider.GetFallbackPolicyAsync();
}

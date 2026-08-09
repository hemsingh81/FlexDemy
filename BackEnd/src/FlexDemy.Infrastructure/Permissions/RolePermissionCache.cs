using FlexDemy.Application.Permissions;
using FlexDemy.Domain.Users;
using Microsoft.Extensions.Caching.Memory;

namespace FlexDemy.Infrastructure.Permissions;

// Backed by IMemoryCache (singleton). This class itself is registered Scoped (it depends on
// IRolePermissionRepository, which is Scoped because it needs the per-request DbContext), but
// the cached data lives in the singleton IMemoryCache instance underneath it, so cached values
// still survive across requests even though a fresh RolePermissionCache instance is created for
// each one -- there is no per-instance state here.
//
// Cache-invalidation strategy: one entry per role ("perm:{role}"), holding that role's full
// FeatureKey -> IsVisible dictionary loaded in a single query on first miss. UserRole is a small,
// fixed enum (7 values today), so Invalidate() doesn't need to track which keys were ever set --
// it just removes all possible "perm:{role}" keys outright. Simpler than swapping in a fresh
// MemoryCache instance behind a lock, and correct because the key space is closed and tiny.
public class RolePermissionCache(IMemoryCache cache, IRolePermissionRepository repository) : IRolePermissionCache
{
    private static string CacheKey(UserRole role) => $"perm:{role}";

    public async Task<bool> IsVisibleAsync(UserRole role, string featureKey, CancellationToken cancellationToken = default)
    {
        var map = await GetRoleMapAsync(role, cancellationToken);
        return map.TryGetValue(featureKey, out var isVisible) && isVisible;
    }

    public void Invalidate()
    {
        foreach (var role in Enum.GetValues<UserRole>())
            cache.Remove(CacheKey(role));
    }

    private async Task<IReadOnlyDictionary<string, bool>> GetRoleMapAsync(UserRole role, CancellationToken cancellationToken)
    {
        var key = CacheKey(role);
        if (cache.TryGetValue(key, out IReadOnlyDictionary<string, bool>? cached) && cached is not null)
            return cached;

        var rows = await repository.GetByRoleAsync(role, cancellationToken);
        var map = (IReadOnlyDictionary<string, bool>)rows.ToDictionary(r => r.FeatureKey, r => r.IsVisible, StringComparer.Ordinal);

        cache.Set(key, map);
        return map;
    }
}

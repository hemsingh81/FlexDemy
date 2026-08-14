using FlexDemy.Application.Common;

namespace FlexDemy.Infrastructure.Correlation;

// AD-23: registered Singleton in DependencyInjection.cs -- the backing AsyncLocal<string?> field
// must be a single shared instance app-wide (same pattern .NET's own IHttpContextAccessor uses
// internally). AsyncLocal correctly isolates its value per logical call context regardless of how
// many DI scopes resolve this Singleton, so one shared field is both correct and the
// zero-allocation-per-request choice.
public class AsyncLocalCorrelationIdAccessor : ICorrelationIdAccessor
{
    private static readonly AsyncLocal<string?> CorrelationId = new();

    public string? Current => CorrelationId.Value;

    public void Set(string? correlationId) => CorrelationId.Value = correlationId;
}

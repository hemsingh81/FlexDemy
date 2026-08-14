namespace FlexDemy.Application.Common;

// AD-23: the only sanctioned way to read/set the correlation ID anywhere in the codebase.
// Application/Domain must never reach for HttpContext.Items directly (would violate AD-1) --
// this interface is the seam. Infrastructure's AsyncLocal-backed implementation lets the value
// survive await boundaries within one request without being threaded as an explicit parameter
// through every intermediate call; the async (Hangfire job) path instead threads it explicitly
// as a method parameter and calls Set() as the job's first action (see the 4 job enqueuers/jobs).
public interface ICorrelationIdAccessor
{
    string? Current { get; }

    void Set(string? correlationId);
}

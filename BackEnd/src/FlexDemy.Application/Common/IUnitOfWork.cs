namespace FlexDemy.Application.Common;

// AD-11: only an Application service calls SaveChangesAsync, exactly once per use-case,
// after every repository call for that use-case has staged its change. Repositories
// stage changes only -- they never commit.
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);

    // Story 3.10 code-review patch: wraps every SaveChangesAsync call made inside `operation`
    // (including ones made by another Application service called from within it -- IUnitOfWork/
    // the underlying DbContext is Scoped, one instance per request, so they share the same
    // ambient transaction) in a single DB transaction. For the rare genuine multi-commit use-case
    // this codebase already has precedent for (PublishService.PublishAsync's zero-node finalize
    // path calling two other services' own SaveChangesAsync-triggering methods) -- this makes that
    // orchestration atomic instead of best-effort, so a failure partway through can't leave the
    // system in a materially inconsistent partial state (e.g. content replaced but the course's
    // own LifecycleState left stale). Not a replacement for the normal "exactly one
    // SaveChangesAsync per use-case" rule in the common case.
    Task ExecuteInTransactionAsync(Func<Task> operation, CancellationToken cancellationToken = default);
}

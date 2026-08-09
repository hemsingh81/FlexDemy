namespace FlexDemy.Application.Common;

// AD-11: only an Application service calls SaveChangesAsync, exactly once per use-case,
// after every repository call for that use-case has staged its change. Repositories
// stage changes only -- they never commit.
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

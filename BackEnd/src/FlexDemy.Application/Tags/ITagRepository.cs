using FlexDemy.Domain.Tags;

namespace FlexDemy.Application.Tags;

public interface ITagRepository
{
    // No includeInactive parameter -- Tag has exactly one consumer (the admin table), which
    // always wants every tag, active and inactive.
    Task<IReadOnlyList<Tag>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<Tag?> GetByIdAsync(string id, CancellationToken cancellationToken = default);

    // Case-insensitive exact match, across both active and inactive tags (only the global
    // IsDeleted query filter applies) -- for duplicate-checking (FR-26).
    Task<Tag?> GetByNameAsync(string name, CancellationToken cancellationToken = default);

    // AD-11: stages the change only -- IUnitOfWork.SaveChangesAsync (called by the service) commits it.
    void Add(Tag tag);

    void Update(Tag tag);
}

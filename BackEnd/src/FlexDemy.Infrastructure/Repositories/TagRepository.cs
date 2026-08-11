using FlexDemy.Application.Tags;
using FlexDemy.Domain.Tags;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class TagRepository(FlexDemyDbContext db) : ITagRepository
{
    public async Task<IReadOnlyList<Tag>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await db.Tags.AsNoTracking().ToListAsync(cancellationToken);

    public Task<Tag?> GetByIdAsync(string id, CancellationToken cancellationToken = default) =>
        db.Tags.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

    // A plain lower()-comparison, not EF.Functions.ILike -- this is an exact-match duplicate
    // check, not a search. ILike's `name` argument is a LIKE *pattern*, and an unescaped `%`/`_`
    // in a caller-supplied tag name would be treated as a wildcard (e.g. a genuinely distinct tag
    // named "Grade_9" would ILIKE-match an existing "Grade X9"), causing false-positive duplicate
    // rejections -- review finding, 2026-08-11. lower() has no such risk and, as a bonus, is a
    // plain LINQ translation the InMemory provider can execute too (unlike ILike).
    public Task<Tag?> GetByNameAsync(string name, CancellationToken cancellationToken = default) =>
        db.Tags.FirstOrDefaultAsync(t => t.Name.ToLower() == name.ToLower(), cancellationToken);

    public void Add(Tag tag) => db.Tags.Add(tag);

    public void Update(Tag tag) => db.Tags.Update(tag);
}

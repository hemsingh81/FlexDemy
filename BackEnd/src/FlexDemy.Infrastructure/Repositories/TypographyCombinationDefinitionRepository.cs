using FlexDemy.Application.Settings;
using FlexDemy.Domain.Settings;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class TypographyCombinationDefinitionRepository(FlexDemyDbContext db) : ITypographyCombinationDefinitionRepository
{
    public async Task<IReadOnlyList<TypographyCombinationDefinition>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await db.TypographyCombinationDefinitions.ToListAsync(cancellationToken);

    public async Task<TypographyCombinationDefinition?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default) =>
        await db.TypographyCombinationDefinitions.FirstOrDefaultAsync(t => t.Slug == slug, cancellationToken);
}

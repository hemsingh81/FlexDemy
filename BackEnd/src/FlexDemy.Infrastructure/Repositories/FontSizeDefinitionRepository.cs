using FlexDemy.Application.Settings;
using FlexDemy.Domain.Settings;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class FontSizeDefinitionRepository(FlexDemyDbContext db) : IFontSizeDefinitionRepository
{
    public async Task<IReadOnlyList<FontSizeDefinition>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await db.FontSizeDefinitions.ToListAsync(cancellationToken);

    public async Task<FontSizeDefinition?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default) =>
        await db.FontSizeDefinitions.FirstOrDefaultAsync(f => f.Slug == slug, cancellationToken);
}

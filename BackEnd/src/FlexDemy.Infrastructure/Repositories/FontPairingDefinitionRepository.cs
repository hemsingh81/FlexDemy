using FlexDemy.Application.Settings;
using FlexDemy.Domain.Settings;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class FontPairingDefinitionRepository(FlexDemyDbContext db) : IFontPairingDefinitionRepository
{
    public async Task<IReadOnlyList<FontPairingDefinition>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await db.FontPairingDefinitions.ToListAsync(cancellationToken);

    public async Task<FontPairingDefinition?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default) =>
        await db.FontPairingDefinitions.FirstOrDefaultAsync(f => f.Slug == slug, cancellationToken);
}

using FlexDemy.Domain.Settings;

namespace FlexDemy.Application.Settings;

public interface IFontPairingDefinitionRepository
{
    Task<IReadOnlyList<FontPairingDefinition>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<FontPairingDefinition?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default);
}

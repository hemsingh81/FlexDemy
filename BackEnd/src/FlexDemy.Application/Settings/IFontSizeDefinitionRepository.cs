using FlexDemy.Domain.Settings;

namespace FlexDemy.Application.Settings;

public interface IFontSizeDefinitionRepository
{
    Task<IReadOnlyList<FontSizeDefinition>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<FontSizeDefinition?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default);
}

using FlexDemy.Domain.Settings;

namespace FlexDemy.Application.Settings;

public interface ITypographyCombinationDefinitionRepository
{
    Task<IReadOnlyList<TypographyCombinationDefinition>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<TypographyCombinationDefinition?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default);
}

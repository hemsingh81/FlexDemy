using FlexDemy.Domain.AdaptiveLearning;

namespace FlexDemy.Application.AdaptiveLearning;

public interface IKeywordDefinitionRepository
{
    Task<KeywordDefinition?> GetAsync(string courseId, string normalizedKeyword, CancellationToken cancellationToken = default);

    // Staging only -- IUnitOfWork.SaveChangesAsync (called by the service) commits (AD-11).
    void Add(KeywordDefinition definition);
}

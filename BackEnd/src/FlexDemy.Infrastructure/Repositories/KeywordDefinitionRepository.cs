using FlexDemy.Application.AdaptiveLearning;
using FlexDemy.Domain.AdaptiveLearning;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Infrastructure.Repositories;

public class KeywordDefinitionRepository(FlexDemyDbContext db) : IKeywordDefinitionRepository
{
    public Task<KeywordDefinition?> GetAsync(string courseId, string normalizedKeyword, CancellationToken cancellationToken = default) =>
        db.KeywordDefinitions.FirstOrDefaultAsync(k => k.CourseId == courseId && k.NormalizedKeyword == normalizedKeyword, cancellationToken);

    public void Add(KeywordDefinition definition) => db.KeywordDefinitions.Add(definition);
}

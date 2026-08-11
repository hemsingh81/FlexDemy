using FlexDemy.Application.Common;

namespace FlexDemy.Application.Tags;

public class TagService(ITagRepository repository, IUnitOfWork unitOfWork, IIdGenerator idGenerator) : ITagService
{
    public async Task<IReadOnlyList<TagDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var tags = await repository.GetAllAsync(cancellationToken);
        return tags.Select(t => t.ToDto()).ToList();
    }

    public async Task<TagDto> CreateAsync(CreateTagRequest request, CancellationToken cancellationToken = default)
    {
        RequireNonEmpty(request.Name);
        // Trimmed once, used consistently for both the duplicate check and the stored value --
        // untrimmed input let "Algebra " and "Algebra" coexist as visually-identical
        // "duplicates," defeating FR-26's own purpose (review finding, 2026-08-11).
        var trimmedRequest = request with { Name = request.Name.Trim() };

        // FR-26: rejects a name matching an existing tag case-insensitively, whether that
        // existing tag is active or deactivated -- GetByNameAsync has no IsActive filter.
        if (await repository.GetByNameAsync(trimmedRequest.Name, cancellationToken) is not null)
        {
            throw new ConflictException($"A tag named '{trimmedRequest.Name}' already exists.");
        }

        var tag = trimmedRequest.ToEntity(idGenerator.NewId());
        repository.Add(tag);
        // AD-11: the service commits once, after every repository call for this use-case has staged its change.
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return tag.ToDto();
    }

    public async Task<TagDto> UpdateAsync(string id, UpdateTagRequest request, CancellationToken cancellationToken = default)
    {
        RequireNonEmpty(request.Name);
        var trimmedRequest = request with { Name = request.Name.Trim() };

        var tag = await repository.GetByIdAsync(id, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Tags.Tag), id);

        // Exclude the tag's own row -- saving with its own unchanged name (e.g. just toggling
        // IsActive) must not trip the duplicate check against itself.
        var existingWithName = await repository.GetByNameAsync(trimmedRequest.Name, cancellationToken);
        if (existingWithName is not null && existingWithName.Id != id)
        {
            throw new ConflictException($"A tag named '{trimmedRequest.Name}' already exists.");
        }

        tag.ApplyUpdate(trimmedRequest);
        repository.Update(tag);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return tag.ToDto();
    }

    private static void RequireNonEmpty(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ValidationException("Name is required.");
        }
    }
}

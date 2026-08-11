namespace FlexDemy.Application.Tags;

public interface ITagService
{
    Task<IReadOnlyList<TagDto>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<TagDto> CreateAsync(CreateTagRequest request, CancellationToken cancellationToken = default);

    Task<TagDto> UpdateAsync(string id, UpdateTagRequest request, CancellationToken cancellationToken = default);
}

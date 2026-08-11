using FlexDemy.Domain.Tags;

namespace FlexDemy.Application.Tags;

// AD-10: mapping lives beside the service that owns it, as a static class -- no AutoMapper.
public static class TagMapper
{
    public static TagDto ToDto(this Tag tag) => new(tag.Id, tag.Name, tag.IsActive);

    // CreatedAt/CreatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges, not here.
    public static Tag ToEntity(this CreateTagRequest request, string id) => new()
    {
        Id = id,
        Name = request.Name,
    };

    public static void ApplyUpdate(this Tag tag, UpdateTagRequest request)
    {
        tag.Name = request.Name;
        tag.IsActive = request.IsActive;
    }
}

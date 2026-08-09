namespace FlexDemy.Application.MasterData.ClassLevel;

// AD-10: mapping lives beside the service that owns it, as a static class -- no AutoMapper
// (went commercial alongside MediatR; see AD-3).
public static class ClassLevelMapper
{
    public static ClassLevelDto ToDto(this FlexDemy.Domain.MasterData.ClassLevel classLevel) => new(
        classLevel.Id,
        classLevel.Name,
        classLevel.SortOrder,
        classLevel.IsActive,
        classLevel.SubjectIds
    );

    // CreatedAt/CreatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges, not here.
    public static FlexDemy.Domain.MasterData.ClassLevel ToEntity(this CreateClassLevelRequest request, string id) => new()
    {
        Id = id,
        Name = request.Name,
        SortOrder = request.SortOrder,
        SubjectIds = request.SubjectIds?.ToList() ?? [],
    };

    public static void ApplyUpdate(this FlexDemy.Domain.MasterData.ClassLevel classLevel, UpdateClassLevelRequest request)
    {
        classLevel.Name = request.Name;
        classLevel.SortOrder = request.SortOrder;
        classLevel.IsActive = request.IsActive;
        classLevel.SubjectIds = request.SubjectIds?.ToList() ?? [];
    }
}

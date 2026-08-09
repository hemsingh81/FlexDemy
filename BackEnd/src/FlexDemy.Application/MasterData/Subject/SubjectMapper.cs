namespace FlexDemy.Application.MasterData.Subject;

// AD-10: mapping lives beside the service that owns it, as a static class -- no AutoMapper
// (went commercial alongside MediatR; see AD-3).
public static class SubjectMapper
{
    public static SubjectDto ToDto(this FlexDemy.Domain.MasterData.Subject subject) => new(
        subject.Id,
        subject.Name,
        subject.Stream,
        subject.IsActive
    );

    // CreatedAt/CreatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges, not here.
    public static FlexDemy.Domain.MasterData.Subject ToEntity(this CreateSubjectRequest request, string id) => new()
    {
        Id = id,
        Name = request.Name,
        Stream = request.Stream,
    };

    public static void ApplyUpdate(this FlexDemy.Domain.MasterData.Subject subject, UpdateSubjectRequest request)
    {
        subject.Name = request.Name;
        subject.Stream = request.Stream;
        subject.IsActive = request.IsActive;
    }
}

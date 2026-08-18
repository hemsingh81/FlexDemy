using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

public static class ResourceMapper
{
    public static ResourceDto ToDto(this Resource resource) =>
        new(resource.Id, resource.Label, resource.Caption, resource.Role.ToString(), resource.Order, resource.Status.ToString(), resource.FailureReason, resource.FileName, resource.ContentType, resource.SizeBytes);
}

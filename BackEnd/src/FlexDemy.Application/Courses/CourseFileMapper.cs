using FlexDemy.Domain.Courses;

namespace FlexDemy.Application.Courses;

public static class CourseFileMapper
{
    public static CourseFileDto ToDto(this CourseFile file, bool hasAttachedResources = false) =>
        new(file.Id, file.FileName, file.ContentType, file.SizeBytes, file.Status.ToString(), file.FailureReason, file.ParsedContent, hasAttachedResources);
}

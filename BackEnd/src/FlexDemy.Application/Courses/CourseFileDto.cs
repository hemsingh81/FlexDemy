namespace FlexDemy.Application.Courses;

// Status as a string (.ToString() on the enum), matching CourseDto.LifecycleState's existing
// string-serialization convention. No StoredUrl -- course-content source files aren't meant to
// be directly link-shared (unlike thumbnails), a deliberate, scoped omission. ParsedContent is
// the raw text Docling parsing produced -- null until Status == Done, and the entire "content"
// shown to a tutor/student now that the AI structure-extraction step is gone.
// Story 10.2, FR-23: HasAttachedResources -- true when at least one Resource was attached from
// this file via "Attach existing file" (Resource.CourseFileId). Backs the tutor's delete-file
// confirmation copy (accurate warning vs. the plain "and its content" message) -- always false
// on a freshly-uploaded file and on the published/student-facing read path, where it's irrelevant.
public record CourseFileDto(string Id, string FileName, string ContentType, long SizeBytes, string Status, string? FailureReason, string? ParsedContent, bool HasAttachedResources = false);

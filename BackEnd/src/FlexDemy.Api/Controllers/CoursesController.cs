using FlexDemy.Application.Courses;
using FlexDemy.Application.Permissions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FlexDemy.Api.Controllers;

// AD-5: thin controller -- HTTP <-> DTO mapping and one Application service call, nothing else.
[ApiController]
[Route("api/v1/courses")]
public class CoursesController(ICourseService courseService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CourseDto>>> GetCourses(
        [FromQuery] string? gradeTag,
        [FromQuery] string? search,
        [FromQuery] string? subject,
        CancellationToken cancellationToken)
    {
        var courses = await courseService.GetCoursesAsync(gradeTag, search, subject, cancellationToken);
        return Ok(courses);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<CourseDto>> GetCourseById(string id, CancellationToken cancellationToken)
    {
        var course = await courseService.GetCourseByIdAsync(id, cancellationToken);
        return Ok(course);
    }

    // Policy-based auth (plan §3, Phase 4 proof point): backed by the FeatureKeys.CoursesCreate
    // row in the role-permission matrix (default: Master, Tutor), enforced dynamically by
    // FeatureAuthorizationHandler rather than a hardcoded Roles list.
    [HttpPost]
    [Authorize(Policy = FeatureKeys.CoursesCreate)]
    public async Task<ActionResult<CourseDto>> CreateCourse(CreateCourseRequest request, CancellationToken cancellationToken)
    {
        var course = await courseService.CreateCourseAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetCourseById), new { id = course.Id }, course);
    }
}

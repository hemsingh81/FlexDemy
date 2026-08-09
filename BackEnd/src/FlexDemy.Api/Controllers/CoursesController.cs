using FlexDemy.Application.Courses;
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

    [HttpPost]
    public async Task<ActionResult<CourseDto>> CreateCourse(CreateCourseRequest request, CancellationToken cancellationToken)
    {
        var course = await courseService.CreateCourseAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetCourseById), new { id = course.Id }, course);
    }
}

using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;

namespace FlexDemy.Application.Tests.ErrorObservability;

public class ErrorRecordMapperTests
{
    private static ErrorRecord MakeRecord(string message = "boom") => new()
    {
        Id = "err_1",
        Fingerprint = "fp_1",
        Source = ErrorSource.Backend,
        Category = ErrorCategory.ExternalIntegrationError,
        Priority = ErrorPriority.P1,
        Status = ErrorStatus.New,
        Message = message,
        ExceptionType = "TimeoutException",
        StackTrace = "at Foo.Bar()",
        OriginContext = "ScanFileJob",
        RelatedEntityType = "CourseFile",
        RelatedEntityId = "file_1",
        UserId = "user_1",
        RequestPath = "/api/v1/courses/course_1/files",
        CorrelationId = "corr_1",
        OccurrenceCount = 3,
        FirstOccurredAt = new DateTimeOffset(2026, 8, 1, 0, 0, 0, TimeSpan.Zero),
        LastOccurredAt = new DateTimeOffset(2026, 8, 14, 0, 0, 0, TimeSpan.Zero),
    };

    [Fact]
    public void ToSummaryDto_maps_every_AC2_field()
    {
        var record = MakeRecord();

        var dto = record.ToSummaryDto();

        Assert.Equal("err_1", dto.Id);
        Assert.Equal(ErrorCategory.ExternalIntegrationError, dto.Category);
        Assert.Equal(ErrorPriority.P1, dto.Priority);
        Assert.Equal(ErrorStatus.New, dto.Status);
        Assert.Equal("boom", dto.Message);
        Assert.Equal(ErrorSource.Backend, dto.Source);
        Assert.Equal(3, dto.OccurrenceCount);
        Assert.Equal(record.LastOccurredAt, dto.LastOccurredAt);
    }

    [Fact]
    public void ToSummaryDto_truncates_a_long_Message_to_200_characters_plus_an_ellipsis()
    {
        var record = MakeRecord(message: new string('a', 250));

        var dto = record.ToSummaryDto();

        Assert.Equal(203, dto.Message.Length); // 200 chars + "..."
        Assert.StartsWith(new string('a', 200), dto.Message);
        Assert.EndsWith("...", dto.Message);
    }

    [Fact]
    public void ToSummaryDto_leaves_a_short_Message_untouched()
    {
        var record = MakeRecord(message: "short message");

        var dto = record.ToSummaryDto();

        Assert.Equal("short message", dto.Message);
    }

    [Fact]
    public void ToDetailDto_maps_every_AC4_field_including_the_full_untruncated_Message()
    {
        var record = MakeRecord(message: new string('a', 250));

        var dto = record.ToDetailDto();

        Assert.Equal("err_1", dto.Id);
        Assert.Equal(new string('a', 250), dto.Message); // untruncated, unlike ToSummaryDto
        Assert.Equal("at Foo.Bar()", dto.StackTrace);
        Assert.Equal("/api/v1/courses/course_1/files", dto.RequestPath);
        Assert.Equal("ScanFileJob", dto.OriginContext);
        Assert.Equal(record.FirstOccurredAt, dto.FirstOccurredAt);
        Assert.Equal("CourseFile", dto.RelatedEntityType);
        Assert.Equal("file_1", dto.RelatedEntityId);
        Assert.Equal("corr_1", dto.CorrelationId);
        Assert.Equal("TimeoutException", dto.ExceptionType);
    }
}

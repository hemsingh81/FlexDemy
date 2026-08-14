using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using Xunit;

namespace FlexDemy.Application.Tests.ErrorObservability;

public class ErrorPriorityAssignerTests
{
    private static ErrorCaptureRequest MakeRequest(
        ErrorSource source = ErrorSource.Backend,
        string? requestPath = null,
        bool isBackgroundJobFailure = false) => new()
    {
        Message = "something failed",
        Source = source,
        RequestPath = requestPath,
        IsBackgroundJobFailure = isBackgroundJobFailure,
    };

    // -- Phase A: 4 branches, top-down, first match wins ------------------------------------------

    [Fact]
    public void Critical_path_request_is_P0()
    {
        var priority = ErrorPriorityAssigner.AssignInitial(
            MakeRequest(requestPath: "/api/v1/auth/login"), ErrorCategory.ValidationError);

        Assert.Equal(ErrorPriority.P0, priority);
    }

    [Fact]
    public void Course_publish_request_is_P0()
    {
        var priority = ErrorPriorityAssigner.AssignInitial(
            MakeRequest(requestPath: "/api/v1/courses/course_1/publish"), ErrorCategory.SystemInfrastructureError);

        Assert.Equal(ErrorPriority.P0, priority);
    }

    [Fact]
    public void DataIntegrityError_is_P0_unconditionally()
    {
        var priority = ErrorPriorityAssigner.AssignInitial(MakeRequest(), ErrorCategory.DataIntegrityError);

        Assert.Equal(ErrorPriority.P0, priority);
    }

    [Fact]
    public void Critical_path_AND_DataIntegrityError_together_still_resolves_P0()
    {
        // Either rule alone would produce P0 -- this test doesn't need to disambiguate which fired.
        var priority = ErrorPriorityAssigner.AssignInitial(
            MakeRequest(requestPath: "/api/v1/auth/login"), ErrorCategory.DataIntegrityError);

        Assert.Equal(ErrorPriority.P0, priority);
    }

    [Fact]
    public void A_user_facing_backend_request_that_is_not_a_background_job_failure_is_P1()
    {
        var priority = ErrorPriorityAssigner.AssignInitial(
            MakeRequest(requestPath: "/api/v1/courses/course_1"), ErrorCategory.SystemInfrastructureError);

        Assert.Equal(ErrorPriority.P1, priority);
    }

    [Fact]
    public void A_background_job_terminal_failure_is_P1_even_though_its_own_category_is_not_DataIntegrity()
    {
        var priority = ErrorPriorityAssigner.AssignInitial(
            MakeRequest(isBackgroundJobFailure: true), ErrorCategory.ExternalIntegrationError);

        Assert.Equal(ErrorPriority.P1, priority);
    }

    [Fact]
    public void ValidationError_category_is_P3()
    {
        var priority = ErrorPriorityAssigner.AssignInitial(
            MakeRequest(source: ErrorSource.Frontend), ErrorCategory.ValidationError);

        Assert.Equal(ErrorPriority.P3, priority);
    }

    [Fact]
    public void FrontendRuntimeError_category_is_P3()
    {
        var priority = ErrorPriorityAssigner.AssignInitial(
            MakeRequest(source: ErrorSource.Frontend), ErrorCategory.FrontendRuntimeError);

        Assert.Equal(ErrorPriority.P3, priority);
    }

    [Fact]
    public void Everything_else_falls_back_to_P2()
    {
        // A frontend-sourced request whose category isn't Validation/FrontendRuntime (an
        // unrealistic combination in practice, but exercises the literal fallback branch) --
        // Source=Frontend fails clause 2's Backend check, category fails clause 3's checks.
        var priority = ErrorPriorityAssigner.AssignInitial(
            MakeRequest(source: ErrorSource.Frontend), ErrorCategory.SystemInfrastructureError);

        Assert.Equal(ErrorPriority.P2, priority);
    }

    // -- Phase B: never fires on first occurrence, never decreases Priority -----------------------

    [Fact]
    public void Phase_B_never_fires_on_a_first_occurrence_no_historical_interval_exists_yet()
    {
        var now = DateTimeOffset.UtcNow;
        var record = new ErrorRecord
        {
            Id = "err_1",
            Fingerprint = "fp",
            Message = "x",
            Priority = ErrorPriority.P2,
            OccurrenceCount = 1,
            FirstOccurredAt = now.AddMinutes(-30),
            LastOccurredAt = now.AddMinutes(-30),
        };

        var priority = ErrorPriorityAssigner.Escalate(record, now);

        Assert.Equal(ErrorPriority.P2, priority);
    }

    [Fact]
    public void Phase_B_never_decreases_Priority_P0_and_P1_are_left_unchanged_even_under_a_spike()
    {
        var now = DateTimeOffset.UtcNow;
        var record = new ErrorRecord
        {
            Id = "err_1",
            Fingerprint = "fp",
            Message = "x",
            Priority = ErrorPriority.P0,
            OccurrenceCount = 10,
            FirstOccurredAt = now.AddHours(-10),
            LastOccurredAt = now.AddSeconds(-1), // rapid repeat -- would spike if eligible
        };

        var priority = ErrorPriorityAssigner.Escalate(record, now);

        Assert.Equal(ErrorPriority.P0, priority);
    }

    [Fact]
    public void Phase_B_escalates_P2_to_P1_when_recurring_far_faster_than_its_own_historical_average()
    {
        var now = DateTimeOffset.UtcNow;
        // Historical average interval: 10 occurrences spread evenly over 9 hours -> 1 hour/occurrence.
        var record = new ErrorRecord
        {
            Id = "err_1",
            Fingerprint = "fp",
            Message = "x",
            Priority = ErrorPriority.P2,
            OccurrenceCount = 10,
            FirstOccurredAt = now.AddHours(-9),
            LastOccurredAt = now.AddMinutes(-1), // this occurrence is 1 minute after the last -- far faster than 1h/occurrence
        };

        var priority = ErrorPriorityAssigner.Escalate(record, now);

        Assert.Equal(ErrorPriority.P1, priority);
    }

    [Fact]
    public void Phase_B_does_not_escalate_when_the_current_interval_is_close_to_the_historical_average()
    {
        var now = DateTimeOffset.UtcNow;
        var record = new ErrorRecord
        {
            Id = "err_1",
            Fingerprint = "fp",
            Message = "x",
            Priority = ErrorPriority.P3,
            OccurrenceCount = 10,
            FirstOccurredAt = now.AddHours(-9),
            LastOccurredAt = now.AddHours(-1), // consistent with the ~1h/occurrence historical pace
        };

        var priority = ErrorPriorityAssigner.Escalate(record, now);

        Assert.Equal(ErrorPriority.P3, priority);
    }

    // -- Story 4.6/FR-17: manual Increase Priority, exactly one step toward P0 ---------------------

    [Theory]
    [InlineData(ErrorPriority.P3, ErrorPriority.P2)]
    [InlineData(ErrorPriority.P2, ErrorPriority.P1)]
    [InlineData(ErrorPriority.P1, ErrorPriority.P0)]
    public void IncreaseOneStep_moves_exactly_one_step_toward_P0(ErrorPriority current, ErrorPriority expected)
    {
        Assert.Equal(expected, ErrorPriorityAssigner.IncreaseOneStep(current));
    }

    [Fact]
    public void IncreaseOneStep_throws_when_already_at_P0()
    {
        Assert.Throws<InvalidOperationException>(() => ErrorPriorityAssigner.IncreaseOneStep(ErrorPriority.P0));
    }
}

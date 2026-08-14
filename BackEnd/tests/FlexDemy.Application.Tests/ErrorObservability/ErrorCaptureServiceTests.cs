using FlexDemy.Application.Common;
using FlexDemy.Application.ErrorObservability;
using FlexDemy.Domain.ErrorObservability;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using Xunit;

namespace FlexDemy.Application.Tests.ErrorObservability;

public class ErrorCaptureServiceTests
{
    private sealed record Sut(
        ErrorCaptureService Service,
        IErrorRecordRepository Repository,
        IUnitOfWork UnitOfWork,
        IIdGenerator IdGenerator,
        ICorrelationIdAccessor CorrelationIdAccessor);

    private static Sut MakeSut()
    {
        var repository = Substitute.For<IErrorRecordRepository>();
        var unitOfWork = Substitute.For<IUnitOfWork>();
        var idGenerator = Substitute.For<IIdGenerator>();
        var correlationIdAccessor = Substitute.For<ICorrelationIdAccessor>();
        var service = new ErrorCaptureService(repository, unitOfWork, idGenerator, correlationIdAccessor, NullLogger<ErrorCaptureService>.Instance);
        return new Sut(service, repository, unitOfWork, idGenerator, correlationIdAccessor);
    }

    private static ErrorCaptureRequest MakeRequest(
        string? exceptionType = "ValidationException",
        string message = "Invalid input",
        ErrorSource source = ErrorSource.Backend,
        string? originContext = null,
        bool isBackgroundJobFailure = false,
        IReadOnlyDictionary<string, string>? context = null,
        string? correlationIdOverride = null,
        string? requestPath = null) => new()
    {
        ExceptionType = exceptionType,
        Message = message,
        Source = source,
        OriginContext = originContext,
        IsBackgroundJobFailure = isBackgroundJobFailure,
        Context = context,
        CorrelationIdOverride = correlationIdOverride,
        RequestPath = requestPath,
    };

    // -- First occurrence (AC #1) ------------------------------------------------------------------

    [Fact]
    public async Task First_occurrence_creates_a_new_ErrorRecord_with_OccurrenceCount_1_and_correct_Category_Priority()
    {
        var sut = MakeSut();
        sut.IdGenerator.NewId().Returns("err_1");
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);
        ErrorRecord? added = null;
        sut.Repository.When(r => r.Add(Arg.Any<ErrorRecord>())).Do(call => added = call.Arg<ErrorRecord>());

        await sut.Service.CaptureAsync(MakeRequest(exceptionType: "ValidationException"));

        Assert.NotNull(added);
        Assert.Equal("err_1", added!.Id);
        Assert.Equal(1, added.OccurrenceCount);
        Assert.Equal(ErrorCategory.ValidationError, added.Category);
        Assert.Equal(ErrorPriority.P3, added.Priority);
        Assert.Equal(ErrorStatus.New, added.Status);
        Assert.Equal(added.FirstOccurredAt, added.LastOccurredAt);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // Code-review patch: a background job's own underlying exception being ValidationException
    // must still resolve P1 (FR-3's own guarantee), not P3 -- the priority-ordering fix's
    // end-to-end proof.
    [Fact]
    public async Task A_background_job_failure_whose_exception_is_ValidationException_still_resolves_P1_not_P3()
    {
        var sut = MakeSut();
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);
        ErrorRecord? added = null;
        sut.Repository.When(r => r.Add(Arg.Any<ErrorRecord>())).Do(call => added = call.Arg<ErrorRecord>());

        await sut.Service.CaptureAsync(MakeRequest(exceptionType: "ValidationException", isBackgroundJobFailure: true));

        Assert.Equal(ErrorPriority.P1, added!.Priority);
    }

    // Code-review patch: an over-length message must be truncated to fit the column cap, not
    // allowed to fail the DB write and silently drop the whole record.
    [Fact]
    public async Task An_over_length_message_is_truncated_to_the_2048_char_column_cap_before_persisting()
    {
        var sut = MakeSut();
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);
        ErrorRecord? added = null;
        sut.Repository.When(r => r.Add(Arg.Any<ErrorRecord>())).Do(call => added = call.Arg<ErrorRecord>());
        var overLongMessage = new string('a', 3000);

        await sut.Service.CaptureAsync(MakeRequest(message: overLongMessage));

        Assert.NotNull(added);
        Assert.True(added!.Message.Length <= 2048);
    }

    // Code-review patch: RequestPath is redacted the same as Message/StackTrace -- a secret in a
    // query string must not survive into the persisted row.
    [Fact]
    public async Task A_secret_shaped_pattern_in_RequestPath_is_redacted()
    {
        var sut = MakeSut();
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);
        ErrorRecord? added = null;
        sut.Repository.When(r => r.Add(Arg.Any<ErrorRecord>())).Do(call => added = call.Arg<ErrorRecord>());

        await sut.Service.CaptureAsync(MakeRequest(requestPath: "/api/v1/x?token=gsk_abc123XYZ"));

        Assert.NotNull(added);
        Assert.DoesNotContain("gsk_abc123XYZ", added!.RequestPath);
        Assert.Contains("[REDACTED]", added.RequestPath);
    }

    // -- Repeat occurrence on a New record (AC #2) ---------------------------------------------------

    [Fact]
    public async Task Repeat_occurrence_on_an_existing_New_record_increments_in_place_not_a_new_row()
    {
        var sut = MakeSut();
        var existing = new ErrorRecord
        {
            Id = "err_1",
            Fingerprint = "fp",
            Message = "old",
            Status = ErrorStatus.New,
            Priority = ErrorPriority.P2,
            OccurrenceCount = 1,
            FirstOccurredAt = DateTimeOffset.UtcNow.AddHours(-1),
            LastOccurredAt = DateTimeOffset.UtcNow.AddHours(-1),
        };
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(existing);

        await sut.Service.CaptureAsync(MakeRequest());

        sut.Repository.DidNotReceiveWithAnyArgs().Add(default!);
        Assert.Equal(2, existing.OccurrenceCount);
        Assert.Equal(ErrorStatus.New, existing.Status);
        await sut.UnitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // Code-review patch: proves the Phase B off-by-one fix end-to-end. A record with 2 prior
    // occurrences spread over 20 minutes (10 min/occurrence historical pace) recurring 30 seconds
    // after its last occurrence is a genuine >10x spike against the PRE-increment count (2, giving
    // a 20-minute span / 1 interval = 20 min historical average) -- the pre-fix bug would have
    // divided by the POST-increment count (3), understating the historical average and making this
    // exact scenario fail to escalate.
    [Fact]
    public async Task Repeat_occurrence_escalates_using_the_pre_increment_OccurrenceCount_not_the_post_increment_one()
    {
        var sut = MakeSut();
        var now = DateTimeOffset.UtcNow;
        var existing = new ErrorRecord
        {
            Id = "err_1",
            Fingerprint = "fp",
            Message = "old",
            Status = ErrorStatus.New,
            Priority = ErrorPriority.P3,
            OccurrenceCount = 2,
            FirstOccurredAt = now.AddMinutes(-20),
            LastOccurredAt = now.AddSeconds(-30),
        };
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(existing);

        await sut.Service.CaptureAsync(MakeRequest());

        Assert.Equal(ErrorPriority.P1, existing.Priority);
        Assert.Equal(3, existing.OccurrenceCount);
    }

    // -- Reopen on Resolved/Archived (AC #3) ---------------------------------------------------------

    [Theory]
    [InlineData(ErrorStatus.Resolved)]
    [InlineData(ErrorStatus.Archived)]
    public async Task Repeat_occurrence_on_a_dismissed_record_reopens_it_without_resetting_Priority(ErrorStatus dismissedStatus)
    {
        var sut = MakeSut();
        var existing = new ErrorRecord
        {
            Id = "err_1",
            Fingerprint = "fp",
            Message = "old",
            Status = dismissedStatus,
            Priority = ErrorPriority.P0, // previously manually increased -- must survive the reopen
            OccurrenceCount = 3,
            FirstOccurredAt = DateTimeOffset.UtcNow.AddDays(-1),
            LastOccurredAt = DateTimeOffset.UtcNow.AddHours(-2),
        };
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(existing);

        await sut.Service.CaptureAsync(MakeRequest());

        Assert.Equal(ErrorStatus.New, existing.Status);
        Assert.Equal(4, existing.OccurrenceCount);
        Assert.Equal(ErrorPriority.P0, existing.Priority);
    }

    // Code-review patch (AC #3 gap): the theory test above uses Priority = P0, which never
    // actually exercises the wasArchived gate -- Escalate() itself already leaves P0/P1
    // untouched (ErrorPriorityAssigner.Escalate's own early-return), so a Resolved reopen at P0
    // trivially "survives" regardless of any gating logic. This test uses P2 with
    // PriorityIncreasedAt set (a genuine prior manual increase) and a spike-shaped recurrence
    // that would otherwise escalate P2 -> P1, proving the manual increase is now respected on a
    // Resolved reopen, not just an Archived one.
    [Fact]
    public async Task Repeat_occurrence_on_a_Resolved_record_does_not_escalate_a_manually_increased_Priority_even_under_a_spike()
    {
        var sut = MakeSut();
        var now = DateTimeOffset.UtcNow;
        var existing = new ErrorRecord
        {
            Id = "err_1",
            Fingerprint = "fp",
            Message = "old",
            Status = ErrorStatus.Resolved,
            Priority = ErrorPriority.P2,
            PriorityIncreasedAt = now.AddHours(-1), // a prior manual increase
            OccurrenceCount = 10,
            FirstOccurredAt = now.AddHours(-9),
            LastOccurredAt = now.AddMinutes(-1), // spike-shaped: would escalate P2 -> P1 if not gated
        };
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(existing);

        await sut.Service.CaptureAsync(MakeRequest());

        Assert.Equal(ErrorStatus.New, existing.Status);
        Assert.Equal(ErrorPriority.P2, existing.Priority);
    }

    // The gate is specific to a genuine prior manual increase (PriorityIncreasedAt set) -- a
    // Resolved record that was never manually touched still gets Phase B's ordinary spike
    // escalation on reopen, preserving Story 4.2's original intent for the common case.
    [Fact]
    public async Task Repeat_occurrence_on_a_Resolved_record_still_escalates_normally_when_Priority_was_never_manually_increased()
    {
        var sut = MakeSut();
        var now = DateTimeOffset.UtcNow;
        var existing = new ErrorRecord
        {
            Id = "err_1",
            Fingerprint = "fp",
            Message = "old",
            Status = ErrorStatus.Resolved,
            Priority = ErrorPriority.P2,
            PriorityIncreasedAt = null, // never manually increased
            OccurrenceCount = 10,
            FirstOccurredAt = now.AddHours(-9),
            LastOccurredAt = now.AddMinutes(-1), // spike-shaped
        };
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(existing);

        await sut.Service.CaptureAsync(MakeRequest());

        Assert.Equal(ErrorStatus.New, existing.Status);
        Assert.Equal(ErrorPriority.P1, existing.Priority);
    }

    // -- Concurrency (code-review patch) --------------------------------------------------------------

    // Simulates two concurrent captures of the same brand-new Fingerprint: the first save throws
    // (standing in for the DB's unique-constraint violation), and by the time the recovery re-fetch
    // runs, the "other" request's row is already there -- this capture must fall back to updating
    // that row instead of losing its own occurrence's contribution.
    [Fact]
    public async Task A_save_failure_on_first_occurrence_recovers_by_falling_back_to_the_repeat_occurrence_path_when_a_race_winner_now_exists()
    {
        var sut = MakeSut();
        var raceWinner = new ErrorRecord
        {
            Id = "err_1",
            Fingerprint = "fp",
            Message = "old",
            Status = ErrorStatus.New,
            Priority = ErrorPriority.P2,
            OccurrenceCount = 1,
            FirstOccurredAt = DateTimeOffset.UtcNow,
            LastOccurredAt = DateTimeOffset.UtcNow,
        };
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((ErrorRecord?)null, raceWinner);
        sut.UnitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns<Task<int>>(_ => throw new InvalidOperationException("unique constraint violation"), _ => Task.FromResult(1));

        await sut.Service.CaptureAsync(MakeRequest());

        Assert.Equal(2, raceWinner.OccurrenceCount);
        await sut.Repository.Received(2).GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    // A save failure with no race winner (a genuinely different failure, not a uniqueness
    // collision) must still be swallowed by the outer NFR2 catch, not surfaced.
    [Fact]
    public async Task A_save_failure_on_first_occurrence_with_no_race_winner_is_still_swallowed()
    {
        var sut = MakeSut();
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);
        sut.UnitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns<Task<int>>(_ => throw new InvalidOperationException("DB unavailable"));

        var exception = await Record.ExceptionAsync(() => sut.Service.CaptureAsync(MakeRequest()));

        Assert.Null(exception);
    }

    // -- Redaction (AC #4) ----------------------------------------------------------------------------

    [Fact]
    public async Task A_context_value_under_a_deny_listed_key_is_redacted_out_of_the_persisted_Message()
    {
        var sut = MakeSut();
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);
        ErrorRecord? added = null;
        sut.Repository.When(r => r.Add(Arg.Any<ErrorRecord>())).Do(call => added = call.Arg<ErrorRecord>());
        var context = new Dictionary<string, string> { ["ApiKey"] = "super-secret-value-123" };

        await sut.Service.CaptureAsync(MakeRequest(message: "Call failed with key super-secret-value-123", context: context));

        Assert.NotNull(added);
        Assert.DoesNotContain("super-secret-value-123", added!.Message);
        Assert.Contains("[REDACTED]", added.Message);
    }

    // Code-review patch: a casing mismatch between the captured context value and its free-text
    // occurrence must still redact.
    [Fact]
    public async Task A_context_value_is_redacted_even_when_its_casing_differs_from_the_free_text_occurrence()
    {
        var sut = MakeSut();
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);
        ErrorRecord? added = null;
        sut.Repository.When(r => r.Add(Arg.Any<ErrorRecord>())).Do(call => added = call.Arg<ErrorRecord>());
        var context = new Dictionary<string, string> { ["ApiKey"] = "Super-Secret-Value-123" };

        await sut.Service.CaptureAsync(MakeRequest(message: "Call failed with key super-secret-value-123", context: context));

        Assert.DoesNotContain("super-secret-value-123", added!.Message);
        Assert.Contains("[REDACTED]", added.Message);
    }

    // Code-review patch: a deny-listed value shorter than the minimum redactable length is left
    // alone rather than blindly replacing every occurrence of a short/common substring.
    [Fact]
    public async Task A_short_deny_listed_context_value_is_not_redacted_to_avoid_mangling_unrelated_text()
    {
        var sut = MakeSut();
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);
        ErrorRecord? added = null;
        sut.Repository.When(r => r.Add(Arg.Any<ErrorRecord>())).Do(call => added = call.Arg<ErrorRecord>());
        var context = new Dictionary<string, string> { ["Password"] = "1" };

        await sut.Service.CaptureAsync(MakeRequest(message: "Error 100 occurred at line 15", context: context));

        Assert.Equal("Error 100 occurred at line 15", added!.Message);
    }

    [Fact]
    public async Task A_free_text_secret_shaped_pattern_in_the_Message_is_redacted()
    {
        var sut = MakeSut();
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);
        ErrorRecord? added = null;
        sut.Repository.When(r => r.Add(Arg.Any<ErrorRecord>())).Do(call => added = call.Arg<ErrorRecord>());

        await sut.Service.CaptureAsync(MakeRequest(message: "No API key configured: gsk_abc123XYZ"));

        Assert.NotNull(added);
        Assert.DoesNotContain("gsk_abc123XYZ", added!.Message);
        Assert.Contains("[REDACTED]", added.Message);
    }

    [Fact]
    public async Task A_connection_string_password_segment_in_the_Message_is_redacted()
    {
        var sut = MakeSut();
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);
        ErrorRecord? added = null;
        sut.Repository.When(r => r.Add(Arg.Any<ErrorRecord>())).Do(call => added = call.Arg<ErrorRecord>());

        await sut.Service.CaptureAsync(MakeRequest(message: "Connection failed: Host=db;Password=hunter2secret;Port=5432"));

        Assert.NotNull(added);
        Assert.DoesNotContain("hunter2secret", added!.Message);
        Assert.Contains("Password=[REDACTED]", added.Message);
    }

    // -- Never throws (AC #5) -------------------------------------------------------------------------

    [Fact]
    public async Task A_thrown_exception_from_SaveChangesAsync_is_swallowed_not_rethrown()
    {
        var sut = MakeSut();
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);
        sut.UnitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>()).Returns<Task<int>>(_ => throw new InvalidOperationException("DB write failed"));

        var exception = await Record.ExceptionAsync(() => sut.Service.CaptureAsync(MakeRequest()));

        Assert.Null(exception);
    }

    [Fact]
    public async Task A_thrown_exception_from_the_repository_lookup_is_also_swallowed()
    {
        var sut = MakeSut();
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns<Task<ErrorRecord?>>(_ => throw new InvalidOperationException("DB read failed"));

        var exception = await Record.ExceptionAsync(() => sut.Service.CaptureAsync(MakeRequest()));

        Assert.Null(exception);
    }

    // -- Correlation ID resolution (Story 4.1 readiness-review fix) -----------------------------------

    [Fact]
    public async Task CorrelationIdOverride_takes_precedence_over_the_accessors_Current_when_both_are_present()
    {
        var sut = MakeSut();
        sut.CorrelationIdAccessor.Current.Returns("ambient-id");
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);
        ErrorRecord? added = null;
        sut.Repository.When(r => r.Add(Arg.Any<ErrorRecord>())).Do(call => added = call.Arg<ErrorRecord>());

        await sut.Service.CaptureAsync(MakeRequest(correlationIdOverride: "override-id"));

        Assert.Equal("override-id", added!.CorrelationId);
    }

    [Fact]
    public async Task Ambient_accessor_Current_is_used_when_no_override_is_supplied()
    {
        var sut = MakeSut();
        sut.CorrelationIdAccessor.Current.Returns("ambient-id");
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns((ErrorRecord?)null);
        ErrorRecord? added = null;
        sut.Repository.When(r => r.Add(Arg.Any<ErrorRecord>())).Do(call => added = call.Arg<ErrorRecord>());

        await sut.Service.CaptureAsync(MakeRequest());

        Assert.Equal("ambient-id", added!.CorrelationId);
    }

    // Code-review patch: a repeat occurrence with no new Correlation ID available (no override, no
    // ambient value) must not wipe a previously-captured real one.
    [Fact]
    public async Task Repeat_occurrence_with_no_new_correlation_id_available_preserves_the_existing_real_one()
    {
        var sut = MakeSut();
        sut.CorrelationIdAccessor.Current.Returns((string?)null);
        var existing = new ErrorRecord
        {
            Id = "err_1",
            Fingerprint = "fp",
            Message = "old",
            Status = ErrorStatus.New,
            Priority = ErrorPriority.P2,
            CorrelationId = "previously-captured-real-id",
            OccurrenceCount = 1,
            FirstOccurredAt = DateTimeOffset.UtcNow.AddHours(-1),
            LastOccurredAt = DateTimeOffset.UtcNow.AddHours(-1),
        };
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(existing);

        await sut.Service.CaptureAsync(MakeRequest());

        Assert.Equal("previously-captured-real-id", existing.CorrelationId);
    }

    [Fact]
    public async Task Repeat_occurrence_with_a_new_correlation_id_overwrites_the_existing_one()
    {
        var sut = MakeSut();
        sut.CorrelationIdAccessor.Current.Returns("new-id");
        var existing = new ErrorRecord
        {
            Id = "err_1",
            Fingerprint = "fp",
            Message = "old",
            Status = ErrorStatus.New,
            Priority = ErrorPriority.P2,
            CorrelationId = "old-id",
            OccurrenceCount = 1,
            FirstOccurredAt = DateTimeOffset.UtcNow.AddHours(-1),
            LastOccurredAt = DateTimeOffset.UtcNow.AddHours(-1),
        };
        sut.Repository.GetByFingerprintAsync(Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(existing);

        await sut.Service.CaptureAsync(MakeRequest());

        Assert.Equal("new-id", existing.CorrelationId);
    }
}

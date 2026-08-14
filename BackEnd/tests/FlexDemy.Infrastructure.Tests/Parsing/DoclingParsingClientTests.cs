using System.Net;
using FlexDemy.Application.Common;
using FlexDemy.Infrastructure.Parsing;
using Microsoft.Extensions.Logging;
using NSubstitute;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Parsing;

// Story 2.7/Task 7 + code review: DoclingParsingClientTests.cs originally only covered the
// connection-refused path (matching ClamAvFileScannerTests.cs's scoped-down Story 2.6
// precedent). Code review flagged this as insufficient given this class is "the single riskiest,
// most assumption-laden piece of code in this story" -- a fake HttpMessageHandler exercises the
// actual response-handling logic (JSON mapping, status/confidence branches) without needing a
// real docling-serve instance, the same testability trick used for HttpClient-based clients
// generally.
public class DoclingParsingClientTests
{
    private sealed class FakeHandler(HttpStatusCode statusCode, string body) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(statusCode) { Content = new StringContent(body) });
    }

    private static DoclingParsingClient MakeSut(HttpStatusCode statusCode, string body)
    {
        var httpClient = new HttpClient(new FakeHandler(statusCode, body)) { BaseAddress = new Uri("http://docling.test") };
        return new DoclingParsingClient(httpClient, Substitute.For<ILogger<DoclingParsingClient>>());
    }

    private static MemoryStream MakeContent() => new([1, 2, 3]);

    [Fact]
    public async Task ParseAsync_wraps_an_unreachable_docling_service_in_DocumentParsingUnavailableException()
    {
        // Port 1 has no listener on localhost -- a real, fast connection-refused failure.
        using var httpClient = new HttpClient { BaseAddress = new Uri("http://127.0.0.1:1") };
        var sut = new DoclingParsingClient(httpClient, Substitute.For<ILogger<DoclingParsingClient>>());
        using var content = MakeContent();

        await Assert.ThrowsAsync<DocumentParsingUnavailableException>(() => sut.ParseAsync(content, "notes.pdf", "application/pdf"));
    }

    [Fact]
    public async Task ParseAsync_a_success_status_with_a_passing_confidence_grade_returns_the_parsed_content()
    {
        var sut = MakeSut(HttpStatusCode.OK, """{"document":{"md_content":"# Notes"},"status":"success","confidence":{"mean_grade":"GOOD","low_grade":"GOOD"}}""");
        using var content = MakeContent();

        var result = await sut.ParseAsync(content, "notes.pdf", "application/pdf");

        Assert.True(result.IsSuccessful);
        Assert.Equal("# Notes", result.ParsedContent);
        Assert.Null(result.FailureReason);
    }

    [Theory]
    [InlineData("partial_success")]
    [InlineData("skipped")]
    [InlineData("failure")]
    public async Task ParseAsync_a_non_success_status_fails_the_parse_regardless_of_confidence(string status)
    {
        var body = """{"document":{"md_content":"# Notes"},"status":"STATUS_PLACEHOLDER","confidence":{"low_grade":"EXCELLENT"}}""".Replace("STATUS_PLACEHOLDER", status);
        var sut = MakeSut(HttpStatusCode.OK, body);
        using var content = MakeContent();

        var result = await sut.ParseAsync(content, "notes.pdf", "application/pdf");

        Assert.False(result.IsSuccessful);
        Assert.Null(result.ParsedContent);
        Assert.Contains(status, result.FailureReason);
    }

    [Fact]
    public async Task ParseAsync_a_success_status_whose_low_grade_is_POOR_fails_the_parse_even_though_conversion_succeeded()
    {
        var sut = MakeSut(HttpStatusCode.OK, """{"document":{"md_content":"# Notes"},"status":"success","confidence":{"mean_grade":"GOOD","low_grade":"POOR"}}""");
        using var content = MakeContent();

        var result = await sut.ParseAsync(content, "notes.pdf", "application/pdf");

        Assert.False(result.IsSuccessful);
        Assert.Null(result.ParsedContent);
        Assert.Contains("confidence", result.FailureReason, StringComparison.OrdinalIgnoreCase);
    }

    // Correction (2026-08-13): an earlier code-review patch made this fail closed on a
    // missing/null confidence object, on the assumption its absence was anomalous for a "success"
    // response. Confirmed wrong via live testing against a real docling-serve v1.25.0 instance --
    // `confidence` is always null for every successful conversion that instance was asked to run,
    // so failing closed here made the whole parsing feature permanently non-functional (every
    // real parse would fail, unconditionally). A missing confidence object now passes through
    // (status=success + non-empty content is sufficient); a *present* confidence object with a
    // failing grade still fails closed -- see the POOR-grade test above.
    [Fact]
    public async Task ParseAsync_a_success_status_with_no_confidence_object_passes_through()
    {
        var sut = MakeSut(HttpStatusCode.OK, """{"document":{"md_content":"# Notes"},"status":"success"}""");
        using var content = MakeContent();

        var result = await sut.ParseAsync(content, "notes.pdf", "application/pdf");

        Assert.True(result.IsSuccessful);
        Assert.Equal("# Notes", result.ParsedContent);
        Assert.Null(result.FailureReason);
    }

    [Fact]
    public async Task ParseAsync_a_success_status_with_empty_content_fails_the_parse()
    {
        var sut = MakeSut(HttpStatusCode.OK, """{"document":{"md_content":""},"status":"success","confidence":{"low_grade":"GOOD"}}""");
        using var content = MakeContent();

        var result = await sut.ParseAsync(content, "notes.pdf", "application/pdf");

        Assert.False(result.IsSuccessful);
        Assert.Null(result.ParsedContent);
    }

    [Fact]
    public async Task ParseAsync_a_non_2xx_response_throws_DocumentParsingUnavailableException()
    {
        var sut = MakeSut(HttpStatusCode.InternalServerError, "server error");
        using var content = MakeContent();

        await Assert.ThrowsAsync<DocumentParsingUnavailableException>(() => sut.ParseAsync(content, "notes.pdf", "application/pdf"));
    }

    [Fact]
    public async Task ParseAsync_a_malformed_JSON_body_throws_DocumentParsingUnavailableException()
    {
        var sut = MakeSut(HttpStatusCode.OK, "not json");
        using var content = MakeContent();

        await Assert.ThrowsAsync<DocumentParsingUnavailableException>(() => sut.ParseAsync(content, "notes.pdf", "application/pdf"));
    }

    [Fact]
    public async Task ParseAsync_folds_the_errors_field_into_the_failure_reason_when_present()
    {
        var sut = MakeSut(HttpStatusCode.OK, """{"status":"failure","errors":["page 3 unreadable"]}""");
        using var content = MakeContent();

        var result = await sut.ParseAsync(content, "notes.pdf", "application/pdf");

        Assert.False(result.IsSuccessful);
        Assert.Contains("page 3 unreadable", result.FailureReason);
    }

    // Code-review patch: an invalid content-type must not throw a raw FormatException, breaking
    // this class's documented wrapping contract.
    [Fact]
    public async Task ParseAsync_an_invalid_content_type_throws_DocumentParsingUnavailableException_not_a_raw_FormatException()
    {
        var sut = MakeSut(HttpStatusCode.OK, """{"status":"success"}""");
        using var content = MakeContent();

        await Assert.ThrowsAsync<DocumentParsingUnavailableException>(() => sut.ParseAsync(content, "notes.pdf", "not a valid content type"));
    }
}

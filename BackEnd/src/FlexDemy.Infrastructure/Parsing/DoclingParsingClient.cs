using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using FlexDemy.Application.Common;
using Microsoft.Extensions.Logging;

namespace FlexDemy.Infrastructure.Parsing;

// Story 2.7/AD-21: HTTP-calling implementation of IDocumentParser, targeting a self-hosted
// docling-serve instance. Registered via the typed-client pattern in DependencyInjection.cs --
// httpClient.BaseAddress/Timeout are set there from DoclingOptions, mirroring PortkeyAiGateway's
// exact registration shape. Calls docling-serve's synchronous /v1/convert/file endpoint (not the
// async+polling variant -- see this story's Dev Notes for why nesting a second async mechanism
// inside an already-backgrounded Hangfire job would be redundant complexity).
public sealed class DoclingParsingClient(HttpClient httpClient, ILogger<DoclingParsingClient> logger) : IDocumentParser
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    // docling-serve's own "did the conversion complete" statuses -- only "success" is eligible to
    // pass the confidence check below; anything else fails the parse outright regardless of any
    // confidence field.
    private const string SuccessStatus = "success";

    // Code-review patch: flipped from a denylist (only "POOR" fails) to an allowlist (only these
    // grades pass) -- a denylist silently let a null/missing Confidence object (e.g. if the
    // response's field path assumption below is wrong) or any unrecognized future grade string
    // pass through ungated, defeating AC#2's fail-closed guarantee invisibly. [ASSUMPTION: the
    // exact grade threshold that constitutes "low confidence" is not specified in the PRD --
    // FAIR/GOOD/EXCELLENT pass, POOR (or anything unrecognized) fails, as a starting point;
    // confirm before build if FAIR should fail too.]
    private static readonly HashSet<string> PassingConfidenceGrades = new(StringComparer.OrdinalIgnoreCase) { "FAIR", "GOOD", "EXCELLENT" };

    public async Task<DocumentParseResult> ParseAsync(Stream content, string fileName, string contentType, CancellationToken cancellationToken = default)
    {
        using var form = new MultipartFormDataContent();
        var fileContent = new StreamContent(content);

        // Code-review patch: a null/invalid contentType previously let MediaTypeHeaderValue's
        // constructor throw a raw FormatException, breaking this class's own documented
        // wrapping contract -- mirrors PortkeyAiGateway.BuildRequest's identical header-assignment
        // try/catch.
        try
        {
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        }
        catch (FormatException ex)
        {
            fileContent.Dispose();
            throw new DocumentParsingUnavailableException($"Invalid file content-type for Docling request: {ex.Message}", ex);
        }

        // [ASSUMPTION: "files" as the multipart field name is docling-serve's documented
        // single-file-upload convention per this story's own research, not independently
        // confirmed against a live OpenAPI schema -- confirm before relying on this in production.]
        form.Add(fileContent, "files", fileName);

        var body = await SendAndReadAsync(form, cancellationToken);
        var parsed = Deserialize(body);

        // A non-success status means the conversion itself didn't complete cleanly -- treated as
        // a failed parse outright, regardless of any confidence field. Docling's own `errors`
        // field (when present) is folded into the reason for diagnosability.
        if (!string.Equals(parsed.Status, SuccessStatus, StringComparison.OrdinalIgnoreCase))
        {
            var reason = $"Docling did not complete the conversion (status: {parsed.Status ?? "unknown"}).{FormatErrors(parsed.Errors)}";
            logger.LogWarning("Docling parse did not succeed for {FileName}: {Reason}", fileName, reason);
            return new DocumentParseResult(false, null, reason);
        }

        // Correction, found via live testing against a real deployed docling-serve v1.25.0
        // instance (2026-08-13): the original code-review patch here failed closed on a *missing*
        // confidence object, on the assumption that its absence was anomalous for a "success"
        // response. That assumption was wrong -- confirmed against docling-serve's own OpenAPI
        // schema (no request parameter anywhere enables computing it) and its actual response to
        // a real successful PDF conversion (`confidence` is always `null`, with both
        // `to_formats=md` and `to_formats=[md,json]`). Failing closed on "always null" is
        // equivalent to failing every parse unconditionally, which would make this entire feature
        // permanently non-functional, not a quality gate. A *present* confidence object with a
        // recognized-but-failing grade (e.g. "POOR") is still treated as a genuine low-quality
        // signal and still fails below -- only the "no data available at all" case now passes
        // through instead of rejecting.
        var confidence = parsed.Confidence;
        if (confidence is not null)
        {
            var lowGrade = confidence.LowGrade;
            if (lowGrade is null || !PassingConfidenceGrades.Contains(lowGrade))
            {
                var reason = $"Parsed output confidence is too low or unrecognized (worst-page grade: {lowGrade ?? "none"}).";
                logger.LogWarning(
                    "Docling parse confidence too low for {FileName}: low_grade={LowGrade}, mean_grade={MeanGrade}",
                    fileName, lowGrade ?? "none", confidence.MeanGrade ?? "none");
                return new DocumentParseResult(false, null, reason);
            }
        }

        var parsedContent = parsed.Document?.MdContent;
        if (string.IsNullOrWhiteSpace(parsedContent))
        {
            logger.LogWarning("Docling reported success for {FileName} but produced no content.", fileName);
            return new DocumentParseResult(false, null, "Docling reported success but produced no content.");
        }

        return new DocumentParseResult(true, parsedContent, null);
    }

    private static string FormatErrors(IReadOnlyList<string>? errors) =>
        errors is { Count: > 0 } ? $" Errors: {string.Join("; ", errors)}" : string.Empty;

    // A raw HttpRequestException/TaskCanceledException escaping this class would leave
    // ParseFileJob unable to distinguish "genuinely unreachable" from any other failure --
    // everything transport-related surfaces as DocumentParsingUnavailableException instead,
    // matching ClamAvFileScanner's/PortkeyAiGateway's identical wrapping discipline.
    private async Task<string> SendAndReadAsync(MultipartFormDataContent form, CancellationToken cancellationToken)
    {
        HttpResponseMessage response;
        try
        {
            response = await httpClient.PostAsync("/v1/convert/file", form, cancellationToken);
        }
        catch (HttpRequestException ex)
        {
            throw new DocumentParsingUnavailableException($"Docling parsing request failed: {ex.Message}", ex);
        }
        catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
        {
            throw new DocumentParsingUnavailableException($"Docling parsing request timed out: {ex.Message}", ex);
        }

        using (response)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Docling parsing request failed with status {StatusCode}: {ResponseBody}", (int)response.StatusCode, body);
                throw new DocumentParsingUnavailableException($"Docling parsing request failed with status {(int)response.StatusCode}.");
            }

            return body;
        }
    }

    private static DoclingConvertResponse Deserialize(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<DoclingConvertResponse>(json, JsonOptions)
                ?? throw new DocumentParsingUnavailableException("Docling returned an empty or invalid response.");
        }
        catch (JsonException ex)
        {
            throw new DocumentParsingUnavailableException($"Docling returned an unparseable response: {ex.Message}", ex);
        }
    }

    // Internal wire-shape DTOs. Confirmed live (2026-08-13) against a real docling-serve v1.25.0
    // instance: "confidence" does sit at the response root, parallel to
    // "document"/"status"/"errors" -- but it is populated as `null` for every successful
    // conversion this instance was asked to run (verified against its own OpenAPI schema too: no
    // request parameter anywhere enables computing it). See the null-confidence handling in
    // ParseAsync above.
    private sealed record DoclingConvertResponse(
        [property: JsonPropertyName("document")] DoclingDocument? Document,
        [property: JsonPropertyName("status")] string? Status,
        [property: JsonPropertyName("errors")] IReadOnlyList<string>? Errors,
        [property: JsonPropertyName("confidence")] DoclingConfidence? Confidence);

    private sealed record DoclingDocument([property: JsonPropertyName("md_content")] string? MdContent);

    private sealed record DoclingConfidence(
        [property: JsonPropertyName("mean_grade")] string? MeanGrade,
        [property: JsonPropertyName("low_grade")] string? LowGrade);
}

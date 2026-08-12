namespace FlexDemy.Application.Common;

// Story 2.7/AD-21: lives beside IFileScanner/IFileStorageService, same folder ("analogous in
// shape to Infrastructure/AiGateway/'s client").
public interface IDocumentParser
{
    // A normal (non-exceptional) result for "parsing completed but the output doesn't pass the
    // confidence bar" -- mirrors IFileScanner.FileScanResult distinguishing "the file is dirty"
    // from "the scanner is broken." A genuinely unreachable/erroring Docling service throws
    // DocumentParsingUnavailableException instead.
    Task<DocumentParseResult> ParseAsync(Stream content, string fileName, string contentType, CancellationToken cancellationToken = default);
}

public sealed record DocumentParseResult(bool IsSuccessful, string? ParsedContent, string? FailureReason);

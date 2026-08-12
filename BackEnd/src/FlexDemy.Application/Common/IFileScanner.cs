namespace FlexDemy.Application.Common;

// Story 2.6/AD-22: lives beside IFileStorageService/IUnitOfWork/IIdGenerator, not a new
// Application/Scanning/ folder.
public interface IFileScanner
{
    // Fail-closed contract (AC#3): if the scanner is unreachable, throws FileScanUnavailableException
    // rather than returning a result implying "clean". A completed scan that finds malware is a
    // normal FileScanResult(false, threatName), not a thrown exception.
    Task<FileScanResult> ScanAsync(Stream content, CancellationToken cancellationToken = default);
}

public sealed record FileScanResult(bool IsClean, string? ThreatName);

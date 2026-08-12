using FlexDemy.Application.Common;
using Microsoft.Extensions.Options;
using nClam;

namespace FlexDemy.Infrastructure.Scanning;

// Story 2.6/AD-22: IFileScanner implementation using nClam (Apache License 2.0), the de facto
// standard .NET clamd-protocol client.
public class ClamAvFileScanner(IOptions<ClamAvOptions> options) : IFileScanner
{
    public async Task<FileScanResult> ScanAsync(Stream content, CancellationToken cancellationToken = default)
    {
        var clamAvOptions = options.Value;
        var client = new ClamClient(clamAvOptions.Host, clamAvOptions.Port);

        ClamScanResult scanResult;
        try
        {
            scanResult = await client.SendAndScanFileAsync(content, cancellationToken);
        }
        catch (Exception ex) when (ex is not FileScanUnavailableException)
        {
            // Wraps a connection failure/timeout -- never lets the raw nClam/socket exception
            // bubble up as if it were a normal, completed scan result.
            throw new FileScanUnavailableException("The malware scanner is unreachable.", ex);
        }

        return scanResult.Result switch
        {
            ClamScanResults.Clean => new FileScanResult(true, null),
            ClamScanResults.VirusDetected => new FileScanResult(false, scanResult.InfectedFiles?.FirstOrDefault()?.VirusName ?? "Unknown threat"),
            _ => throw new FileScanUnavailableException($"The malware scanner returned an unexpected result: {scanResult.Result}."),
        };
    }
}

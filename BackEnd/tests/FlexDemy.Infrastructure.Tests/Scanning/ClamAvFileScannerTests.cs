using FlexDemy.Application.Common;
using FlexDemy.Infrastructure.Scanning;
using Microsoft.Extensions.Options;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Scanning;

// Story 2.6/Task 9: this needs a real (or realistically faked) clamd TCP responder to test
// meaningfully, and this codebase has no existing precedent for that kind of test double -- scoped
// to what's practical, per the story's own Dev Notes: a connection failure/timeout is wrapped in
// FileScanUnavailableException, not left as a raw socket exception. Does not attempt to spin up a
// real ClamAV instance -- that's the live-stack manual verification's job.
public class ClamAvFileScannerTests
{
    [Fact]
    public async Task ScanAsync_wraps_an_unreachable_scanner_in_FileScanUnavailableException()
    {
        // Port 1 has no listener on localhost -- a real, fast connection-refused failure.
        var options = Options.Create(new ClamAvOptions { Host = "127.0.0.1", Port = 1 });
        var sut = new ClamAvFileScanner(options);
        using var content = new MemoryStream([1, 2, 3]);

        await Assert.ThrowsAsync<FileScanUnavailableException>(() => sut.ScanAsync(content));
    }
}

using System.Text;
using FlexDemy.Application.Common;
using FlexDemy.Infrastructure.Sanitization;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Sanitization;

// Story 8.1/AD-28.
public class SvgSanitizerTests
{
    private static Stream ToStream(string content) => new MemoryStream(Encoding.UTF8.GetBytes(content));

    private static async Task<string> ReadAllAsync(Stream stream)
    {
        stream.Position = 0;
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return await reader.ReadToEndAsync();
    }

    [Fact]
    public async Task SanitizeAsync_strips_a_script_tag_and_an_onload_handler_verified_by_reading_the_bytes_back()
    {
        var sanitizer = new SvgSanitizer();
        var malicious = "<svg xmlns=\"http://www.w3.org/2000/svg\" onload=\"alert(1)\"><script>alert('xss')</script><circle cx=\"5\" cy=\"5\" r=\"4\" /></svg>";

        await using var result = await sanitizer.SanitizeAsync(ToStream(malicious), CancellationToken.None);
        var sanitized = await ReadAllAsync(result);

        Assert.DoesNotContain("<script", sanitized, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onload", sanitized, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("alert", sanitized, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("<circle", sanitized, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SanitizeAsync_strips_a_foreignObject_element()
    {
        var sanitizer = new SvgSanitizer();
        var malicious = "<svg xmlns=\"http://www.w3.org/2000/svg\"><foreignObject><div onclick=\"evil()\">nope</div></foreignObject><rect width=\"1\" height=\"1\" /></svg>";

        await using var result = await sanitizer.SanitizeAsync(ToStream(malicious), CancellationToken.None);
        var sanitized = await ReadAllAsync(result);

        Assert.DoesNotContain("foreignObject", sanitized, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onclick", sanitized, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("<rect", sanitized, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SanitizeAsync_preserves_a_benign_SVG_shape_and_style_attribute()
    {
        var sanitizer = new SvgSanitizer();
        var benign = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 10 10\"><path d=\"M0 0 L10 10\" style=\"stroke:#000\" /></svg>";

        await using var result = await sanitizer.SanitizeAsync(ToStream(benign), CancellationToken.None);
        var sanitized = await ReadAllAsync(result);

        Assert.Contains("<path", sanitized, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("d=", sanitized, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SanitizeAsync_throws_SvgSanitizationException_when_the_content_is_not_an_SVG_document()
    {
        var sanitizer = new SvgSanitizer();

        await Assert.ThrowsAsync<SvgSanitizationException>(() => sanitizer.SanitizeAsync(ToStream("not an svg at all"), CancellationToken.None));
    }

    [Fact]
    public async Task SanitizeAsync_throws_SvgSanitizationException_for_empty_content()
    {
        var sanitizer = new SvgSanitizer();

        await Assert.ThrowsAsync<SvgSanitizationException>(() => sanitizer.SanitizeAsync(ToStream(string.Empty), CancellationToken.None));
    }
}

namespace FlexDemy.Application.Common;

// Story 8.1/AD-28: wraps HtmlSanitizer (mganss) for SVG-specific sanitization -- an explicit
// SVG-safe tag allowlist, explicit denial of <script>, every on* event-handler attribute, and
// foreignObject (retained as independent defense-in-depth, not because of the CVE originally
// miscited for it). Lives beside IFileScanner/IFileStorageService, not a new Application/
// Sanitization/ folder, matching AD-22's own "lives beside the other Common seams" precedent.
public interface ISvgSanitizer
{
    // Throws SvgSanitizationException if the content isn't parseable as SVG at all -- a
    // scan-style failure the caller turns into Status = Failed, never an unhandled exception.
    Task<Stream> SanitizeAsync(Stream content, CancellationToken cancellationToken = default);
}

public sealed class SvgSanitizationException(string message) : Exception(message);

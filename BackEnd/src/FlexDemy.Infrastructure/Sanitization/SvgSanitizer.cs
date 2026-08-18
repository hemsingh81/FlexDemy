using System.Text;
using FlexDemy.Application.Common;
using Ganss.Xss;

namespace FlexDemy.Infrastructure.Sanitization;

// Story 8.1/AD-28: wraps HtmlSanitizer (mganss) with an explicit SVG-safe configuration --
// AllowedTags/AllowedAttributes are cleared and rebuilt from an explicit allowlist rather than
// relying on HtmlSanitizer's own HTML-oriented defaults, so <script>, every on*
// event-handler attribute, and foreignObject are denied explicitly, not just "not in the default
// list" (defense-in-depth: an explicit deny survives a future HtmlSanitizer default-list change,
// an implicit omission would not).
public class SvgSanitizer : ISvgSanitizer
{
    private static readonly string[] AllowedSvgTags =
    [
        "svg", "path", "circle", "rect", "g", "defs", "line", "polyline", "polygon", "ellipse",
        "text", "tspan", "use", "symbol", "clipPath", "linearGradient", "radialGradient", "stop",
        "title", "desc", "marker", "pattern", "mask", "image",
    ];

    private static readonly string[] AllowedSvgAttributes =
    [
        "id", "class", "style", "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2",
        "width", "height", "viewBox", "preserveAspectRatio", "fill", "fill-opacity", "fill-rule",
        "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray",
        "stroke-opacity", "opacity", "transform", "points", "offset", "stop-color", "stop-opacity",
        "gradientUnits", "gradientTransform", "xmlns", "version", "role", "aria-label",
    ];

    private readonly HtmlSanitizer sanitizer;

    public SvgSanitizer()
    {
        sanitizer = new HtmlSanitizer();
        sanitizer.AllowedTags.Clear();
        foreach (var tag in AllowedSvgTags) sanitizer.AllowedTags.Add(tag);

        sanitizer.AllowedAttributes.Clear();
        foreach (var attribute in AllowedSvgAttributes) sanitizer.AllowedAttributes.Add(attribute);

        // Explicit denial, not just an omission -- <script> and every on* handler are removed by
        // HtmlSanitizer's own tag/attribute-filtering regardless (they were never added to the
        // allowlists above), but AllowedSchemes/foreignObject need their own explicit stance.
        sanitizer.AllowedTags.Remove("script");
        sanitizer.AllowedTags.Remove("foreignObject");
        sanitizer.AllowedCssProperties.Clear();
        sanitizer.AllowedSchemes.Clear();
        sanitizer.AllowedSchemes.Add("data");
    }

    public async Task<Stream> SanitizeAsync(Stream content, CancellationToken cancellationToken = default)
    {
        string raw;
        using (var reader = new StreamReader(content, Encoding.UTF8, leaveOpen: true))
        {
            raw = await reader.ReadToEndAsync(cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(raw) || !raw.Contains("<svg", StringComparison.OrdinalIgnoreCase))
            throw new SvgSanitizationException("The uploaded file is not a valid SVG document.");

        string sanitized;
        try
        {
            sanitized = sanitizer.Sanitize(raw);
        }
        catch (Exception ex)
        {
            throw new SvgSanitizationException($"Could not parse SVG content: {ex.Message}");
        }

        var output = new MemoryStream(Encoding.UTF8.GetBytes(sanitized));
        output.Position = 0;
        return output;
    }
}

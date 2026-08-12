namespace FlexDemy.Infrastructure.Parsing;

// Bound from appsettings.json's "Docling" section -- same IOptions<T>-bound-class pattern as
// AiGatewayOptions/ClamAvOptions.
public sealed class DoclingOptions
{
    public const string SectionName = "Docling";

    public string BaseUrl { get; set; } = "http://docling:5001";

    // [ASSUMPTION: 20 minutes, chosen from this story's own web research finding a real report of
    // a 5-page PDF taking 15+ minutes on constrained CPU resources; confirm before build against
    // the actual deployment's CPU allocation for the docling container. Code-review patch: the
    // original 300s (5 min) default directly contradicted the 15+ minute evidence cited to
    // justify it.]
    public int TimeoutSeconds { get; set; } = 1200;
}

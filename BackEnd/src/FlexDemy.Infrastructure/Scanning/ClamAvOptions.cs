namespace FlexDemy.Infrastructure.Scanning;

// Bound from appsettings.json's "ClamAv" section -- same IOptions<T>-bound-class pattern as
// AiGatewayOptions, not a loose IConfiguration read. Defaults match docker-compose.yml's
// `clamav` service name/port (Task 7).
public sealed class ClamAvOptions
{
    public const string SectionName = "ClamAv";

    public string Host { get; set; } = "clamav";
    public int Port { get; set; } = 3310;
}

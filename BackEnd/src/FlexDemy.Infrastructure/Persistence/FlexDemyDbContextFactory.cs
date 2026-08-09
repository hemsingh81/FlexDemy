using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace FlexDemy.Infrastructure.Persistence;

// AD-8: the explicit design-time factory `dotnet ef migrations add` uses -- run from the
// Api project (`dotnet ef migrations add <Name> --startup-project ../../src/FlexDemy.Api
// --project .`), never relying on implicit host discovery. Reads the same
// ConnectionStrings__Default env var / appsettings key AD-13 wires at runtime.
public class FlexDemyDbContextFactory : IDesignTimeDbContextFactory<FlexDemyDbContext>
{
    public FlexDemyDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
            ?? "Host=localhost;Port=5432;Database=flexdemy;Username=postgres;Password=postgres";

        var optionsBuilder = new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseNpgsql(connectionString)
            .UseSnakeCaseNamingConvention();

        return new FlexDemyDbContext(optionsBuilder.Options);
    }
}

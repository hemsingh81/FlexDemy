using System.Reflection;
using FlexDemy.Application.AiGateway;
using FlexDemy.Infrastructure.AiGateway;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FlexDemy.Infrastructure.Tests.AiGateway;

// Exercises the REAL AddInfrastructure() composition root (Task 3's actual registration), not a
// hand-rolled duplicate -- a regression in DependencyInjection.cs itself is caught here (review
// finding, 2026-08-11 review). A dummy, never-connected-to connection string is enough:
// AddDbContext only registers the DbContext type at this point, it never opens a connection, so
// this doesn't need a live Postgres instance.
public class AiGatewayDependencyInjectionTests
{
    private static ServiceProvider BuildProvider()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Default"] = "Host=localhost;Database=test;Username=test;Password=test",
                ["AiGateway:BaseUrl"] = "http://ai-gateway:8787",
                ["AiGateway:ProviderApiKeys:groq"] = "seeded-key",
            })
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddInfrastructure(configuration);
        return services.BuildServiceProvider();
    }

    [Fact]
    public void IAiGateway_resolves_to_PortkeyAiGateway_via_the_real_AddInfrastructure_registration()
    {
        using var provider = BuildProvider();

        var gateway = provider.GetRequiredService<IAiGateway>();

        Assert.IsType<PortkeyAiGateway>(gateway);
    }

    [Fact]
    public void the_typed_HttpClient_has_BaseAddress_and_Timeout_set_from_AiGatewayOptions()
    {
        using var provider = BuildProvider();

        var gateway = provider.GetRequiredService<IAiGateway>();

        // AddHttpClient<TClient, TImplementation>'s generated internal client name isn't a
        // stable public contract to assert against directly -- reflection on the resolved
        // PortkeyAiGateway's own injected HttpClient field is more robust than guessing it.
        var httpClientField = typeof(PortkeyAiGateway)
            .GetFields(BindingFlags.NonPublic | BindingFlags.Instance)
            .Single(f => f.FieldType == typeof(HttpClient));
        var client = (HttpClient)httpClientField.GetValue(gateway)!;

        Assert.Equal(new Uri("http://ai-gateway:8787"), client.BaseAddress);
        Assert.Equal(TimeSpan.FromSeconds(30), client.Timeout);
    }
}

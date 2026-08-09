using FlexDemy.Api.Middleware;
using FlexDemy.Application;
using FlexDemy.Infrastructure;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// AD-2: composition root -- all DI wiring happens here, via one AddX() per project.
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// AD-8: startup migration is opt-in via RUN_MIGRATIONS_ON_STARTUP, deliberately decoupled
// from ASPNETCORE_ENVIRONMENT (which defaults to Production inside a plain container).
if (builder.Configuration.GetValue("RUN_MIGRATIONS_ON_STARTUP", false))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<FlexDemyDbContext>();
    await db.Database.MigrateAsync();
}

// AD-5: translates AppException subtypes into RFC 7807 ProblemDetails.
app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();

// Exposed for WebApplicationFactory<Program>-based integration tests (FlexDemy.Api.Tests).
public partial class Program;

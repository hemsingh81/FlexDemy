using FlexDemy.Api.Middleware;
using FlexDemy.Application;
using FlexDemy.Application.Common;
using FlexDemy.Domain.Users;
using FlexDemy.Infrastructure;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// AD-2: composition root -- all DI wiring happens here, via one AddX() per project.
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

// The frontend is served from a different origin (Vite dev server, or the nginx `web`
// container) than the API, so the browser needs an explicit CORS allow-list.
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3100", "http://127.0.0.1:3100"];
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("Frontend");

// AD-8: startup migration is opt-in via RUN_MIGRATIONS_ON_STARTUP, deliberately decoupled
// from ASPNETCORE_ENVIRONMENT (which defaults to Production inside a plain container).
if (builder.Configuration.GetValue("RUN_MIGRATIONS_ON_STARTUP", false))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<FlexDemyDbContext>();
    await db.Database.MigrateAsync();

    // Dev-only seed: a default account so the login screen has something to sign in with
    // before real registration flows exist. Not for production data.
    if (!await db.Users.AnyAsync())
    {
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var idGenerator = scope.ServiceProvider.GetRequiredService<IIdGenerator>();
        db.Users.Add(new User
        {
            Id = idGenerator.NewId(),
            Email = "hemsingh81@gmail.com",
            PasswordHash = hasher.Hash("Password@123"),
            FirstName = "Hem",
            LastName = "Singh",
            CreatedAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();
    }
}

// AD-5: translates AppException subtypes into RFC 7807 ProblemDetails.
app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();

// Exposed for WebApplicationFactory<Program>-based integration tests (FlexDemy.Api.Tests).
public partial class Program;

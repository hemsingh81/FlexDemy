using System.Text;
using FlexDemy.Api.Authorization;
using FlexDemy.Api.Middleware;
using FlexDemy.Api.SeedData;
using FlexDemy.Application;
using FlexDemy.Application.Common;
using FlexDemy.Infrastructure;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

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

// RBAC: JWT issued by AuthController.Login/Register carries a Role claim. Some endpoints still
// use [Authorize(Roles = "...")] directly; admin/write endpoints instead use
// [Authorize(Policy = FeatureKeys.X)], evaluated dynamically against the role-permission matrix
// by FeatureAuthorizationHandler/FeaturePolicyProvider below (plan §3). Signing key must match
// FlexDemy.Infrastructure.Security.JwtTokenService's fallback when Jwt:SigningKey isn't
// configured (dev-only default -- override for anything beyond local/demo use).
var jwtSigningKey = builder.Configuration["Jwt:SigningKey"]
    ?? "flexdemy-dev-only-signing-key-not-for-production-use-32bytes+";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "FlexDemy";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtIssuer,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSigningKey)),
            ValidateLifetime = true,
        };
    });
// FeaturePolicyProvider builds a policy on the fly for any policy name matching a FeatureKeys
// constant (e.g. [Authorize(Policy = FeatureKeys.CoursesCreate)]); FeatureAuthorizationHandler
// evaluates it, with an unconditional Master bypass as the lock-out safety net (plan §3).
// FeatureAuthorizationHandler is registered Scoped, not Singleton, because it depends on
// IRolePermissionCache -> IRolePermissionRepository -> FlexDemyDbContext, which are all Scoped;
// ASP.NET Core's authorization middleware resolves IAuthorizationHandler from the per-request
// scoped IServiceProvider, so a Scoped registration here is the correct, framework-supported way
// to give a handler a scoped dependency (no captive-dependency problem). FeaturePolicyProvider
// stays Singleton -- it only depends on IOptions<AuthorizationOptions>.
builder.Services.AddAuthorization();
builder.Services.AddScoped<IAuthorizationHandler, FeatureAuthorizationHandler>();
builder.Services.AddSingleton<IAuthorizationPolicyProvider, FeaturePolicyProvider>();

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

    // Dev-only seed: default users, India master data, and the default role-permission
    // matrix. Each step is independently idempotent -- see DatabaseSeeder for the exact
    // checks -- so this is safe to run on every startup. Not for production data.
    var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
    var idGenerator = scope.ServiceProvider.GetRequiredService<IIdGenerator>();

    await DatabaseSeeder.SeedAsync(db, idGenerator, hasher);
}

// AD-5: translates AppException subtypes into RFC 7807 ProblemDetails.
app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

// Exposed for WebApplicationFactory<Program>-based integration tests (FlexDemy.Api.Tests).
public partial class Program;

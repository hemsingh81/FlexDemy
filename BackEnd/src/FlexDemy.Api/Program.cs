using System.Text;
using FlexDemy.Api.Authorization;
using FlexDemy.Api.Cors;
using FlexDemy.Api.Middleware;
using FlexDemy.Api.RateLimiting;
using FlexDemy.Api.SeedData;
using FlexDemy.Application;
using FlexDemy.Application.Common;
using FlexDemy.Infrastructure;
using FlexDemy.Infrastructure.Persistence;
using Hangfire;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

// Story 2.4: must exist BEFORE WebApplication.CreateBuilder(args) below -- confirmed via a real
// end-to-end check (not caught by any mocked test) that ASP.NET Core resolves
// IWebHostEnvironment.WebRootFileProvider during CreateBuilder() itself, permanently binding it
// to a NullFileProvider for the app's entire lifetime if wwwroot doesn't exist at that exact
// moment. UseStaticFiles() below would then 404 every request forever, even after
// LocalFileStorageService creates the folder later on first upload -- moving this a single line
// later (e.g. after CreateBuilder returns) is too late and silently reintroduces the bug.
// Deliberately Directory.GetCurrentDirectory(), not AppContext.BaseDirectory -- CreateBuilder()'s
// own default ContentRootPath IS Directory.GetCurrentDirectory() (unless overridden via
// WebApplicationOptions, which this project doesn't do), so matching that exactly is what
// guarantees this creates the same wwwroot CreateBuilder() will bind WebRootFileProvider to.
// BaseDirectory (the assembly's own directory) can differ from CWD and would silently create
// the folder in the wrong place if it ever did -- confirmed correct for this project's actual
// deployment (the Dockerfile's WORKDIR + `dotnet FlexDemy.Api.dll` entrypoint keeps CWD and
// BaseDirectory identical), verified via the live end-to-end check referenced above.
Directory.CreateDirectory(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"));

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
// Code-review patch (Story 4.4): the policy body itself now lives in FrontendCorsPolicy.Configure
// -- see that class's own header comment for why (a missing WithExposedHeaders call is exactly
// the kind of bug that needs to be independently testable, not just readable in a Program.cs
// lambda that nothing can exercise).
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy.PolicyName, policy => FrontendCorsPolicy.Configure(policy, allowedOrigins));
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

// Story 4.4/AC #5: per-source-IP limit on the anonymous error-reporting endpoint, the one
// unauthenticated write surface this app exposes. Genuinely new infrastructure (see
// ErrorReportingRateLimiterPolicy's own header comment) -- built-in
// Microsoft.AspNetCore.RateLimiting, no NuGet package needed.
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy(ErrorReportingRateLimiterPolicy.PolicyName, ErrorReportingRateLimiterPolicy.GetPartition);
    options.OnRejected = ErrorReportingRateLimiterPolicy.OnRejected;
});

var app = builder.Build();

// AD-23/Story 4.1: assigns/reuses the request's Correlation ID. Registered first (ahead of
// UseCors too, code-review patch) so it runs on every response, including CORS-preflight ones,
// and -- the actually load-bearing requirement -- before ExceptionHandlingMiddleware, so
// ICorrelationIdAccessor.Current is already set by the time any exception is caught. (Story 4.3
// wires ExceptionHandlingMiddleware to actually read it for error capture; this middleware only
// assigns/echoes it today.)
app.UseMiddleware<CorrelationIdMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors(FrontendCorsPolicy.PolicyName);

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
// Serves LocalFileStorageService's PUBLIC-category uploads (course thumbnails) from
// wwwroot/uploads. Code-review patch: course-content source files ("course-files") are a
// private category and are written outside wwwroot entirely -- never reachable through this
// middleware, only through CourseFilesController's authenticated download action.
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
// Story 4.4: only ErrorReportingController opts in via [EnableRateLimiting] -- every other
// endpoint is unaffected by this middleware being in the pipeline.
app.UseRateLimiter();
// Story 2.6/AD-15: runs Hangfire's background-job processing (ScanFileJob et al.) in-process.
// No Hangfire Dashboard mapped -- it has no auth story yet and isn't required by any AC.
app.UseHangfireServer();
// Story 4.6/AC #5/FR-18: this codebase's first *recurring* (not one-off enqueued) Hangfire job --
// registered once at startup, not re-registered per request. Cron.Daily matches the retention
// window's day-granularity; exact time-of-day isn't ACs-specified.
RecurringJob.AddOrUpdate<FlexDemy.Infrastructure.Jobs.IPurgeOldErrorRecordsJob>(
    "purge-error-records", j => j.RunAsync(CancellationToken.None), Cron.Daily);
app.MapControllers();

app.Run();

// Exposed for WebApplicationFactory<Program>-based integration tests (FlexDemy.Api.Tests).
public partial class Program;

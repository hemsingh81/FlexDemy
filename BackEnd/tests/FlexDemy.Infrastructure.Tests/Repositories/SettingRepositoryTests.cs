using FlexDemy.Domain.Settings;
using FlexDemy.Infrastructure.Persistence;
using FlexDemy.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace FlexDemy.Infrastructure.Tests.Repositories;

public class SettingRepositoryTests
{
    private static FlexDemyDbContext NewContext() =>
        new(new DbContextOptionsBuilder<FlexDemyDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static Setting MakeSetting(string key, string keyType = "Font", string value = "warm-editorial") => new()
    {
        Id = $"setting_{key}_{keyType}",
        Key = key,
        Value = value,
        KeyType = keyType,
    };

    [Fact]
    public async Task GetAllAsync_returns_every_row()
    {
        await using var db = NewContext();
        db.Settings.AddRange(MakeSetting("font.pairing"), MakeSetting("logo.url", "Branding"));
        await db.SaveChangesAsync();
        var repository = new SettingRepository(db);

        var all = await repository.GetAllAsync();

        Assert.Equal(2, all.Count);
    }

    [Fact]
    public async Task GetAllAsync_returns_empty_on_a_fresh_table()
    {
        await using var db = NewContext();
        var repository = new SettingRepository(db);

        Assert.Empty(await repository.GetAllAsync());
    }

    // AD-25's composite (Key, KeyType) unique index (SettingConfiguration.cs's
    // HasIndex(s => new { s.Key, s.KeyType }).IsUnique()) is confirmed present in the generated
    // migration (20260815155006_AddSettings.cs: `ix_settings_key_key_type`, unique: true) and is
    // therefore a real Postgres-level guarantee. It is NOT testable here: verified directly
    // (reproduced against EFCore.InMemory 10.0.4 in isolation) that the InMemory provider does
    // not enforce HasIndex(...).IsUnique() at all -- SaveChangesAsync throws nothing for a
    // duplicate pair, with or without the entity's HasQueryFilter. This is the same class of gap
    // BackEnd/CLAUDE.md's Testing section already documents for AD-7 ("[InMemory] can't
    // translate Npgsql-specific LINQ... those code paths are exercised against real Postgres,
    // not covered by these unit tests") -- constraint enforcement belongs to that same
    // Postgres-only category, not a gap this repository test suite needs to fill.

    [Fact]
    public async Task Same_Key_with_a_different_KeyType_is_allowed()
    {
        await using var db = NewContext();
        db.Settings.Add(MakeSetting("primary", "Font"));
        await db.SaveChangesAsync();

        db.Settings.Add(new Setting { Id = "setting_2", Key = "primary", KeyType = "Color", Value = "#143358" });

        await db.SaveChangesAsync();
        var repository = new SettingRepository(db);
        Assert.Equal(2, (await repository.GetAllAsync()).Count);
    }

    // Story 6.2: GetByIdAsync backs ApplyAsync's lookup of the target row.
    [Fact]
    public async Task GetByIdAsync_returns_the_matching_row()
    {
        await using var db = NewContext();
        db.Settings.Add(MakeSetting("font.pairing"));
        await db.SaveChangesAsync();
        var repository = new SettingRepository(db);

        var result = await repository.GetByIdAsync("setting_font.pairing_Font");

        Assert.NotNull(result);
        Assert.Equal("font.pairing", result!.Key);
    }

    [Fact]
    public async Task GetByIdAsync_returns_null_when_no_row_matches()
    {
        await using var db = NewContext();
        var repository = new SettingRepository(db);

        Assert.Null(await repository.GetByIdAsync("missing"));
    }

    // Story 6.3: ApplyValueAsync's SELECT...FOR UPDATE + ExecuteSqlInterpolatedAsync UPDATE pair is
    // genuinely untestable against the InMemory provider -- confirmed by reproducing it directly:
    // db.Database.SqlQuery<T>(...) throws InvalidOperationException("Relational-specific methods
    // can only be used when the context is using a relational database provider.") the instant it's
    // invoked against an InMemory-backed FlexDemyDbContext, before any SQL shape/translation is
    // even attempted. This is a level further out than the AD-7/BackEnd/CLAUDE.md limitation this
    // file already documents for the unique-index case above: there, InMemory ran the statement but
    // silently didn't enforce the constraint; here, it refuses to run any relational-only raw-SQL
    // call at all, InMemory or not. No test is added here for that -- it would just be pinning
    // InMemory's own limitation, not this repository's behavior. ApplyAsync's orchestration (does
    // it call ApplyValueAsync with the right arguments, does it stage exactly one
    // SettingChangeHistory row, does it wrap both in ExecuteInTransactionAsync) is covered by
    // SettingsServiceTests.cs's mocked-repository tests instead. ApplyValueAsync's actual SQL
    // correctness -- does FOR UPDATE really lock the row and prevent a lost update under concurrent
    // Applies -- needs a live Postgres verification this test suite structurally cannot provide.
}

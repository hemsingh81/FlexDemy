using FlexDemy.Application.Common;
using FlexDemy.Domain.AiConfig;
using FlexDemy.Domain.AiUsage;
using FlexDemy.Domain.ErrorObservability;
using FlexDemy.Domain.MasterData;
using FlexDemy.Domain.Permissions;
using FlexDemy.Domain.Settings;
using FlexDemy.Domain.Tags;
using FlexDemy.Domain.Users;
using FlexDemy.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace FlexDemy.Api.SeedData;

// Dev-only startup seeding, orchestrated from Program.cs's RUN_MIGRATIONS_ON_STARTUP block.
// Each Ensure* method is independently idempotent (see its own comment for the exact check),
// so SeedAsync is safe to call on every startup -- after the first successful run, each step
// becomes a no-op. Not for production data.
public static class DatabaseSeeder
{
    public static async Task SeedAsync(FlexDemyDbContext db, IIdGenerator idGenerator, IPasswordHasher hasher, CancellationToken ct = default)
    {
        await EnsureDefaultUsersAsync(db, idGenerator, hasher, ct);
        await EnsureMasterDataAsync(db, idGenerator, ct);
        await EnsureRolePermissionsAsync(db, idGenerator, ct);
        await EnsureAiConfigAsync(db, idGenerator, ct);
        await EnsureTagsAsync(db, idGenerator, ct);
        await EnsureErrorRetentionSettingsAsync(db, ct);
        await EnsureSettingsAsync(db, idGenerator, ct);
        await EnsureFontPairingDefinitionsAsync(db, idGenerator, ct);
        await EnsureFontSizeDefinitionsAsync(db, idGenerator, ct);
        await EnsureTypographyCombinationsAsync(db, idGenerator, ct);
    }

    // Dev-only seed: one default account per role so the RBAC model has something to sign
    // in as immediately. Idempotent -- safe to run on every startup, and fixes the Master
    // role on hemsingh81@gmail.com even if that row predates the Role column. Not for
    // production data.
    private static async Task EnsureDefaultUsersAsync(FlexDemyDbContext db, IIdGenerator idGenerator, IPasswordHasher hasher, CancellationToken ct)
    {
        async Task EnsureSeedUserAsync(string email, string password, string firstName, string lastName, UserRole role)
        {
            var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
            if (existing is null)
            {
                db.Users.Add(new User
                {
                    Id = idGenerator.NewId(),
                    Email = email,
                    PasswordHash = hasher.Hash(password),
                    FirstName = firstName,
                    LastName = lastName,
                    Role = role,
                    // CreatedAt/CreatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges;
                    // there's no authenticated HttpContext during startup seeding, so CreatedBy stays
                    // null here -- expected, not special-cased.
                });
            }
            else if (existing.Role != role)
            {
                existing.Role = role;
            }
        }

        foreach (var seedUser in DefaultUserSeedData.Users)
        {
            await EnsureSeedUserAsync(seedUser.Email, seedUser.Password, seedUser.FirstName, seedUser.LastName, seedUser.Role);
        }

        await db.SaveChangesAsync(ct);
    }

    // Dev-only master-data seed (plan §2, Phase 0): India + its states/UTs + a handful of major
    // cities + boards + class levels + subjects. Idempotent -- skipped entirely once a Country
    // row with IsoCode "IN" already exists, so this is a no-op on every startup after the first.
    private static async Task EnsureMasterDataAsync(FlexDemyDbContext db, IIdGenerator idGenerator, CancellationToken ct)
    {
        if (await db.Countries.AnyAsync(c => c.IsoCode == "IN", ct))
            return;

        // Subjects are inserted and saved *before* ClassLevels below: ClassLevel.SubjectIds
        // references Subject.Id, and those ids only exist once the rows have actually been
        // committed (IIdGenerator.NewId() is assigned client-side, but SaveChangesAsync is
        // still the point at which the rows are queryable back via db.Subjects for the
        // name -> id lookup that follows).
        foreach (var (name, stream) in SubjectSeedData.Subjects)
        {
            db.Subjects.Add(new Subject { Id = idGenerator.NewId(), Name = name, Stream = stream });
        }

        await db.SaveChangesAsync(ct);

        var subjectIdsByName = await db.Subjects.ToDictionaryAsync(s => s.Name, s => s.Id, ct);

        // CreatedAt/CreatedBy are stamped by AuditSaveChangesInterceptor on SaveChanges below;
        // there's no authenticated HttpContext during startup seeding, so CreatedBy stays null
        // for this seed data -- expected, not special-cased.
        var india = new Country { Id = idGenerator.NewId(), Name = IndiaLocationSeedData.CountryName, IsoCode = IndiaLocationSeedData.CountryIsoCode };
        db.Countries.Add(india);

        foreach (var board in BoardSeedData.NationalBoards)
        {
            db.Boards.Add(new Board { Id = idGenerator.NewId(), Name = board.Name, Code = board.Code, StateId = null });
        }

        foreach (var (name, code, cities) in IndiaLocationSeedData.States)
        {
            var state = new State { Id = idGenerator.NewId(), CountryId = india.Id, Name = name, Code = code };
            db.States.Add(state);

            foreach (var cityName in cities)
                db.Cities.Add(new City { Id = idGenerator.NewId(), StateId = state.Id, Name = cityName });

            db.Boards.Add(new Board { Id = idGenerator.NewId(), Name = BoardSeedData.StateBoardName(name), Code = BoardSeedData.StateBoardCode(code), StateId = state.Id });
        }

        foreach (var (name, code, cities) in IndiaLocationSeedData.UnionTerritories)
        {
            var state = new State { Id = idGenerator.NewId(), CountryId = india.Id, Name = name, Code = code };
            db.States.Add(state);

            foreach (var cityName in cities)
                db.Cities.Add(new City { Id = idGenerator.NewId(), StateId = state.Id, Name = cityName });
        }

        foreach (var (name, sortOrder, subjectNames) in ClassLevelSeedData.ClassLevels)
        {
            var subjectIds = subjectNames.Select(subjectName => subjectIdsByName[subjectName]).ToList();
            db.ClassLevels.Add(new ClassLevel { Id = idGenerator.NewId(), Name = name, SortOrder = sortOrder, SubjectIds = subjectIds });
        }

        await db.SaveChangesAsync(ct);
    }

    // Dev-only role-permission seed (plan §3, Phase 4): reproduces today's hardcoded
    // [Authorize(Roles = "...")] behavior as the default matrix. Idempotent -- skipped entirely
    // once any RolePermission row exists, so this is a no-op on every startup after the first
    // (including after Master edits the matrix via PUT /api/v1/role-permissions).
    private static async Task EnsureRolePermissionsAsync(FlexDemyDbContext db, IIdGenerator idGenerator, CancellationToken ct)
    {
        if (await db.RolePermissions.AnyAsync(ct))
            return;

        foreach (var seed in RolePermissionSeedData.Defaults)
        {
            db.RolePermissions.Add(new RolePermission
            {
                Id = idGenerator.NewId(),
                Role = seed.Role,
                FeatureKey = seed.FeatureKey,
                IsVisible = seed.IsVisible,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    // Dev-only AI Task config seed (Story 1.5, AD-19): one AiTaskConfig + one AiPromptVersion
    // (version 1, active, empty placeholder text -- nothing edits prompt text yet) per AI Task,
    // mirroring the frontend's prior mock values exactly (AC #3). Idempotent PER TASK (not
    // "skip entirely if any row exists") -- so a partial prior run, or a future AiTaskIds entry
    // added after the first seed, still gets seeded on the next startup instead of being
    // silently skipped forever (review finding, 2026-08-11 review).
    private static async Task EnsureAiConfigAsync(FlexDemyDbContext db, IIdGenerator idGenerator, CancellationToken ct)
    {
        var existingTaskIds = await db.AiTaskConfigs.Select(c => c.TaskId).ToListAsync(ct);
        var missing = AiConfigSeedData.TaskConfigs.Where(seed => !existingTaskIds.Contains(seed.TaskId));

        foreach (var seed in missing)
        {
            db.AiTaskConfigs.Add(new AiTaskConfig
            {
                Id = idGenerator.NewId(),
                TaskId = seed.TaskId,
                Provider = seed.Provider,
                Model = seed.Model,
                FallbackProvider = seed.FallbackProvider,
                FallbackModel = seed.FallbackModel,
                BudgetThreshold = seed.BudgetThreshold,
                PricePerMillionInputTokens = seed.PricePerMillionInputTokens,
                PricePerMillionOutputTokens = seed.PricePerMillionOutputTokens,
                FallbackPricePerMillionInputTokens = seed.FallbackPricePerMillionInputTokens,
                FallbackPricePerMillionOutputTokens = seed.FallbackPricePerMillionOutputTokens,
            });

            db.AiPromptVersions.Add(new AiPromptVersion
            {
                Id = idGenerator.NewId(),
                TaskId = seed.TaskId,
                Version = 1,
                PromptText = string.Empty,
                IsPromptActive = true,
            });

            db.AiTaskBudgets.Add(new AiTaskBudget
            {
                Id = idGenerator.NewId(),
                TaskId = seed.TaskId,
                Spent = 0m,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    // Dev-only Tag seed (Story 1.9): mirrors the frontend's prior mock values (INITIAL_TAGS)
    // exactly, so an admin sees identical values on first real load. Idempotent PER NAME (not
    // "skip entirely if any row exists"), matching EnsureAiConfigAsync's established pattern --
    // duplicate-name matching is case-insensitive (EF.Functions.ILike), same rule TagService
    // enforces at write time.
    private static async Task EnsureTagsAsync(FlexDemyDbContext db, IIdGenerator idGenerator, CancellationToken ct)
    {
        var existingNames = await db.Tags.Select(t => t.Name).ToListAsync(ct);
        var missing = TagSeedData.Tags.Where(seed => !existingNames.Any(name => string.Equals(name, seed.Name, StringComparison.OrdinalIgnoreCase)));

        foreach (var seed in missing)
        {
            db.Tags.Add(new Tag
            {
                Id = idGenerator.NewId(),
                Name = seed.Name,
                IsActive = seed.IsActive,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    // Dev-only Story 4.6/FR-18 seed: exactly one settings row, default 180-day retention.
    // Idempotent -- skipped entirely once any row exists (there is only ever meant to be one).
    private static async Task EnsureErrorRetentionSettingsAsync(FlexDemyDbContext db, CancellationToken ct)
    {
        if (await db.ErrorRetentionSettings.AnyAsync(ct))
            return;

        db.ErrorRetentionSettings.Add(new ErrorRetentionSettings { Id = ErrorRetentionSettings.SingletonId, RetentionDays = 180 });

        await db.SaveChangesAsync(ct);
    }

    // Dev-only Story 6.1/AD-25 seed: the initial Font Setting row, so UJ-1's "sees the current
    // Font/Typography setting" has something to read on first admin visit. Value here must match
    // SettingsService's HardcodedDefaults fallback exactly -- both are the "no curated pairing
    // chosen yet" placeholder, not a real pairing name (the actual curated list content is a
    // [NOTE FOR PM] open item in the PRD). Idempotent PER (Key, KeyType) pair, matching
    // EnsureAiConfigAsync's established per-item pattern -- not EnsureErrorRetentionSettingsAsync's
    // blanket skip, since this table will hold multiple independent settings over time.
    private static async Task EnsureSettingsAsync(FlexDemyDbContext db, IIdGenerator idGenerator, CancellationToken ct)
    {
        var seeds = new[]
        {
            (Key: "font.pairing", KeyType: "Font", Value: "default"),
            (Key: "font.size", KeyType: "FontSize", Value: "default"),
        };

        var existingPairs = await db.Settings.Select(s => new { s.Key, s.KeyType }).ToListAsync(ct);
        var missing = seeds.Where(seed => !existingPairs.Any(p => p.Key == seed.Key && p.KeyType == seed.KeyType));

        foreach (var seed in missing)
        {
            db.Settings.Add(new Setting
            {
                Id = idGenerator.NewId(),
                Key = seed.Key,
                KeyType = seed.KeyType,
                Value = seed.Value,
                IsActive = true,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    // Dev-only Story 6.2/AD-26 seed: the curated FontPairingDefinition catalog. "default" is
    // required, not optional -- EnsureSettingsAsync above already seeded a Setting whose Value is
    // the slug "default", and without a matching FontPairingDefinition row that seeded Setting
    // would fail ApplyAsync's own curation check the first time anyone tried to re-apply it; its
    // font strings stay verbatim from index.css's @theme block. Idempotent PER SLUG, matching
    // EnsureAiConfigAsync/EnsureSettingsAsync's established per-item pattern.
    //
    // The other four resolve the [NOTE FOR PM] "additional curated pairings" open item: until they
    // existed, "default" was the ONLY pairing, so every Typography Combination below was forced to
    // vary by size alone and the admin Settings screen rendered 5 preset cards in identical fonts
    // -- a theme picker that couldn't actually change the theme. Each pairing is a genuinely
    // distinct editorial voice, and every family here is loaded by FrontEnd/index.html's Google
    // Fonts link -- adding a pairing whose family isn't in that link silently falls back to the
    // generic stack, so the two must be changed together.
    private static async Task EnsureFontPairingDefinitionsAsync(FlexDemyDbContext db, IIdGenerator idGenerator, CancellationToken ct)
    {
        var seeds = new[]
        {
            (Slug: "default", DisplayFont: "\"Fraunces\", Georgia, serif", BodyFont: "\"Outfit\", system-ui, sans-serif", MonoFont: "\"JetBrains Mono\", monospace"),
            // Traditional academic: high-contrast Didone headings over a humanist body.
            (Slug: "academic", DisplayFont: "\"Playfair Display\", Georgia, serif", BodyFont: "\"Source Sans 3\", system-ui, sans-serif", MonoFont: "\"JetBrains Mono\", monospace"),
            // Contemporary/technical: geometric grotesque headings over a neutral UI body.
            (Slug: "modern", DisplayFont: "\"Space Grotesk\", system-ui, sans-serif", BodyFont: "\"Inter\", system-ui, sans-serif", MonoFont: "\"JetBrains Mono\", monospace"),
            // Warm and approachable -- aimed at younger learners; rounded terminals throughout.
            (Slug: "friendly", DisplayFont: "\"Baloo 2\", system-ui, cursive", BodyFont: "\"Nunito\", system-ui, sans-serif", MonoFont: "\"JetBrains Mono\", monospace"),
            // Atkinson Hyperlegible (Braille Institute) for BOTH display and body: its letterforms
            // are drawn specifically to disambiguate commonly-confused glyph pairs (I/l/1, O/0) for
            // low-vision readers. Paired with the "large" scale in the Accessible theme below.
            (Slug: "accessible", DisplayFont: "\"Atkinson Hyperlegible\", system-ui, sans-serif", BodyFont: "\"Atkinson Hyperlegible\", system-ui, sans-serif", MonoFont: "\"JetBrains Mono\", monospace"),
            // Bookish and familiar -- a workhorse text serif over a warm neutral sans.
            (Slug: "classic", DisplayFont: "\"Merriweather\", Georgia, serif", BodyFont: "\"Lato\", system-ui, sans-serif", MonoFont: "\"JetBrains Mono\", monospace"),
            // Refined/high-end: a delicate old-style display over a geometric sans.
            (Slug: "elegant", DisplayFont: "\"Cormorant Garamond\", Georgia, serif", BodyFont: "\"Montserrat\", system-ui, sans-serif", MonoFont: "\"JetBrains Mono\", monospace"),
            // Documentation/STEM: one superfamily across serif display and sans body, so headings
            // and text stay visibly related -- useful where notation sits inline with prose.
            (Slug: "technical", DisplayFont: "\"IBM Plex Serif\", Georgia, serif", BodyFont: "\"IBM Plex Sans\", system-ui, sans-serif", MonoFont: "\"JetBrains Mono\", monospace"),
            // Magazine-style: a sturdy high-contrast display over a grotesque body.
            (Slug: "editorial", DisplayFont: "\"Libre Baskerville\", Georgia, serif", BodyFont: "\"Work Sans\", system-ui, sans-serif", MonoFont: "\"JetBrains Mono\", monospace"),
        };

        var existingSlugs = await db.FontPairingDefinitions.Select(f => f.Slug).ToListAsync(ct);
        var missing = seeds.Where(seed => !existingSlugs.Contains(seed.Slug));

        foreach (var seed in missing)
        {
            db.FontPairingDefinitions.Add(new FontPairingDefinition
            {
                Id = idGenerator.NewId(),
                Slug = seed.Slug,
                DisplayFont = seed.DisplayFont,
                BodyFont = seed.BodyFont,
                MonoFont = seed.MonoFont,
                IsActive = true,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    // Dev-only Story 6.4/AD-26-pattern seed: the one curated FontSizeDefinition matching the
    // app's current unscaled default (100%, a literal no-op). Required for the same reason
    // EnsureFontPairingDefinitionsAsync's "default" row is required -- EnsureSettingsAsync above
    // already seeded a Setting whose Value is the slug "default" for KeyType "FontSize", and
    // without a matching FontSizeDefinition row that Setting would fail ApplyAsync's own curation
    // check the first time anyone tried to re-apply it. Additional curated scales are a
    // [NOTE FOR PM] open item in the PRD -- not this seed's job. Idempotent PER SLUG, matching
    // EnsureFontPairingDefinitionsAsync's established per-item pattern.
    private static async Task EnsureFontSizeDefinitionsAsync(FlexDemyDbContext db, IIdGenerator idGenerator, CancellationToken ct)
    {
        // Story 6.5: 4 more scales added alongside "default" so 5 distinct Typography
        // Combinations (EnsureTypographyCombinationsAsync below) have real, distinct sizes to
        // vary by -- only one curated Font Pairing exists today, so size is the only axis the
        // 5 combos can meaningfully differ on.
        var seeds = new[]
        {
            (Slug: "default", RootFontScale: "100%"),
            (Slug: "compact", RootFontScale: "90%"),
            (Slug: "comfortable", RootFontScale: "112%"),
            (Slug: "large", RootFontScale: "125%"),
            (Slug: "presentation", RootFontScale: "140%"),
        };

        var existingSlugs = await db.FontSizeDefinitions.Select(f => f.Slug).ToListAsync(ct);
        var missing = seeds.Where(seed => !existingSlugs.Contains(seed.Slug));

        foreach (var seed in missing)
        {
            db.FontSizeDefinitions.Add(new FontSizeDefinition
            {
                Id = idGenerator.NewId(),
                Slug = seed.Slug,
                RootFontScale = seed.RootFontScale,
                IsActive = true,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    // Dev-only Story 6.5 seed: the curated Typography Combination catalog -- the "themes" the
    // Admin -> Settings screen presents as its primary, one-click surface. Required, not optional
    // -- ApplyTypographyCombinationAsync re-validates both referenced definitions are still
    // curated at Apply-time, so every seeded combo must resolve against real, active rows (see
    // EnsureFontPairingDefinitionsAsync/EnsureFontSizeDefinitionsAsync above) or it would fail its
    // own validation the moment anyone tried to use it.
    //
    // RECONCILING, not insert-missing-only like its two sibling seeders above. That difference is
    // deliberate: the original 5 combos all pointed at the one pairing that existed at the time
    // ("default"), so they varied by size alone and the admin screen rendered five preset cards in
    // identical fonts. Insert-missing-only can add the new themes but can never correct those
    // already-persisted placeholder rows, so an existing database would keep serving them forever.
    // Safe to own the rows outright because this seed is their only writer -- there is no
    // admin/API path that creates or edits a combination (SettingsController exposes GET + apply
    // only), so there is no hand-curated state here for a reconcile to clobber.
    //
    // IsActive=false is how a combo is retired: GetTypographyCombinationsAsync filters on it, so a
    // retired theme disappears from the picker while its history entries stay resolvable. The two
    // retired below are size-only variants made redundant by real themes (Academic already carries
    // "comfortable", Accessible already carries "large"); both scales remain independently curated
    // and reachable through the screen's Advanced -> text-size picker.
    private static async Task EnsureTypographyCombinationsAsync(FlexDemyDbContext db, IIdGenerator idGenerator, CancellationToken ct)
    {
        var seeds = new[]
        {
            (Slug: "default", Label: "Default", FontPairingSlug: "default", FontSizeSlug: "default", IsActive: true),
            (Slug: "compact", Label: "Compact", FontPairingSlug: "default", FontSizeSlug: "compact", IsActive: true),
            (Slug: "academic", Label: "Academic", FontPairingSlug: "academic", FontSizeSlug: "comfortable", IsActive: true),
            (Slug: "modern", Label: "Modern", FontPairingSlug: "modern", FontSizeSlug: "default", IsActive: true),
            (Slug: "friendly", Label: "Friendly", FontPairingSlug: "friendly", FontSizeSlug: "comfortable", IsActive: true),
            (Slug: "accessible", Label: "Accessible", FontPairingSlug: "accessible", FontSizeSlug: "large", IsActive: true),
            (Slug: "classic", Label: "Classic", FontPairingSlug: "classic", FontSizeSlug: "default", IsActive: true),
            (Slug: "elegant", Label: "Elegant", FontPairingSlug: "elegant", FontSizeSlug: "comfortable", IsActive: true),
            (Slug: "technical", Label: "Technical", FontPairingSlug: "technical", FontSizeSlug: "default", IsActive: true),
            (Slug: "editorial", Label: "Editorial", FontPairingSlug: "editorial", FontSizeSlug: "comfortable", IsActive: true),
            (Slug: "presentation", Label: "Presentation", FontPairingSlug: "default", FontSizeSlug: "presentation", IsActive: true),
            (Slug: "comfortable", Label: "Comfortable Reading", FontPairingSlug: "default", FontSizeSlug: "comfortable", IsActive: false),
            (Slug: "large", Label: "Large Print", FontPairingSlug: "default", FontSizeSlug: "large", IsActive: false),
        };

        var existing = await db.TypographyCombinationDefinitions.ToListAsync(ct);

        foreach (var seed in seeds)
        {
            var row = existing.FirstOrDefault(t => t.Slug == seed.Slug);
            if (row is null)
            {
                db.TypographyCombinationDefinitions.Add(new TypographyCombinationDefinition
                {
                    Id = idGenerator.NewId(),
                    Slug = seed.Slug,
                    Label = seed.Label,
                    FontPairingSlug = seed.FontPairingSlug,
                    FontSizeSlug = seed.FontSizeSlug,
                    IsActive = seed.IsActive,
                });
                continue;
            }

            row.Label = seed.Label;
            row.FontPairingSlug = seed.FontPairingSlug;
            row.FontSizeSlug = seed.FontSizeSlug;
            row.IsActive = seed.IsActive;
        }

        await db.SaveChangesAsync(ct);
    }
}

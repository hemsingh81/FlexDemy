using FlexDemy.Application.Common;
using FlexDemy.Domain.MasterData;
using FlexDemy.Domain.Permissions;
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
}

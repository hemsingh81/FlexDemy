# Input Reconciliation: FrontEnd/docs/BACKEND_PRD.md vs. new prd.md (Dashboard merge)

**Input reviewed:** `FrontEnd/docs/BACKEND_PRD.md` (full file, 169 lines — read in entirety), cross-checked against `BackEnd/src/FlexDemy.Domain/` (actual C# entities) and `_specs/planning-artifacts/architecture/architecture-eLearning-backend-2026-08-09/ARCHITECTURE-SPINE.md`.

**Claim under test (new PRD §9, last bullet):**
> "`BACKEND_PRD.md` will be authored fresh for this Dashboard/booking/tutor surface; exploration confirmed no prior backend controller/service/entity or documented design intent exists for it beyond the tutor-approval funnel (`TutorProfile`)."

## Verdict: Assumption is INACCURATE as written — needs a correction

The **"no prior controller/service/entity" (i.e. actual C# code)** half is correct. The **"or documented design intent"** half is false. `BACKEND_PRD.md` already contains a substantial, specific design for the tutor-slot/booking surface, and the backend architecture spine explicitly planned a structural home for it. The new PRD should not claim this space is a blank slate for the follow-up backend PRD — it should say the follow-up backend PRD reconciles/supersedes existing documented intent, not that it starts from nothing.

## 1. Existing content in BACKEND_PRD.md relevant to this surface

Direct hits — this is prior documented design intent for exactly the surface the new PRD covers:

- **§3.5 `tutor_slots` table** (lines 89–105): full schema — `tutor_id`, `date`, `start_time`, `end_time`, `duration_minutes`, `is_booked`, `booked_by_student_id`, `rate_per_minute`, `topic`, `status` (`available`/`booked`/`completed`). This is a documented data model for exactly what the new PRD's Glossary calls "Tutor Slot" and "Booking" (§3, FR-9–FR-11, FR-17).
- **§4.4 "Tutor Hub & Slot Management" endpoints** (lines 131–139): `GET /api/v1/tutor/slots`, `POST /api/v1/tutor/book-slot` (`{ slotId, studentId }`), `PATCH /api/v1/tutor/status` (`{ isOnline }`), `GET /api/v1/tutor/analytics`. These map almost 1:1 onto the new PRD's FR-9 (browse/filter slots), FR-10 (book slot), FR-15 (online/offline toggle), FR-16 (performance analytics).
- **§3.2 `courses` table + §4.1 `POST /api/v1/courses` (Tutor Only)** (lines 37–58, 117–118): documented schema and endpoint for course creation, directly relevant to the new PRD's FR-18 (Course Creation Wizard).
- **§3.1 `users` table dashboard fields** (lines 20–34): `streak_days`, `total_points`, `weekly_goal_hours`, plus `preferred_voice`/`tts_rate`/`tts_pitch`/`preferred_language`. These back the new PRD's FR-5 (streak/mastery-points stat cards) and FR-6 (Weekly Goal Card) — i.e., dashboard data has a documented persistence design already, contrary to treating it as unaddressed.
- **§4.2 `PATCH /api/v1/user/settings`**: settings-update endpoint tied to those same fields.
- **§5.1 WebSocket `SESSION_COUNTDOWN_WARNING`** (lines 145–148): real-time event keyed off `slot.startTime`, directly tied to the Tutor Slot/Booking concept the new PRD introduces.

Not found (confirms part of the assumption): no mention anywhere in BACKEND_PRD.md of **"Group Study Pool"** or **"Public Live Masterclass"** by name (grep for `group study|masterclass|study pool` returned zero matches). Those two new-PRD concepts (§3 Glossary, FR-12, FR-13, FR-19) genuinely have no prior backend documentation — the assumption holds only for this subset, not for the surface as a whole.

## 2. Existing API/data conventions a future backend PRD should stay consistent with

If/when the fresh backend PRD is authored for this Dashboard surface, these conventions are already established in BACKEND_PRD.md and should be followed (or explicitly superseded) for consistency:

- **Route convention**: `/api/v1/{resource}` (e.g. `/api/v1/tutor/slots`, `/api/v1/courses`) — matches the *actual* implemented convention too (see `BackEnd/CLAUDE.md`: "Routes are `/api/v1/{resource}`"), so this is a genuine, live convention, not just a stale doc artifact.
- **Auth convention documented**: JWT bearer + OAuth2.0 (§7) — though per ARCHITECTURE-SPINE.md this is explicitly **Deferred**/not implemented yet in the real backend.
- **ID convention mismatch to flag**: BACKEND_PRD.md's SQL uses `VARCHAR(64) PRIMARY KEY` string IDs; the actual implemented backend uses `IIdGenerator.NewId()` (ULIDs per `IdGeneration/UlidIdGenerator`) — consistent in kind (string IDs), so no real conflict, but worth noting the SQL-first BACKEND_PRD.md predates the actual EF Core/ULID implementation pattern now codified in `BackEnd/CLAUDE.md`.
- **Response-shape convention**: not deeply specified beyond "Array<Course>"-style aggregate responses (§4.1) — thin, would need real definition in the fresh PRD.
- **Naming**: snake_case in SQL/DB (`tutor_id`, `is_booked`) vs. camelCase in JSON bodies (`{ slotId, studentId }`, `{ isOnline }`) — matches the actual backend's registered convention (EFCore.NamingConventions for snake_case columns, implicit camelCase JSON) per the architecture spine. This split convention is real and should carry forward.

## 3. Material conflicts / things the new prd.md should cross-reference

- **Biggest gap**: `ARCHITECTURE-SPINE.md` (the actual backend architecture doc, dated 2026-08-09 — one day before this PRD) **explicitly plans a structural home for tutor slots**: `Domain/Tutoring/` (TutorSlot entity), `Application/Tutoring/` (`ITutorService`, `TutorService`, `TutorSlotDto`, `ITutorSlotRepository`), `Infrastructure/Repositories/TutorSlotRepository`, `Api/Controllers/TutorController.cs` (spine lines 161, 169, 182, 190). It cites `BACKEND_PRD.md` by section number multiple times in its own "Deferred" list (§5 WebSockets, §7 NGINX/port 3000) as the source of truth being deferred-not-dropped. **This directly contradicts "no prior backend controller/service/entity or documented design intent exists"** — there is a named, scoped, not-yet-built `Tutoring` feature slice already reserved in the real architecture, derived from BACKEND_PRD.md. The new PRD's §9 assumption should be corrected to acknowledge this reserved slice and either reference it or explicitly say the fresh backend PRD supersedes/fills it in.
- **Confirms the "no C# code yet" half**: `BackEnd/src/FlexDemy.Domain/` currently only contains `Courses/Course.cs`, `MasterData/*`, `Permissions/RolePermission.cs`, `Profiles/{StudentProfile,TutorProfile}.cs`, `Users/{User,UserRole}.cs`. No `Tutoring/TutorSlot.cs`, no booking entity, no group-study or masterclass entity exists in actual code. So "no controller/service/entity exists" is true today.
- **Real `Course` entity has already drifted from BACKEND_PRD.md's schema**: the implemented `Course.cs` (AuditableEntity-based POCO) omits `enrolled_count`'s SQL default nuances aside, but more importantly the real `User.cs` entity has **none** of BACKEND_PRD.md's dashboard fields (`streak_days`, `total_points`, `weekly_goal_hours`, `preferred_voice`, `tts_rate/pitch`, `preferred_language`) — only `Email`, `PasswordHash`, `FirstName`, `LastName`, `Role`, `MustChangePassword`. So BACKEND_PRD.md's data model for dashboard/streak/goal data is itself **stale relative to the real implementation** and cannot be assumed current — the fresh backend PRD will need to reconcile against the *actual* `User` entity, not just extend BACKEND_PRD.md's SQL as-is.
- **WebSockets/Redis/AI pipeline/real JWT-OAuth2** are all explicitly "Deferred" in the architecture spine (not built), matching the new PRD's implicit assumption that none of this is live yet — no conflict there, but the new PRD's Non-Goals/§9 don't mention this deferred status, and a reader of the new PRD alone wouldn't know a real-time countdown-toast (§5.1 of BACKEND_PRD.md, relevant to FR-10/booking confirmation) was ever planned then deferred.
- **Recommendation for the new PRD's §9 wording**: replace "no prior backend controller/service/entity or documented design intent exists for it beyond the tutor-approval funnel" with something like: "no prior backend *implementation* (controller/service/entity) exists for it beyond the tutor-approval funnel (`TutorProfile`); however, `FrontEnd/docs/BACKEND_PRD.md` §3.5/§4.4 and `ARCHITECTURE-SPINE.md`'s reserved `Tutoring` feature slice document prior design intent that the fresh backend PRD should reconcile with (and likely supersede where the frontend flow now differs), not ignore."

## Summary of gaps between the claim and reality

1. BACKEND_PRD.md already documents a `tutor_slots` table and booking/slot-management/analytics endpoints (§3.5, §4.4) directly on-topic for this PRD's Tutor Slot/Booking concepts.
2. BACKEND_PRD.md already documents course-creation (`POST /api/v1/courses`) and dashboard-relevant `users` fields (streak/points/weekly-goal) — relevant to FR-5, FR-6, FR-18.
3. ARCHITECTURE-SPINE.md (the real, current backend architecture doc) has already reserved a `Tutoring` feature slice (entity/service/repo/controller locations) explicitly derived from BACKEND_PRD.md — this is documented design intent that exists today, contradicting the "no ... documented design intent exists" clause verbatim.
4. Group Study Pool and Public Live Masterclass are genuinely undocumented in BACKEND_PRD.md — the assumption is accurate only for these two concepts, not for tutor slots/booking/course-creation/dashboard data.
5. BACKEND_PRD.md's own data model (esp. `users` table dashboard fields) is stale versus the actual implemented `User.cs` entity, so any fresh backend PRD needs to reconcile against real code, not just extend the old doc.

namespace FlexDemy.Domain.Courses;

// PRD Glossary "Lifecycle State": governs what actions are available on a Course.
// "Publishing" is a transient sub-state (Epic 3's publish pipeline), not stored here.
// Persisted via .HasConversion<string>() (CourseConfiguration.cs) -- additive-safe, no
// backfill needed for new members, matching UserRole's identical established pattern.
//
// Published is deliberately ordinal 0 (default(LifecycleState)), not Draft -- confirmed via a
// real end-to-end check against Postgres (not caught by NSubstitute-mocked service tests, which
// never exercise a real EF SaveChanges/INSERT): when a property has a store-generated default
// (CourseConfiguration.cs's .HasDefaultValue()), EF Core omits it from the INSERT statement
// whenever the CLR value equals default(TProperty), deferring to the DB's column default
// instead. With Draft at ordinal 0, every CreateDraftCourseAsync call silently persisted
// "Published" instead of "Draft" -- explicitly assigning LifecycleState.Draft was
// indistinguishable to EF from "never set". Putting Published at ordinal 0 makes the DB
// default and the CLR default the same value, so Draft (now non-default) is always sent
// explicitly. The persisted representation is the string name (HasConversion<string>), so this
// reordering has zero effect on already-migrated data.
public enum LifecycleState
{
    Published,
    Draft,
    InReview,
    ReviewConfirmed,
}

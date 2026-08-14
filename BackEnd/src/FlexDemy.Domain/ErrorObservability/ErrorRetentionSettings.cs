using FlexDemy.Domain.Common;

namespace FlexDemy.Domain.ErrorObservability;

// FR-18: a single-row global settings entity -- one retention window for the whole system, not
// per-Category/per-Priority (the PRD describes one retention window, not several).
public class ErrorRetentionSettings : AuditableEntity
{
    // Code-review patch: a fixed, well-known Id (not IIdGenerator.NewId()) for both the seeder's
    // and the service's self-heal-create paths -- makes "at most one row" structurally
    // enforced by the table's own primary-key constraint instead of a check-then-insert race
    // (two concurrent creates now collide on the PK and one throws, rather than silently
    // producing two rows that GetAsync's FirstOrDefaultAsync would then pick between
    // non-deterministically).
    public const string SingletonId = "error_retention_settings";

    public int RetentionDays { get; set; } = 180;
}

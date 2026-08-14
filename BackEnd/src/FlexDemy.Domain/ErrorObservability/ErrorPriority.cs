namespace FlexDemy.Domain.ErrorObservability;

// FR-10: P0 highest severity, P3 lowest. Auto-assigned on first occurrence (Phase A), may
// auto-escalate on repeat occurrence (Phase B) or be manually increased (Story 4.6) -- never
// auto-decreased.
public enum ErrorPriority
{
    P3,
    P2,
    P1,
    P0,
}

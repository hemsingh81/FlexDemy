// Values mirror the backend's ErrorCategory/ErrorPriority/ErrorStatus/ErrorSource enums exactly
// (FlexDemy.Domain.ErrorObservability) -- these are query-param/JSON string values round-tripped
// to the API, not display text (see humanizeEnumValue below for that).
export const CATEGORY_VALUES = [
  'SystemInfrastructureError',
  'ValidationError',
  'AuthenticationAuthorizationError',
  'ExternalIntegrationError',
  'FileProcessingError',
  'DataIntegrityError',
  'BackgroundJobError',
  'FrontendRuntimeError',
  'Uncategorized',
] as const;

// Highest severity first, matching FR-10's "P0 highest, P3 lowest" -- not the enum's own
// declaration order (P3..P0), which exists only for EF Core's ordinal-free HasConversion<string>.
export const PRIORITY_VALUES = ['P0', 'P1', 'P2', 'P3'] as const;

export const STATUS_VALUES = ['New', 'Resolved', 'Archived'] as const;

export const SOURCE_VALUES = ['Backend', 'Frontend'] as const;

// "SystemInfrastructureError" -> "System Infrastructure Error", "P0" -> "P0" (no lowercase
// letter to split on, left as-is). Generic over any of the enum value lists above -- no
// hardcoded label lookup table to keep in sync as categories are added.
export const humanizeEnumValue = (value: string): string => value.replace(/([a-z])([A-Z])/g, '$1 $2');

// Priority/Status get color-coded pill badges (AC #2 calls this out explicitly for Priority; a
// small closed set with real severity/lifecycle meaning). Category is deliberately left as plain
// text in ErrorLogTable -- 9 values with no natural color semantic would just be an arbitrary
// rainbow, less readable than plain text (Dev Notes: "reasonable either way, not specified").
export const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-orange-100 text-orange-700',
  P2: 'bg-amber-100 text-amber-700',
  P3: 'bg-slate-100 text-slate-600',
};

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  New: 'bg-blue-100 text-blue-700',
  Resolved: 'bg-[#179765]/15 text-[#179765]',
  Archived: 'bg-slate-200 text-slate-600',
};

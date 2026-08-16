[
  {
    "location": "prd.md:FR-1 (§4.1, lines 116-125)",
    "trigger_condition": "My Courses section is loading/errored/not rendered when trigger is placed",
    "guard_snippet": "spec fallback anchor for trigger when MyCoursesSection is in loading/error state",
    "potential_consequence": "Course-creation entry point disappears entirely during load/error states"
  },
  {
    "location": "prd.md:FR-1 (§4.1, lines 116-125)",
    "trigger_condition": "Narrow/mobile viewport where header has no right-hand-side room",
    "guard_snippet": "define responsive fallback position for the trigger below a breakpoint",
    "potential_consequence": "Trigger is clipped, overlapped, or unreachable on small screens"
  },
  {
    "location": "prd.md:FR-2 (§4.1, lines 127-135)",
    "trigger_condition": "Other entry points beyond the stats card may still open the wizard (e.g. deep link, keyboard shortcut)",
    "guard_snippet": "enumerate all wizard entry points and confirm each is updated or intentionally left",
    "potential_consequence": "A stale entry point still exists that contradicts the 'relocated only' claim"
  },
  {
    "location": "prd.md:FR-3 (§4.1, lines 136-144)",
    "trigger_condition": "Empty-state copy is localized/translated in addition to English",
    "guard_snippet": "update all locale strings referencing the trigger's old position, not just default locale",
    "potential_consequence": "Non-English users see empty-state copy pointing to the wrong location"
  },
  {
    "location": "prd.md:FR-3 (§4.1, lines 136-144)",
    "trigger_condition": "Course list is empty due to an active filter (e.g. archived/draft view) rather than zero total courses",
    "guard_snippet": "distinguish 'zero courses ever' from 'zero courses matching current filter' before showing empty-state copy",
    "potential_consequence": "Tutor with existing courses is told to 'start with New Course Wizard' misleadingly"
  },
  {
    "location": "prd.md:FR-4 (§4.2, lines 151-159) / NFR-2 (§5)",
    "trigger_condition": "Admin's role is downgraded below Support while Settings tab is already open in an active session",
    "guard_snippet": "re-check role server-side on every settings request, not just at initial page/tab load",
    "potential_consequence": "Demoted admin retains functional access to Settings until an unrelated reload"
  },
  {
    "location": "prd.md:FR-4 (§4.2) / NFR-2 (§5, lines 299-301)",
    "trigger_condition": "Read (GET/list) endpoints vs write (apply) endpoints for Settings are not separately specified for role gating",
    "guard_snippet": "explicitly gate GET settings/history endpoints at Support+ as well as write endpoints",
    "potential_consequence": "Lower-tier role could read settings/history via direct API even though write and UI are blocked"
  },
  {
    "location": "prd.md:FR-5 (§4.2, lines 161-168)",
    "trigger_condition": "Settings store has zero rows (pre-seed / before first deploy of this feature)",
    "guard_snippet": "define empty-state UI for Settings screen when no KeyType groups exist yet",
    "potential_consequence": "Settings screen renders blank or broken with no guidance before seeding"
  },
  {
    "location": "prd.md:FR-5 (§4.2) / FR-7 (§4.3, lines 184-191)",
    "trigger_condition": "A new KeyType is introduced via data (FR-7) before any admin UI exists for it",
    "guard_snippet": "specify whether FR-5's list view shows unrecognized KeyTypes generically or hides them",
    "potential_consequence": "New KeyType rows are silently invisible in the Settings list, or render with a broken/generic editor"
  },
  {
    "location": "prd.md:FR-5 (§4.2, lines 161-168)",
    "trigger_condition": "A Setting has never been changed since creation/seed (no UpdatedBy actor)",
    "guard_snippet": "define display value for last-changed-by when UpdatedBy is null (e.g. 'System' / seed marker)",
    "potential_consequence": "Last-changed-by column shows null/blank or throws on an unset value"
  },
  {
    "location": "prd.md:FR-6 (§4.3, lines 175-182)",
    "trigger_condition": "Two concurrent requests insert the same new Key under the same KeyType (e.g. two admins introducing a KeyType per FR-7 simultaneously)",
    "guard_snippet": "enforce a unique DB constraint on (Key, KeyType) rather than relying on app-level uniqueness checks",
    "potential_consequence": "Duplicate rows for the same Key/KeyType corrupt the 'unique per KeyType' invariant"
  },
  {
    "location": "prd.md:FR-6 (§4.3) / FR-10 (§4.4, lines 217-223)",
    "trigger_condition": "A Font Pairing spans multiple Keys (Display/Body/Mono) updated together on Apply, and one row's update fails",
    "guard_snippet": "wrap the multi-Key update in a single transaction so partial pairing updates cannot persist",
    "potential_consequence": "Pairing ends up with mismatched Display/Body/Mono values from two different pairings"
  },
  {
    "location": "prd.md:FR-8 (§4.3, lines 193-200)",
    "trigger_condition": "IsActive is toggled independently per Key (e.g. Body=false, Display=true) within one Font Pairing",
    "guard_snippet": "define whether IsActive is settable per-role-Key or only atomically for the whole pairing",
    "potential_consequence": "Effective rendering mixes one active custom font with hardcoded defaults, producing a non-curated pairing"
  },
  {
    "location": "prd.md:FR-8 (§4.3) / FR-13 (§4.5, lines 253-260)",
    "trigger_condition": "IsActive is toggled directly (not via a Value-change Apply flow)",
    "guard_snippet": "route IsActive toggles through the same Preview/Apply/history pipeline as Value changes, or explicitly define it as a separate action",
    "potential_consequence": "IsActive changes bypass preview, audit history, and the Apply confirmation entirely"
  },
  {
    "location": "prd.md:FR-8 (§4.3, lines 193-200)",
    "trigger_condition": "Stored Value is null/empty/malformed while IsActive is true",
    "guard_snippet": "validate stored Value shape before treating it as Effective Value; fall back to default if invalid",
    "potential_consequence": "Site renders with a broken/empty font declaration instead of a valid pairing or default"
  },
  {
    "location": "prd.md:FR-9 (§4.4, lines 207-215)",
    "trigger_condition": "Curated Font Pairing list is empty (zero approved pairings defined)",
    "guard_snippet": "require the picker to handle/display a no-options state distinct from a loading state",
    "potential_consequence": "Font picker renders with nothing selectable, blocking the entire feature"
  },
  {
    "location": "prd.md:FR-9 (§4.4, lines 207-215)",
    "trigger_condition": "The currently active/stored pairing is no longer present in the curated list (list edited after being applied)",
    "guard_snippet": "handle display of a 'current' selection that doesn't match any curated list entry",
    "potential_consequence": "Settings screen cannot show which curated option is 'current', or mis-highlights the wrong one"
  },
  {
    "location": "prd.md:FR-10 (§4.4, lines 217-223) / FR-14 (§4.6, lines 267-274)",
    "trigger_condition": "Admin clicks Apply on a candidate pairing identical to the currently active one",
    "guard_snippet": "define whether a no-diff Apply still writes a new change-history entry",
    "potential_consequence": "History fills with no-op entries, or a real no-op Apply is silently dropped inconsistently with FR-14"
  },
  {
    "location": "prd.md:FR-10 (§4.4) vs FR-14 (§4.6, lines 267-274)",
    "trigger_condition": "A Font Pairing Apply updates multiple Keys (Display/Body/Mono per FR-6/FR-10) in one user action",
    "guard_snippet": "reconcile FR-14's 'exactly one new change-history entry' consequence with multi-Key pairing updates (e.g. one grouped entry vs one entry per Key)",
    "potential_consequence": "Change history either under-records (loses per-role old/new values) or contradicts the stated one-entry-per-apply behavior"
  },
  {
    "location": "prd.md:FR-11 (§4.4, lines 225-235)",
    "trigger_condition": "User stays on a long-lived SPA session doing only client-side route transitions, never a full browser reload",
    "guard_snippet": "define whether client-side navigation (not just full page load) re-fetches effective settings",
    "potential_consequence": "User never sees an applied typography change for the entire session, contrary to NFR-1 intent"
  },
  {
    "location": "prd.md:FR-11 (§4.4, lines 225-235)",
    "trigger_condition": "A font previously confirmed as index.html-linked fails to load at render time (e.g. Google Fonts CDN outage)",
    "guard_snippet": "define a rendering fallback (system font / hardcoded default) when the linked font fails to load",
    "potential_consequence": "Page renders with browser default fallback font unpredictably, with no defined recovery"
  },
  {
    "location": "prd.md:FR-12 (§4.5, lines 242-251) / NFR-3 (§5, lines 302-304)",
    "trigger_condition": "Admin has the Settings screen open in multiple browser tabs/windows under the same session",
    "guard_snippet": "scope preview state per-tab (component state), not per-session-wide shared storage",
    "potential_consequence": "Preview selection in one tab could bleed into or reset another tab's preview unexpectedly"
  },
  {
    "location": "prd.md:FR-13 (§4.5, lines 253-260)",
    "trigger_condition": "Admin double-clicks/rapidly re-clicks Apply before the first request completes",
    "guard_snippet": "disable Apply button / debounce and use an idempotency key on the apply request",
    "potential_consequence": "Duplicate change-history entries or a race between two concurrent apply requests for the same click"
  },
  {
    "location": "prd.md:FR-13 (§4.5, lines 253-260)",
    "trigger_condition": "Apply request fails mid-flight (network/server error) after any optimistic UI update",
    "guard_snippet": "roll back optimistic 'applied' UI state and surface an error if the apply call fails",
    "potential_consequence": "Admin believes a change is live when it was never persisted, or UI is left in an inconsistent state"
  },
  {
    "location": "prd.md:FR-14 (§4.6, lines 267-274)",
    "trigger_condition": "First-ever Apply for a brand-new Key/KeyType with no prior stored row",
    "guard_snippet": "define recorded 'old Value' as null/default-marker rather than assuming a prior row always exists",
    "potential_consequence": "History entry has an undefined or incorrect old Value for the very first change on a Key"
  },
  {
    "location": "prd.md:FR-15 (§4.6, lines 276-283)",
    "trigger_condition": "A Setting accumulates a very large number of change-history entries over time",
    "guard_snippet": "add pagination or a result cap to the history view",
    "potential_consequence": "History view becomes slow or unusable with unbounded entry counts"
  },
  {
    "location": "prd.md:FR-16 (§4.6, lines 284-292)",
    "trigger_condition": "Admin restores a historical value whose pairing has since been removed from the curated list (FR-9)",
    "guard_snippet": "validate a restored candidate against the current curated list before allowing Apply, or explicitly allow bypass",
    "potential_consequence": "Restore silently re-applies a now-uncurated pairing, defeating FR-9's brand-rule guardrail"
  },
  {
    "location": "prd.md:FR-16 (§4.6, lines 284-292)",
    "trigger_condition": "Admin selects the currently-active entry from history to 'restore' (no actual change)",
    "guard_snippet": "define whether restoring the current value still runs through Preview/Apply and logs a redundant history entry",
    "potential_consequence": "Ambiguous/no-op restore either does nothing silently or clutters history with an identical entry"
  },
  {
    "location": "prd.md:FR-16 (§4.6, lines 284-292) / FR-6 (§4.3)",
    "trigger_condition": "A Font Pairing spans 3 Keys, but a selected history entry only recorded one Key's old/new Value",
    "guard_snippet": "define whether restore reconstructs all 3 pairing Keys together or only the single recorded Key",
    "potential_consequence": "Restoring one Key's historical value in isolation reconstructs a mismatched, non-curated pairing"
  },
  {
    "location": "prd.md:NFR-5 (§5, lines 307-309) / FR-14 (§4.6, lines 267-274)",
    "trigger_condition": "Two admins concurrently edit the same Setting; second admin's Apply is based on a stale pre-fetch of the 'current' value",
    "guard_snippet": "capture 'old Value' by re-reading the DB row at Apply time, not from the admin's original page-load snapshot",
    "potential_consequence": "Change-history 'old Value' misrepresents the true prior state under last-write-wins concurrency"
  },
  {
    "location": "prd.md:NFR-4 (§5, lines 305-306)",
    "trigger_condition": "Settings store returns malformed/unexpected data (bad KeyType, invalid Value shape) rather than being fully unreachable",
    "guard_snippet": "extend fail-safe default handling to cover schema-invalid responses, not only connection failure",
    "potential_consequence": "Malformed data isn't 'unreachable' so the fail-safe default never engages, and rendering breaks or is undefined"
  },
  {
    "location": "prd.md:NFR-4 (§5, lines 305-306)",
    "trigger_condition": "Settings store is slow but not down (no explicit timeout threshold defined)",
    "guard_snippet": "define a timeout after which the client treats the store as unreachable and falls back to defaults",
    "potential_consequence": "Page load hangs waiting indefinitely on a degraded-but-alive settings endpoint"
  },
  {
    "location": "prd.md:NFR-4 (§5, lines 305-306)",
    "trigger_condition": "Only some KeyTypes/Keys are reachable (partial store failure) rather than total unreachability",
    "guard_snippet": "define per-Key fallback to defaults rather than an all-or-nothing unreachable check",
    "potential_consequence": "Partial failure isn't 'unreachable' so some Keys render with stale/undefined values instead of falling back"
  }
]

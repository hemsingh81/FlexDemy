// Shared timing constants for transient UI feedback (auto-dismissing toasts, inline "Saved!"/
// "Copied!" confirmations) -- pulled out of several features that each hardcoded their own
// setTimeout duration. Grouped by what the duration actually MEANS, not just by file: two call
// sites reaching for the same semantic ("standard toast") share one constant below, while
// durations that are deliberately different (a longer celebratory toast, a longer
// network-status toast, two differently-timed inline confirmations) each keep their own name
// rather than being forced together.

// Standard auto-dismiss window for a short confirmation toast/banner -- e.g. "Link copied!"
// (CourseOverviewScreen.tsx), "Review submitted!" (CourseReviewModal.tsx), FocusSessionTimer.tsx's
// routine mid-session "+points" reward notice, and lib/tts.ts's speech-unsupported fallback delay.
export const TOAST_DURATION_MS = 3000;

// Longer variant for FocusSessionTimer.tsx's "Target Reached!" bonus-XP toast -- deliberately
// longer than TOAST_DURATION_MS since it's a bigger, once-per-session celebratory moment worth a
// beat longer on screen, not a value to consolidate with the standard toast above.
export const CELEBRATION_TOAST_DURATION_MS = 4500;

// OfflineProgressToast.tsx's "back online" confirmation -- reports a connectivity state change
// rather than confirming a one-off action, so it's deliberately given a bit more read time than
// the standard toast above.
export const NETWORK_STATUS_TOAST_DURATION_MS = 4000;

// AiTaskConfigRow.tsx's inline "Saved!" -> "Save" button-label revert.
export const SAVE_CONFIRMATION_DISMISS_MS = 1500;

// ScratchpadPanel.tsx's inline copy-to-clipboard checkmark revert.
export const COPY_CONFIRMATION_DISMISS_MS = 2000;

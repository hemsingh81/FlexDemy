import React, { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../../../ui/Button';
import { AI_MODELS, AI_PROVIDERS, type AiTaskConfig, type AiTaskConfigPatch } from './useAiTaskConfig';
import { SAVE_CONFIRMATION_DISMISS_MS } from '../../../lib/constants';

// Display labels for the 7 AI Task ids -- purely presentational, keeps the wire/mock identifier
// (`taskId`, matches the backend's real AiTaskConfig.taskId once Story 1.5 lands) distinct from
// what an admin reads on screen.
export const TASK_LABELS: Record<AiTaskConfig['taskId'], string> = {
  extractStructure: 'Extract Structure',
  explainTopic: 'Drill-Down (explainTopic)',
  rewriteExplanation: 'Ways (rewriteExplanation)',
  generateExercise: 'Generate Exercise',
  defineKeyword: 'Define Keyword',
  describeNotation: 'Describe Notation (alt-text)',
  embeddings: 'Embeddings',
};

// Same white-fill / hairline-border / rounded-xl / amber-focus-ring shape as
// MasterDataManager.tsx's existing `selectClassName` -- {components.input} in DESIGN.md.
const fieldClassName =
  'w-full px-3 py-2 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012]';

interface AiTaskConfigRowProps {
  task: AiTaskConfig;
  onSave: (taskId: AiTaskConfig['taskId'], patch: AiTaskConfigPatch) => Promise<void>;
}

// One row per AI Task inside AiConfiguration.tsx. Saves independently (AC #2) -- there is no
// page-level "Save All"; this row's own Save button is the only way its edits persist.
export const AiTaskConfigRow: React.FC<AiTaskConfigRowProps> = ({ task, onSave }) => {
  const [provider, setProvider] = useState(task.provider);
  const [model, setModel] = useState(task.model);
  const [fallbackProvider, setFallbackProvider] = useState(task.fallbackProvider);
  const [fallbackModel, setFallbackModel] = useState(task.fallbackModel);
  // Kept as a raw string so a momentarily-empty field doesn't silently coerce to 0 -- validity
  // is checked explicitly (isThresholdValid) rather than relying on Number('') === 0.
  const [budgetThresholdInput, setBudgetThresholdInput] = useState(String(task.budgetThreshold));
  const [justSaved, setJustSaved] = useState(false);
  // Story 1.5: a real backend save can genuinely fail (network error, validation rejection),
  // unlike Story 1.1's mock setState which always "succeeded" -- this row now distinguishes the
  // two instead of unconditionally showing "Saved!" (Story 1.5 AC #5 / Dev Notes).
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Cancels the pending "revert Saved! -> Save" timer if the row unmounts first (e.g. a future
  // filtered/paginated view of this table) -- caught in code review as a leaked timer.
  useEffect(() => () => clearTimeout(savedTimeoutRef.current), []);

  // Resyncs local field state if `task` changes after mount -- named in Story 1.1's own
  // deferred-work entry as "Story 1.5's live-wire is the natural point to add resync logic,"
  // now that `task` genuinely can change post-mount (this row's own successful save patches the
  // parent's `data`, giving this row a fresh `task` object with the just-saved values). Safe:
  // the only thing that changes `task`'s object identity today is this same row's own save, so
  // resyncing never clobbers an unrelated in-progress edit (review finding, 2026-08-11 review).
  useEffect(() => {
    setProvider(task.provider);
    setModel(task.model);
    setFallbackProvider(task.fallbackProvider);
    setFallbackModel(task.fallbackModel);
    setBudgetThresholdInput(String(task.budgetThreshold));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task]);

  const warningId = useId();
  const isOverThreshold = task.currentSpend >= task.budgetThreshold;

  const parsedThreshold = Number(budgetThresholdInput);
  const isThresholdValid =
    budgetThresholdInput.trim() !== '' && Number.isFinite(parsedThreshold) && parsedThreshold >= 0;

  // Any further edit invalidates the just-saved confirmation (and a stale save error) immediately
  // -- otherwise "Saved!"/an old error keeps showing after the admin has already started a new,
  // unsaved change (caught in code review, Story 1.1; same reasoning extended to saveError here).
  const markDirty = () => {
    setJustSaved(false);
    setSaveError(null);
    clearTimeout(savedTimeoutRef.current);
  };

  const handleSave = async () => {
    if (!isThresholdValid) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(task.taskId, { provider, model, fallbackProvider, fallbackModel, budgetThreshold: parsedThreshold });
      setJustSaved(true);
      clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => setJustSaved(false), SAVE_CONFIRMATION_DISMISS_MS);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      data-testid={`ai-task-row-${task.taskId}`}
      role="group"
      aria-label={TASK_LABELS[task.taskId]}
      aria-describedby={isOverThreshold ? warningId : undefined}
      className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end p-4 bg-white border border-[#E1DED4] rounded-xl"
    >
      <div className="md:col-span-1">
        <span className="block text-xs font-bold text-[#142030]">{TASK_LABELS[task.taskId]}</span>
        {isOverThreshold && (
          <div
            id={warningId}
            data-testid="budget-warning"
            aria-live="polite"
            className="mt-1 flex items-center gap-1 text-[#D97706]"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="text-[11px] font-bold text-[#142030]">
              Over budget (${task.currentSpend.toFixed(1)} / ${task.budgetThreshold})
            </span>
          </div>
        )}
      </div>

      <label className="text-xs text-[#5E6A79]">
        Provider
        <select
          className={fieldClassName}
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value as typeof provider);
            markDirty();
          }}
        >
          {AI_PROVIDERS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-[#5E6A79]">
        Model
        <select
          className={fieldClassName}
          value={model}
          onChange={(e) => {
            setModel(e.target.value as typeof model);
            markDirty();
          }}
        >
          {AI_MODELS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-[#5E6A79]">
        Fallback provider
        <select
          className={fieldClassName}
          value={fallbackProvider}
          onChange={(e) => {
            setFallbackProvider(e.target.value as typeof fallbackProvider);
            markDirty();
          }}
        >
          {AI_PROVIDERS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="text-xs text-[#5E6A79]">
        Fallback model
        <select
          className={fieldClassName}
          value={fallbackModel}
          onChange={(e) => {
            setFallbackModel(e.target.value as typeof fallbackModel);
            markDirty();
          }}
        >
          {AI_MODELS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-end gap-2">
        <label className="text-xs text-[#5E6A79] flex-1">
          Budget threshold ($)
          <input
            type="number"
            min="0"
            className={fieldClassName}
            value={budgetThresholdInput}
            onChange={(e) => {
              setBudgetThresholdInput(e.target.value);
              markDirty();
            }}
          />
        </label>
        <div className="flex flex-col items-end gap-1">
          <Button type="button" variant="secondary" size="sm" onClick={handleSave} disabled={!isThresholdValid || isSaving}>
            {justSaved ? 'Saved!' : isSaving ? 'Saving...' : 'Save'}
          </Button>
          {saveError && (
            <span data-testid="save-error" role="alert" className="text-[11px] font-bold text-red-600">
              {saveError}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { SidePanel } from '../../ui/SidePanel';
import { Button } from '../../ui/Button';
import { isTaxonomyStepValid, isTitleStepValid, useCourseDraft } from './useCourseDraft';
import { StepTitleDescription } from './StepTitleDescription';
import { StepTags } from './StepTags';
import { StepTaxonomy } from './StepTaxonomy';
import { StepThumbnails } from './StepThumbnails';

export type CourseWizardStep = 1 | 2 | 3 | 4;

const STEP_LABELS: Record<CourseWizardStep, string> = {
  1: 'Title & Description',
  2: 'Tags',
  3: 'Taxonomy',
  4: 'Thumbnails',
};

interface CourseWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (draftId: string) => void;
}

// New 4-step metadata wizard (Title & Description / Tags / Taxonomy / Thumbnails). Story 2.4
// live-wires Title/Description/Thumbnails persistence -- see useCourseDraft.ts. Supersedes the
// old 5-step wizard in TutorEducatorHubView.tsx; that old wizard's code was removed in Story
// 2.4 (see this story's Dev Notes).
export const CourseWizard: React.FC<CourseWizardProps> = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState<CourseWizardStep>(1);
  // Guards against a rapid double-click/double-Enter invoking handleFinish twice in the same
  // tick, before the parent's onComplete has a chance to flip isOpen false -- matches Next's own
  // disabled-while-invalid pattern.
  const [hasFinished, setHasFinished] = useState(false);
  // True while a commitStep() call triggered by Next/Back/Finish is in flight -- disables the
  // active button and shows a "Saving…" label (AC#1).
  const [isSaving, setIsSaving] = useState(false);
  // Local, component-only error -- distinct from draftHook.error (a failed save). Used only for
  // the defensive "Finish reached with no draftId" branch below, which the hook has no state of
  // its own to represent (it's not a save failure, it's an unexpected invariant violation).
  // Code-review patch: must be declared here, above the early `if (!isOpen) return null` below
  // -- a hook declared after a conditional return violates the Rules of Hooks (the hook count
  // would differ between a closed render and an open one), which React only catches at runtime.
  const [localError, setLocalError] = useState<string | null>(null);
  const draftHook = useCourseDraft();
  const { data } = draftHook;

  if (!isOpen) return null;

  // Steps 1 and 3 have required fields (Title, Taxonomy) gating Next. Steps 2 (Tags, FR-7 --
  // "zero or more") and 4 (Thumbnails, FR-9 -- "up to 3", no minimum) have none, so Next is
  // always enabled there.
  const isCurrentStepValid =
    step === 1 ? isTitleStepValid(data) : step === 3 ? isTaxonomyStepValid(data, draftHook.boards) : true;

  // Resets the local draft state (does not delete the persisted Draft row -- see
  // useCourseDraft.ts's Dev Notes) so the next "New Course Wizard" session starts blank instead
  // of pre-filled with this one's data.
  const handleClose = () => {
    setStep(1);
    draftHook.resetDraft();
    onClose();
  };

  // AC#1: auto-persists Title/Description as a real Draft after every step -- Next/Finish commit
  // before actually moving. On failure, do not advance; draftHook.error is shown inline below so
  // the tutor can see and retry (clicking the button again) instead of silently losing progress.
  const runStepTransition = async (transition: () => void) => {
    setIsSaving(true);
    const { ok } = await draftHook.commitStep();
    setIsSaving(false);
    if (ok) transition();
  };

  // Code-review patch: Back is pure navigation -- whatever the tutor typed on the step they're
  // leaving was already persisted by that step's own Next click (or hasn't been typed yet, on
  // Step 1). Gating Back on a successful commitStep() (as Next/Finish must) meant a transient
  // network failure blocked the tutor from even going backward, which Back has no reason to
  // require. It still clears any previous save error so a stale failure banner doesn't linger
  // after the tutor has navigated away from it.
  const handleBack = () => {
    setLocalError(null);
    setStep((s) => (s - 1) as CourseWizardStep);
  };
  const handleNext = () => runStepTransition(() => setStep((s) => (s + 1) as CourseWizardStep));

  // onComplete's draftId is consumed by the caller (TutorEducatorHubView.tsx, Story 2.2) to open
  // Course Content Editor -- that screen now exists (its file-upload slice, built in Story 2.2;
  // the Chapter/Topic/Subtopic tree is Story 2.3's addition to the same screen). draftHook.draftId
  // is guaranteed non-null here: reaching Finish requires having passed Step 1's Next, which
  // already ran commitStep() successfully -- but a defensive check guards against relying on
  // that invariant blindly, surfacing localError rather than failing silently if it's ever wrong.
  const handleFinish = () => runStepTransition(() => {
    if (!draftHook.draftId) {
      setLocalError('Something went wrong saving your course. Please try again.');
      return;
    }
    setHasFinished(true);
    onComplete(draftHook.draftId);
    setStep(1);
    draftHook.resetDraft();
  });

  const footer = (
    <>
      {step > 1 && (
        // Still gated on isSaving (a Next/Finish commitStep in flight) -- not because Back
        // itself saves anything, but to avoid Back's step change and a still-resolving Next's
        // own step change racing each other.
        <Button variant="ghost" size="sm" className="mr-auto" disabled={isSaving} onClick={handleBack}>
          ← Back
        </Button>
      )}
      {step < 4 ? (
        <Button variant="secondary" size="sm" disabled={!isCurrentStepValid || isSaving} onClick={handleNext}>
          {isSaving ? 'Saving…' : 'Next →'}
        </Button>
      ) : (
        <Button variant="primary" size="sm" disabled={hasFinished || isSaving} onClick={handleFinish}>
          {isSaving ? 'Saving…' : 'Finish'}
        </Button>
      )}
    </>
  );

  return (
    <SidePanel
      title="New Course Wizard"
      subtitle={`Step ${step} of 4`}
      onClose={handleClose}
      closeOnBackdropClick={false}
      width="lg"
      footer={footer}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[10px] font-bold text-slate-500">
          {([1, 2, 3, 4] as CourseWizardStep[]).map((s) => (
            <div key={s} className={`p-2 rounded-xl ${step >= s ? 'bg-[#143358] text-white' : 'bg-slate-100'}`}>
              {s}. {STEP_LABELS[s]}
            </div>
          ))}
        </div>

        {(draftHook.error || localError) && (
          <p role="alert" className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {draftHook.error || localError}
          </p>
        )}

        {step === 1 && (
          <StepTitleDescription draft={data} updateTitle={draftHook.updateTitle} updateDescription={draftHook.updateDescription} />
        )}
        {step === 2 && (
          <StepTags draft={data} tags={draftHook.tags} lockedTags={draftHook.lockedTags} toggleTag={draftHook.toggleTag} />
        )}
        {step === 3 && (
          <StepTaxonomy
            draft={data}
            countries={draftHook.countries}
            states={draftHook.states}
            cities={draftHook.cities}
            boards={draftHook.boards}
            classLevels={draftHook.classLevels}
            subjects={draftHook.subjects}
            updateTaxonomy={draftHook.updateTaxonomy}
          />
        )}
        {step === 4 && (
          <StepThumbnails
            thumbnails={data.thumbnails}
            addThumbnail={draftHook.addThumbnail}
            removeThumbnail={draftHook.removeThumbnail}
            reorderThumbnail={draftHook.reorderThumbnail}
            setPrimaryThumbnail={draftHook.setPrimaryThumbnail}
          />
        )}
      </div>
    </SidePanel>
  );
};

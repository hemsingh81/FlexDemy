import { useState } from 'react';

// Extracted from TutorEducatorHubView.tsx: owns the hand-off between the New Course Wizard
// (Story 2.1) and the Course Content Editor (Story 2.2) -- finishing the wizard opens the editor
// for the draft it just created.
export const useCourseCreationFlow = () => {
  const [isNewCourseWizardOpen, setIsNewCourseWizardOpen] = useState(false);
  const [isContentEditorOpen, setIsContentEditorOpen] = useState(false);
  const [contentEditorDraftId, setContentEditorDraftId] = useState<string | null>(null);

  const openWizard = () => setIsNewCourseWizardOpen(true);
  const closeWizard = () => setIsNewCourseWizardOpen(false);

  const handleWizardComplete = (draftId: string) => {
    setIsNewCourseWizardOpen(false);
    setContentEditorDraftId(draftId);
    setIsContentEditorOpen(true);
  };

  const closeContentEditor = () => {
    setIsContentEditorOpen(false);
    setContentEditorDraftId(null);
  };

  return {
    isNewCourseWizardOpen,
    isContentEditorOpen,
    contentEditorDraftId,
    openWizard,
    closeWizard,
    handleWizardComplete,
    closeContentEditor,
  };
};

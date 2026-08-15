import { useState } from 'react';

// Where the currently-open Course Content Editor was launched from -- drives *where in the tree*
// it renders (TutorEducatorHubView.tsx renders it at the top only for 'wizard'; MyCoursesSection
// renders it inline, directly beneath the clicked course row, for 'resume'). Both origins share
// this same hook's isContentEditorOpen/contentEditorDraftId state -- there is only ever one
// editor open at a time, just displayed in two different places depending on how it was reached.
type ContentEditorOrigin = 'wizard' | 'resume';

// Extracted from TutorEducatorHubView.tsx: owns the hand-off between the New Course Wizard
// (Story 2.1) and the Course Content Editor (Story 2.2) -- finishing the wizard opens the editor
// for the draft it just created.
export const useCourseCreationFlow = () => {
  const [isNewCourseWizardOpen, setIsNewCourseWizardOpen] = useState(false);
  const [isContentEditorOpen, setIsContentEditorOpen] = useState(false);
  const [contentEditorDraftId, setContentEditorDraftId] = useState<string | null>(null);
  const [contentEditorOrigin, setContentEditorOrigin] = useState<ContentEditorOrigin | null>(null);

  const openWizard = () => setIsNewCourseWizardOpen(true);
  const closeWizard = () => setIsNewCourseWizardOpen(false);

  const handleWizardComplete = (draftId: string) => {
    setIsNewCourseWizardOpen(false);
    setContentEditorDraftId(draftId);
    setContentEditorOrigin('wizard');
    setIsContentEditorOpen(true);
  };

  const closeContentEditor = () => {
    setIsContentEditorOpen(false);
    setContentEditorDraftId(null);
    setContentEditorOrigin(null);
  };

  // FR-31 (CourseWizard PRD S4.11): the "resume a course" list's own entry point into the editor
  // -- same isContentEditorOpen/contentEditorDraftId state handleWizardComplete already drives,
  // just reached from an existing course id instead of a freshly-created one, and rendered inline
  // in MyCoursesSection (origin: 'resume') instead of at the top of the page (origin: 'wizard').
  const openContentEditorForCourse = (courseId: string) => {
    setContentEditorDraftId(courseId);
    setContentEditorOrigin('resume');
    setIsContentEditorOpen(true);
  };

  return {
    isNewCourseWizardOpen,
    isContentEditorOpen,
    contentEditorDraftId,
    contentEditorOrigin,
    openWizard,
    closeWizard,
    handleWizardComplete,
    closeContentEditor,
    openContentEditorForCourse,
  };
};

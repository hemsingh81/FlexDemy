import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { Course } from '../../types';
import { ReaderCanvas } from './ReaderCanvas';
import { PlaybackControls } from './PlaybackControls';
import { ScratchpadPanel } from './ScratchpadPanel';
import { FocusSessionTimer } from './FocusSessionTimer';
import { FlashcardsModal } from './FlashcardsModal';
import { CourseReviewModal } from '../CourseOverview/CourseReviewModal';
import { ttsManager } from '../../lib/tts';
import { PageReadingPane } from './PageReadingPane';
import { CoursePlayerHeader } from './CoursePlayerHeader';
import { CoursePlayerSidebar } from './CoursePlayerSidebar';
import { ExportSummaryModal } from './ExportSummaryModal';
import { useLessonNavigation } from './useLessonNavigation';
import { useNarrationPlayback } from './useNarrationPlayback';
import { useLessonSummaryExport } from './useLessonSummaryExport';
import { useCourseContentNavigation } from './useCourseContentNavigation';

interface CoursePlayerProps {
  course: Course;
  initialLessonId?: string;
  onBackToDashboard: () => void;
  onOpenAssignment: (assignmentId: string) => void;
  onCompleteLesson: (courseId: string, lessonId: string) => void;
}

export const CoursePlayer: React.FC<CoursePlayerProps> = ({
  course,
  initialLessonId,
  onBackToDashboard,
  onOpenAssignment,
  onCompleteLesson,
}) => {
  const {
    currentLesson,
    sentences,
    currentSentenceIndex,
    setCurrentSentenceIndex,
    goToLesson,
    handleSkipNext,
    handleSkipPrev,
    advanceToNextLesson,
  } = useLessonNavigation(course, initialLessonId);

  const {
    isPlaying,
    setIsPlaying,
    rate,
    setRate,
    pitch,
    setPitch,
    isMuted,
    setIsMuted,
    autoScroll,
    setAutoScroll,
    selectedVoiceName,
    setSelectedVoiceName,
    voices,
  } = useNarrationPlayback(sentences, currentSentenceIndex, setCurrentSentenceIndex);

  const { generateLessonSummaryMarkdown, handleDownloadMarkdown, handleCopyMarkdown, isCopied } =
    useLessonSummaryExport(course, currentLesson, sentences);

  const { outline, selectedPageId, setSelectedPageId, selectedPage, isLoadingPage, pageLoadFailed } = useCourseContentNavigation(course.id);

  // Export Summary modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Scratchpad Side-Panel state
  const [isScratchpadOpen, setIsScratchpadOpen] = useState<boolean>(false);
  const [scratchpadParaIndex, setScratchpadParaIndex] = useState<number | null>(null);

  // Focus Timer, Flashcards & Course Review Modal state
  const [isFocusTimerOpen, setIsFocusTimerOpen] = useState<boolean>(false);
  const [isFlashcardsOpen, setIsFlashcardsOpen] = useState<boolean>(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);

  // Sidebar toggle
  const [showSidebar] = useState<boolean>(true);

  const handleCompleteLesson = () => {
    // Trigger subtle celebratory confetti animation
    confetti({
      particleCount: 65,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#143358', '#BA5012', '#179765', '#3B82F6', '#F59E0B'],
    });
    onCompleteLesson(course.id, currentLesson.id);
    advanceToNextLesson();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">

      <CoursePlayerHeader
        course={course}
        currentLesson={currentLesson}
        isScratchpadOpen={isScratchpadOpen}
        onBackToDashboard={onBackToDashboard}
        onOpenFocusTimer={() => setIsFocusTimerOpen(true)}
        onOpenReviewModal={() => setIsReviewModalOpen(true)}
        onToggleScratchpad={() => {
          setScratchpadParaIndex(currentSentenceIndex);
          setIsScratchpadOpen(!isScratchpadOpen);
        }}
        onOpenFlashcards={() => setIsFlashcardsOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenAssignment={onOpenAssignment}
        onCompleteLesson={handleCompleteLesson}
      />

      {/* Main Body Grid */}
      <div className="flex-1 flex overflow-hidden relative">

        <CoursePlayerSidebar
          show={showSidebar}
          course={course}
          currentLessonId={currentLesson.id}
          onSelectLesson={(lessonId) => {
            goToLesson(lessonId);
            setIsPlaying(false);
          }}
          outline={outline}
          selectedPageId={selectedPageId}
          onSelectPage={setSelectedPageId}
        />

        {/* Central Reader Canvas */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 sm:p-8 bg-slate-50">

          {selectedPageId ? (
            // Keyed by page id so switching between two pages never shows stale content from the
            // previous selection mid-render.
            <PageReadingPane key={selectedPageId} courseId={course.id} page={selectedPage} isLoading={isLoadingPage} failed={pageLoadFailed} />
          ) : (
          <div className="w-full max-w-4xl mx-auto">
            <ReaderCanvas
              sentences={sentences}
              drilldowns={currentLesson.drilldowns}
              activeSentenceIndex={currentSentenceIndex}
              onSelectSentence={(index) => {
                setCurrentSentenceIndex(index);
                if (isPlaying) {
                  ttsManager.cancel();
                }
              }}
              onOpenScratchpadForParagraph={(index) => {
                setScratchpadParaIndex(index);
                setIsScratchpadOpen(true);
              }}
            />
          </div>
          )}

        </main>

        {/* Side-Panel Scratchpad Drawer */}
        <ScratchpadPanel
          course={course}
          currentLesson={currentLesson}
          currentModule={course.modules.find((m) => m.lessons.some((l) => l.id === currentLesson.id))}
          currentParagraphIndex={currentSentenceIndex}
          initialParagraphIndex={scratchpadParaIndex}
          isOpen={isScratchpadOpen}
          onClose={() => setIsScratchpadOpen(false)}
          onSelectParagraph={(index) => {
            setCurrentSentenceIndex(index);
          }}
        />

      </div>

      {/* Sticky Bottom Playback Controls */}
      <PlaybackControls
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onSkipNext={handleSkipNext}
        onSkipPrev={handleSkipPrev}
        rate={rate}
        onRateChange={setRate}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
        autoScroll={autoScroll}
        onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
        voices={voices}
        selectedVoiceName={selectedVoiceName}
        onVoiceChange={setSelectedVoiceName}
        currentSentenceIndex={currentSentenceIndex}
        totalSentences={sentences.length}
      />

      {/* Export Summary Modal */}
      <ExportSummaryModal
        isOpen={isExportModalOpen}
        lessonTitle={currentLesson.title}
        markdownContent={isExportModalOpen ? generateLessonSummaryMarkdown() : ''}
        isCopied={isCopied}
        onClose={() => setIsExportModalOpen(false)}
        onCopy={handleCopyMarkdown}
        onDownload={handleDownloadMarkdown}
      />

      {/* AI Flashcards Interactive Modal */}
      <FlashcardsModal
        isOpen={isFlashcardsOpen}
        onClose={() => setIsFlashcardsOpen(false)}
        lessonTitle={currentLesson.title}
        sentences={sentences}
        drilldowns={currentLesson.drilldowns}
      />

      {/* Focus Session Timer Modal */}
      <FocusSessionTimer
        isOpen={isFocusTimerOpen}
        onClose={() => setIsFocusTimerOpen(false)}
        moduleTitle={
          course.modules.find((m) => m.lessons.some((l) => l.id === currentLesson.id))?.title ||
          course.title
        }
      />

      {/* Course Review & Rating Modal */}
      <CourseReviewModal
        course={course}
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
      />

    </div>
  );
};

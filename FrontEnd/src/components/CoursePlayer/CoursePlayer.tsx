import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Layers,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  Award,
  Play,
  Volume2,
  FileCheck2,
  FileText,
  Download,
  Copy,
  X,
  Check,
  NotebookPen,
  Timer,
  Star,
} from 'lucide-react';
import { Course, Lesson } from '../../types';
import { ReaderCanvas } from './ReaderCanvas';
import { PlaybackControls } from './PlaybackControls';
import { DrilldownPanel } from './DrilldownPanel';
import { ScratchpadPanel } from './ScratchpadPanel';
import { FocusSessionTimer } from './FocusSessionTimer';
import { FlashcardsModal } from './FlashcardsModal';
import { CourseReviewModal } from '../CourseReviewModal';
import { saveProgressOffline } from '../../lib/offlineStorage';
import { ttsManager } from '../../lib/tts';

interface CoursePlayerProps {
  course: Course;
  initialLessonId?: string;
  onBackToDashboard: () => void;
  onOpenAssignment: (assignmentId: string) => void;
  fontSize: number;
  highContrast: boolean;
  onCompleteLesson: (courseId: string, lessonId: string) => void;
}

export const CoursePlayer: React.FC<CoursePlayerProps> = ({
  course,
  initialLessonId,
  onBackToDashboard,
  onOpenAssignment,
  fontSize,
  highContrast,
  onCompleteLesson,
}) => {
  // Determine current lesson
  const allLessons = course.modules.flatMap((m) => m.lessons);
  const [currentLessonId, setCurrentLessonId] = useState<string>(
    initialLessonId || allLessons[0]?.id || ''
  );
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);

  // Export Summary modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [rate, setRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Active Drilldown Drawer topic key
  const [activeDrillTopic, setActiveDrillTopic] = useState<string | null>(null);

  // Scratchpad Side-Panel state
  const [isScratchpadOpen, setIsScratchpadOpen] = useState<boolean>(false);
  const [scratchpadParaIndex, setScratchpadParaIndex] = useState<number | null>(null);

  // Focus Timer, Flashcards & Course Review Modal state
  const [isFocusTimerOpen, setIsFocusTimerOpen] = useState<boolean>(false);
  const [isFlashcardsOpen, setIsFlashcardsOpen] = useState<boolean>(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);

  // Sidebar toggle
  const [showSidebar, setShowSidebar] = useState<boolean>(true);

  // Save lesson reading progress locally for offline resilience
  useEffect(() => {
    if (course?.id && currentLessonId) {
      saveProgressOffline(course.id, {
        lastLessonId: currentLessonId,
        lastSentenceIndex: currentSentenceIndex,
      });
    }
  }, [course?.id, currentLessonId, currentSentenceIndex]);

  const currentLesson: Lesson =
    allLessons.find((l) => l.id === currentLessonId) || allLessons[0];
  const sentences = currentLesson?.sentences || [];

  // Load voices on mount
  useEffect(() => {
    const avail = ttsManager.getAvailableVoices();
    setVoices(avail);
  }, []);

  // Speech Narration Trigger effect
  useEffect(() => {
    if (!isPlaying || isMuted || sentences.length === 0) {
      ttsManager.cancel();
      return;
    }

    const currentSentence = sentences[currentSentenceIndex];
    if (!currentSentence) return;

    ttsManager.speak(currentSentence.text, {
      rate: rate,
      pitch: pitch,
      voiceName: selectedVoiceName,
      onEnd: () => {
        // Automatically advance to next sentence if autoScroll is enabled
        if (autoScroll && currentSentenceIndex < sentences.length - 1) {
          setCurrentSentenceIndex((prev) => prev + 1);
        } else {
          setIsPlaying(false);
        }
      },
      onError: () => {
        setIsPlaying(false);
      },
    });

    return () => {
      ttsManager.cancel();
    };
  }, [isPlaying, currentSentenceIndex, isMuted, rate, pitch, selectedVoiceName, autoScroll]);

  // Handle sentence navigation
  const handleSkipNext = () => {
    if (currentSentenceIndex < sentences.length - 1) {
      setCurrentSentenceIndex((prev) => prev + 1);
    }
  };

  const handleSkipPrev = () => {
    if (currentSentenceIndex > 0) {
      setCurrentSentenceIndex((prev) => prev - 1);
    }
  };

  const activeDrilldownData = activeDrillTopic
    ? currentLesson.drilldowns[activeDrillTopic]
    : null;

  // Generate comprehensive lesson Markdown notes including sentences and drilldowns
  const generateLessonSummaryMarkdown = () => {
    let md = `# ${course.title} — Comprehensive Study Notes\n`;
    md += `## Lesson: ${currentLesson.title}\n`;
    md += `*Generated via LearnSphere AI Educational Platform on ${new Date().toLocaleDateString()}*\n\n`;
    md += `---\n\n`;

    md += `### 📖 Core Paragraph Breakdown\n\n`;
    sentences.forEach((s, idx) => {
      md += `**Paragraph ${idx + 1}:** ${s.text}\n\n`;
      if (s.mathLaTeX) {
        md += `\`\`\`latex\n${s.mathLaTeX}\n\`\`\`\n\n`;
      }
    });

    if (currentLesson.drilldowns && Object.keys(currentLesson.drilldowns).length > 0) {
      md += `---\n\n### 🔬 5-Level Deep Concept Explanations & Examples\n\n`;
      Object.entries(currentLesson.drilldowns).forEach(([topicKey, td]) => {
        md += `#### Concept: ${td.title}\n`;
        md += `*${td.overview}*\n\n`;

        td.levels.forEach((lvl) => {
          md += `##### Level ${lvl.level}: ${lvl.title}\n`;
          md += `**${lvl.subtitle}**\n\n`;
          md += `${lvl.content}\n\n`;

          if (lvl.keyPoints && lvl.keyPoints.length > 0) {
            md += `**Core Takeaways:**\n`;
            lvl.keyPoints.forEach((pt) => {
              md += `- ${pt}\n`;
            });
            md += `\n`;
          }

          if (lvl.examples && lvl.examples.length > 0) {
            md += `**Practical Worked Examples:**\n`;
            lvl.examples.forEach((ex, exIdx) => {
              md += `\n*Example ${exIdx + 1}: ${ex.title} (${ex.difficulty})*\n`;
              md += `- **Problem:** ${ex.problem}\n`;
              md += `- **Step-by-step:** ${ex.stepByStepSolution.join(' -> ')}\n`;
              md += `- **Final Answer:** ${ex.finalAnswer}\n`;
            });
            md += `\n`;
          }
        });
      });
    }

    md += `\n---\n*End of Summary Notes for ${currentLesson.title}*\n`;
    return md;
  };

  const handleDownloadMarkdown = () => {
    const content = generateLessonSummaryMarkdown();
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${currentLesson.title.toLowerCase().replace(/\s+/g, '_')}_summary_notes.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyMarkdown = () => {
    const content = generateLessonSummaryMarkdown();
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-2xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToDashboard}
            className="p-2 rounded-xl bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-700 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-wider">
              {course.title}
            </span>
            <h1 className="text-base font-bold text-slate-900 line-clamp-1">
              {currentLesson.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Focus Session Timer Button */}
          <button
            onClick={() => setIsFocusTimerOpen(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 bg-[#FAF7EC] hover:bg-[#143358] text-[#143358] hover:text-white border border-[#E1DED4] transition-all cursor-pointer"
            title="Start Focus Session Timer with circular progress ring"
          >
            <Timer className="w-4 h-4 text-[#EC7B38]" />
            <span className="hidden md:inline">Focus Timer</span>
          </button>

          {/* Rate & Review Course Button */}
          <button
            onClick={() => setIsReviewModalOpen(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 bg-[#FAF7EC] hover:bg-amber-500 text-amber-800 hover:text-white border border-amber-200/80 transition-all cursor-pointer"
            title="Leave a 5-star rating & review for this course"
          >
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="hidden lg:inline">Review Course</span>
          </button>

          {/* Scratchpad Side-Panel Toggle Button */}
          <button
            onClick={() => {
              setScratchpadParaIndex(currentSentenceIndex);
              setIsScratchpadOpen(!isScratchpadOpen);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer ${
              isScratchpadOpen
                ? 'bg-[#143358] text-white shadow-md'
                : 'bg-[#FAF7EC] hover:bg-[#143358] text-[#143358] hover:text-white border border-[#E1DED4]'
            }`}
            title="Open personal lesson scratchpad & notes panel"
          >
            <NotebookPen className="w-4 h-4 text-[#EC7B38]" />
            <span>Scratchpad Notes</span>
          </button>

          {/* AI Flashcards Button */}
          <button
            onClick={() => setIsFlashcardsOpen(true)}
            className="px-3 py-1.5 bg-[#FAF7EC] hover:bg-[#EC7B38] hover:text-white text-[#142030] font-bold text-xs rounded-xl border border-[#E1DED4] flex items-center space-x-1.5 transition-all cursor-pointer shadow-2xs"
            title="Generate AI Interactive Flashcards from current lesson content"
          >
            <Sparkles className="w-4 h-4 text-[#EC7B38]" />
            <span>Generate Flashcards</span>
          </button>

          {/* Export Summary Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-3 py-1.5 bg-[#FAF7EC] hover:bg-[#143358] hover:text-white text-[#142030] border border-[#E1DED4] rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all shadow-2xs cursor-pointer"
            title="Export full lesson summary notes including all drilldowns and examples"
          >
            <FileText className="w-4 h-4 text-[#143358]" />
            <span className="hidden sm:inline">Export Summary</span>
          </button>

          {currentLesson.assignment && (
            <button
              onClick={() => onOpenAssignment(currentLesson.assignment!.id)}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all"
            >
              <FileCheck2 className="w-4 h-4 text-amber-600" />
              <span>Take Quiz</span>
            </button>
          )}

          <button
            onClick={() => {
              // Trigger subtle celebratory confetti animation
              confetti({
                particleCount: 65,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#143358', '#EC7B38', '#179765', '#3B82F6', '#F59E0B'],
              });
              onCompleteLesson(course.id, currentLesson.id);
              // Advance to next lesson if available
              const currentIndex = allLessons.findIndex((l) => l.id === currentLesson.id);
              if (currentIndex < allLessons.length - 1) {
                setCurrentLessonId(allLessons[currentIndex + 1].id);
                setCurrentSentenceIndex(0);
              }
            }}
            className="px-4 py-2 bg-[#143358] hover:bg-[#143358]/90 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4 text-[#179765]" />
            <span>Mark Complete & Next</span>
          </button>
        </div>
      </header>

      {/* Main Body Grid */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Syllabus Accordion Sidebar */}
        <aside
          className={`${
            showSidebar ? 'w-80' : 'w-0'
          } flex-shrink-0 bg-white border-r border-slate-200 transition-all duration-300 overflow-y-auto hidden md:block`}
        >
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Course Syllabus</span>
            </h2>
          </div>

          <div className="p-3 space-y-4">
            {course.modules.map((mod) => (
              <div key={mod.id} className="space-y-1">
                <p className="text-xs font-bold text-slate-800 px-2 py-1">
                  {mod.title}
                </p>
                <div className="space-y-1">
                  {mod.lessons.map((lesson) => {
                    const isCurrent = lesson.id === currentLesson.id;

                    return (
                      <button
                        key={lesson.id}
                        onClick={() => {
                          setCurrentLessonId(lesson.id);
                          setCurrentSentenceIndex(0);
                          setIsPlaying(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between ${
                          isCurrent
                            ? 'bg-indigo-50 text-indigo-800 font-bold border border-indigo-200/80 shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          {lesson.isCompleted ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          ) : (
                            <BookOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          )}
                          <span className="truncate">{lesson.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 flex-shrink-0 ml-1 font-semibold">
                          {lesson.durationMinutes}m
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Central Reader Canvas */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 max-w-4xl mx-auto w-full bg-slate-50">
          
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
            onOpenDrilldown={(topicKey) => setActiveDrillTopic(topicKey)}
            onOpenScratchpadForParagraph={(index) => {
              setScratchpadParaIndex(index);
              setIsScratchpadOpen(true);
            }}
            fontSize={fontSize}
            highContrast={highContrast}
          />

        </main>

        {/* Slide-over Drilldown Drawer */}
        {activeDrilldownData && (
          <DrilldownPanel
            drilldown={activeDrilldownData}
            onClose={() => setActiveDrillTopic(null)}
            onReturnToLesson={() => setActiveDrillTopic(null)}
          />
        )}

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
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-indigo-100 text-indigo-700 border border-indigo-200">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Export Summary & Notes</h3>
                  <p className="text-xs text-slate-500">{currentLesson.title} · Complete Aggregated Notes</p>
                </div>
              </div>

              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Previews formatted text */}
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-slate-800 leading-relaxed bg-slate-50/80 whitespace-pre-wrap select-all border-b border-slate-200">
              {generateLessonSummaryMarkdown()}
            </div>

            {/* Modal Footer Controls */}
            <div className="p-4 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Includes sentences, LaTeX equations, 5-level drilldowns, and worked examples.
              </span>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <button
                  onClick={handleCopyMarkdown}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center space-x-1.5 transition-all shadow-2xs"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-600">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Markdown</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadMarkdown}
                  className="px-4 py-2 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download .md File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

import React, { useState } from 'react';
import katex from 'katex';
import {
  X,
  Sparkles,
  CheckCircle2,
  Plus,
  ArrowLeft,
  BookOpen,
  Lock,
  PenLine,
} from 'lucide-react';
import { ExampleItem } from '../../types';
import { useDrilldownContent } from './useDrilldownContent';
import { ExampleCard } from './ExampleCard';
import { WaysMenu } from './WaysMenu';

interface DrilldownPanelProps {
  courseId: string;
  nodeId: string;
  onClose: () => void;
  onReturnToLesson: () => void;
}

// Story 3.1/Task 4: brand-remediated (UX-DR10 -- swept off the pre-existing indigo/emerald/amber
// off-brand classes to ink-navy/signal-green tokens, in this same pass, not deferred) and switched
// from a prop-supplied `drilldown: TopicDrilldown` to the stable useDrilldownContent(courseId,
// nodeId) hook (AC#5), so Phase B (Story 3.5) swaps the mock behind it without this component
// changing.
export const DrilldownPanel: React.FC<DrilldownPanelProps> = ({ courseId, nodeId, onClose, onReturnToLesson }) => {
  const { data: levels, isLoading, unlockedLevel, revealNextLevel } = useDrilldownContent(courseId, nodeId);
  const [selectedLevelNum, setSelectedLevelNum] = useState<number>(1);
  const [expandedSolutions, setExpandedSolutions] = useState<Record<string, boolean>>({});
  const [customExamples, setCustomExamples] = useState<ExampleItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  // Story 3.2/Task 3: toggled by the UX-DR11 nudge below -- Story 3.1 only rendered static nudge
  // text anticipating this; this story makes it real.
  const [isWaysOpen, setIsWaysOpen] = useState(false);

  const currentLevelData = levels?.find((l) => l.level === selectedLevelNum) ?? levels?.[0] ?? null;

  const renderLaTeX = (latexStr: string) => {
    try {
      return katex.renderToString(latexStr, { throwOnError: false, displayMode: true });
    } catch {
      return latexStr;
    }
  };

  const toggleSolution = (id: string) => {
    setExpandedSolutions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Pre-existing fake-AI stub (generates an EXTRA example, a different mechanic from the 5-level
  // explanation this story builds) -- left as-is, unmodified, per this story's own Dev Notes.
  const handleGenerateExample = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const newEx: ExampleItem = {
        id: `gen_${Date.now()}`,
        title: `Dynamic On-The-Fly Example #${customExamples.length + 1}`,
        problem: `Given probability amplitude alpha = cos(pi/${4 + customExamples.length}) and beta = sin(pi/${4 + customExamples.length}), verify probability magnitude equality.`,
        stepByStepSolution: [
          `Step 1: Compute cos^2(pi/${4 + customExamples.length}) and sin^2(pi/${4 + customExamples.length}).`,
          'Step 2: Apply Pythagorean trigonometric identity cos^2(x) + sin^2(x) = 1.',
          'Step 3: Total probability is verified to be exactly 100%.',
        ],
        finalAnswer: 'Probability is normalized to 1.0 (100%)',
        difficulty: customExamples.length % 2 === 0 ? 'Medium' : 'Hard',
      };
      setCustomExamples((prev) => [...prev, newEx]);
      setIsGenerating(false);
    }, 600);
  };

  const allExamples = [...(currentLevelData?.examples ?? []), ...customExamples];

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-all text-slate-800">
      {/* Header */}
      <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-[#143358] text-white shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-[#143358]/10 text-[#143358] border border-[#143358]/20">
                5-Level Deep Drilldown
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">Drill-Down</h2>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onReturnToLesson}
            className="px-3 py-1.5 bg-[#FAF7EC] hover:bg-[#143358]/10 text-[#143358] font-bold text-xs rounded-xl border border-[#E1DED4] flex items-center space-x-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Lesson</span>
          </button>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="p-2 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 5-Level Progressive Depth Indicator Tabs */}
      <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/50 overflow-x-auto">
        <div className="flex items-center space-x-2 min-w-max">
          {[1, 2, 3, 4, 5].map((lvl) => {
            const levelInfo = levels?.find((l) => l.level === lvl);
            const isSelected = selectedLevelNum === lvl;
            const isLocked = lvl > unlockedLevel;

            return (
              <button
                key={lvl}
                onClick={() => {
                  if (isLocked) return;
                  setSelectedLevelNum(lvl);
                }}
                disabled={isLocked}
                aria-disabled={isLocked}
                aria-current={isSelected ? 'true' : undefined}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 border ${
                  isLocked
                    ? 'opacity-40 cursor-not-allowed bg-white text-slate-400 border-slate-200'
                    : isSelected
                      ? 'bg-[#143358] text-white border-[#143358] shadow-md cursor-pointer'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer'
                }`}
              >
                {isLocked ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <span
                    className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-extrabold ${
                      isSelected ? 'bg-white text-[#143358]' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {lvl}
                  </span>
                )}
                <span>L{lvl}: {levelInfo ? levelInfo.title : `Level ${lvl}`}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Body Content */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {isLoading && <p className="text-sm text-slate-500">Loading…</p>}

        {!isLoading && currentLevelData && (
          <>
            {/* Level Title & Subtitle, with tutor-override indicator (AC#3) */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-extrabold uppercase text-[#143358] tracking-wider">{currentLevelData.title}</p>
                {currentLevelData.isOverridden && (
                  <span
                    className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#179765]/10 text-[#179765] flex items-center gap-1"
                    aria-label="Tutor-edited"
                  >
                    <PenLine className="w-3 h-3" />
                    Tutor-edited
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-900">{currentLevelData.subtitle}</h3>
            </div>

            {/* Detailed Explanation Text -- override content when isOverridden, never AI content in its place */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm leading-relaxed text-slate-800">
              {currentLevelData.content}
            </div>

            {/* Key Takeaways / Points */}
            {currentLevelData.keyPoints.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#179765]" />
                  <span>Core Takeaways</span>
                </h4>
                <div className="space-y-1.5">
                  {currentLevelData.keyPoints.map((point, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50 text-xs text-slate-800 border border-slate-200 flex items-start space-x-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#143358] mt-1.5 flex-shrink-0"></span>
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Math Formulas if available */}
            {currentLevelData.mathFormulas && currentLevelData.mathFormulas.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Mathematical Expressions</h4>
                {currentLevelData.mathFormulas.map((f, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-100 text-slate-900 overflow-x-auto text-center border border-slate-200 shadow-2xs"
                    dangerouslySetInnerHTML={{ __html: renderLaTeX(f) }}
                  />
                ))}
              </div>
            )}

            {/* Explain more -- the only mechanism that unlocks the next level (AC#1), with a
                UX-DR11 nudge toward the Ways menu (Story 3.2 builds the real menu; this story only
                renders the static nudge text). */}
            <div className="flex items-center justify-between pt-2">
              {unlockedLevel < 5 ? (
                <button
                  onClick={revealNextLevel}
                  className="px-4 py-2 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <span>Explain more</span>
                </button>
              ) : (
                <span className="text-xs text-slate-500">All 5 levels unlocked</span>
              )}
              <span className="text-xs text-slate-500">
                Not clicking?{' '}
                <button
                  onClick={() => setIsWaysOpen((prev) => !prev)}
                  aria-expanded={isWaysOpen}
                  className="font-bold text-[#143358] hover:underline cursor-pointer"
                >
                  Try a different explanation
                </button>
              </span>
            </div>

            {isWaysOpen && <WaysMenu courseId={courseId} nodeId={nodeId} />}

            {/* Interactive On-The-Fly Examples */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-[#143358]" />
                    <span>Interactive Examples ({allExamples.length})</span>
                  </h4>
                  <p className="text-xs text-slate-500">Request extra step-by-step examples repeatedly without losing lesson context.</p>
                </div>

                <button
                  onClick={handleGenerateExample}
                  disabled={isGenerating}
                  className="px-3.5 py-2 bg-[#BA5012] hover:bg-[#BA5012]/90 text-white rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isGenerating ? 'Generating...' : 'Generate Example'}</span>
                </button>
              </div>

              <div className="space-y-3">
                {allExamples.map((ex) => (
                  <ExampleCard
                    key={ex.id}
                    example={ex}
                    isExpanded={!!expandedSolutions[ex.id]}
                    onToggle={() => toggleSolution(ex.id)}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer Return Button */}
      <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
        <span className="text-xs text-slate-500">Original reading position bookmarked</span>
        <button
          onClick={onReturnToLesson}
          className="px-5 py-2.5 bg-[#143358] hover:bg-[#143358]/90 text-white font-bold text-xs rounded-xl shadow-md flex items-center space-x-2 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Original Lesson</span>
        </button>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import katex from 'katex';
import {
  X,
  Sparkles,
  Layers,
  CheckCircle2,
  HelpCircle,
  Plus,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from 'lucide-react';
import { TopicDrilldown, ExampleItem } from '../../types';

interface DrilldownPanelProps {
  drilldown: TopicDrilldown;
  onClose: () => void;
  onReturnToLesson: () => void;
}

export const DrilldownPanel: React.FC<DrilldownPanelProps> = ({
  drilldown,
  onClose,
  onReturnToLesson,
}) => {
  const [selectedLevelNum, setSelectedLevelNum] = useState<number>(1);
  const [expandedSolutions, setExpandedSolutions] = useState<Record<string, boolean>>({});
  const [customExamples, setCustomExamples] = useState<ExampleItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentLevelData = drilldown.levels.find((l) => l.level === selectedLevelNum) || drilldown.levels[0];

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

  // Generate an extra dynamic example on the fly
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

  const allExamples = [...currentLevelData.examples, ...customExamples];

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
              <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                5-Level Deep Drilldown
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {drilldown.title}
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onReturnToLesson}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 flex items-center space-x-1 transition-colors"
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
            const levelInfo = drilldown.levels.find((l) => l.level === lvl);
            const isSelected = selectedLevelNum === lvl;

            return (
              <button
                key={lvl}
                onClick={() => setSelectedLevelNum(lvl)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 border cursor-pointer ${
                  isSelected
                    ? 'bg-[#143358] text-white border-[#143358] shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-extrabold ${
                  isSelected ? 'bg-white text-indigo-700' : 'bg-slate-100 text-slate-700'
                }`}>
                  {lvl}
                </span>
                <span>L{lvl}: {levelInfo ? levelInfo.title.split(':')[1]?.trim() || levelInfo.title : `Level ${lvl}`}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Body Content */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        
        {/* Level Title & Subtitle */}
        <div className="space-y-1">
          <p className="text-xs font-extrabold uppercase text-indigo-600 tracking-wider">
            {currentLevelData.title}
          </p>
          <h3 className="text-xl font-bold text-slate-900">
            {currentLevelData.subtitle}
          </h3>
        </div>

        {/* Detailed Explanation Text */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm leading-relaxed text-slate-800">
          {currentLevelData.content}
        </div>

        {/* Key Takeaways / Points */}
        {currentLevelData.keyPoints.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Core Takeaways</span>
            </h4>
            <div className="space-y-1.5">
              {currentLevelData.keyPoints.map((point, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 text-xs text-slate-800 border border-slate-200 flex items-start space-x-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 flex-shrink-0"></span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Math Formulas if available */}
        {currentLevelData.mathFormulas && currentLevelData.mathFormulas.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Mathematical Expressions
            </h4>
            {currentLevelData.mathFormulas.map((f, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-slate-100 text-slate-900 overflow-x-auto text-center border border-slate-200 shadow-2xs"
                dangerouslySetInnerHTML={{ __html: renderLaTeX(f) }}
              />
            ))}
          </div>
        )}

        {/* Interactive On-The-Fly Examples */}
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
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
            {allExamples.map((ex) => {
              const isExpanded = !!expandedSolutions[ex.id];

              return (
                <div key={ex.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{ex.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
                      {ex.difficulty}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium">
                    Problem: {ex.problem}
                  </p>

                  <button
                    onClick={() => toggleSolution(ex.id)}
                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center space-x-1"
                  >
                    <span>{isExpanded ? 'Hide Step-by-Step Solution' : 'Show Step-by-Step Solution'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {isExpanded && (
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs space-y-2 shadow-2xs">
                      <p className="font-bold text-slate-900">Solution Steps:</p>
                      <ul className="space-y-1 text-slate-700 pl-2">
                        {ex.stepByStepSolution.map((step, idx) => (
                          <li key={idx}>• {step}</li>
                        ))}
                      </ul>
                      <div className="pt-2 border-t border-slate-100 text-emerald-700 font-bold">
                        Final Answer: {ex.finalAnswer}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

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

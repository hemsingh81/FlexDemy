import React from 'react';
import { Sparkles, ChevronDown, ChevronUp, NotebookPen } from 'lucide-react';
import { Sentence, TopicDrilldown } from '../../types';
import { renderLatex } from './renderLatex';
import { InlineDrilldownDetail } from './InlineDrilldownDetail';
import { InlineDrilldownState } from './useInlineDrilldownState';

interface SentenceCardProps {
  sentence: Sentence;
  index: number;
  isActive: boolean;
  activeRef: React.RefObject<HTMLDivElement | null> | null;
  drilldowns: Record<string, TopicDrilldown>;
  onSelectSentence: (index: number) => void;
  onOpenScratchpadForParagraph?: (index: number) => void;
  drilldownState: InlineDrilldownState;
}

// Extracted from ReaderCanvas.tsx's per-sentence render body: a single reader paragraph card,
// with its header badge/note button/drill-down toggle, the sentence text, optional LaTeX
// formula and pendulum diagram, and (when expanded) its inline 5-level drill-down detail.
export const SentenceCard: React.FC<SentenceCardProps> = ({
  sentence,
  index,
  isActive,
  activeRef,
  drilldowns,
  onSelectSentence,
  onOpenScratchpadForParagraph,
  drilldownState,
}) => {
  const hasDrill = !!(sentence.hasDrilldown && sentence.drilldownTopic && drilldowns[sentence.drilldownTopic]);
  const topicKey = sentence.drilldownTopic || '';
  const isDrillExpanded = drilldownState.expandedSentenceId === sentence.id;
  const topicData = hasDrill ? drilldowns[topicKey] : null;

  // Selected level for this topic (1..5)
  const currentLevelNum = drilldownState.selectedLevels[topicKey] || 1;
  const currentLevelData = topicData?.levels?.find((l) => l.level === currentLevelNum) || topicData?.levels?.[0];

  // All examples (base + dynamic)
  const baseExamples = currentLevelData?.examples || [];
  const extraCustom = drilldownState.customExamplesMap[topicKey] || [];
  const combinedExamples = [...baseExamples, ...extraCustom];

  // LLM State for active level
  const levelKey = `${topicKey}_L${currentLevelNum}`;
  const chatHistory = drilldownState.llmChatHistoryMap[levelKey] || [];
  const isRecording = !!drilldownState.isRecordingMap[levelKey];
  const isAiThinking = !!drilldownState.isAiThinkingMap[levelKey];

  return (
    <div
      ref={activeRef}
      onClick={() => onSelectSentence(index)}
      tabIndex={0}
      role="button"
      aria-label={`Sentence ${index + 1}: ${sentence.text}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelectSentence(index);
        }
      }}
      className={`p-5 sm:p-6 rounded-3xl transition-all border ${
        isActive
          ? 'bg-[#FAF7EC] border-[#BA5012] shadow-md ring-2 ring-[#BA5012]/30 active-sentence-highlight'
          : 'bg-white border-[#E1DED4] hover:bg-[#FCFAF4] hover:border-slate-300 shadow-2xs'
      }`}
    >
      {/* Sentence Header & Action Badge at FAR RIGHT SIDE */}
      <div className="flex items-center flex-wrap justify-between gap-3 mb-3 w-full">
        <div className="flex items-center space-x-2">
          <span
            className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
              isActive ? 'bg-[#143358] text-white shadow-2xs' : 'bg-[#FAF7EC] text-[#5E6A79] border border-[#E1DED4]'
            }`}
          >
            Paragraph {index + 1} {isActive ? '— Currently Playing' : ''}
          </span>

          {onOpenScratchpadForParagraph && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenScratchpadForParagraph(index);
              }}
              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-[#FAF7EC] hover:bg-[#143358] text-[#143358] hover:text-white border border-[#E1DED4] text-[10px] font-bold transition-all cursor-pointer"
              title={`Add scratchpad note for Paragraph ${index + 1}`}
            >
              <NotebookPen className="w-3 h-3 text-[#BA5012]" />
              <span>Note</span>
            </button>
          )}
        </div>

        {/* Drilldown control MUST BE END and RIGHT HAND SIDE */}
        {hasDrill && (
          <div className="ml-auto flex items-center">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                drilldownState.toggleDrilldownInline(sentence.id);
              }}
              className={`inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold shadow-sm transition-all transform hover:scale-105 ${
                isDrillExpanded
                  ? 'bg-[#143358] text-white ring-2 ring-[#143358]/30'
                  : 'bg-[#BA5012] hover:bg-[#BA5012]/90 text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isDrillExpanded ? 'Close Drill Down' : 'Drill Down (5 Levels)'}</span>
              {isDrillExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 ml-1" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              )}
            </button>
          </div>
        )}
      </div>

      {/* Primary Sentence Text */}
      <p className="leading-relaxed font-normal text-slate-800">
        {sentence.text}
      </p>

      {/* LaTeX Math Formula Rendering */}
      {sentence.mathLaTeX && (
        <div
          className="my-4 p-4 rounded-2xl bg-slate-100 text-slate-900 overflow-x-auto text-center border border-slate-200 shadow-2xs"
          dangerouslySetInnerHTML={{ __html: renderLatex(sentence.mathLaTeX) }}
        />
      )}

      {/* Interactive Bloch Sphere Simulation */}
      {sentence.diagramType === 'pendulum' && (
        <div className="mt-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 text-white space-y-3 shadow-md">
          <div className="flex items-center justify-between text-xs text-indigo-400 font-bold uppercase tracking-wider">
            <span>Interactive Bloch Sphere Simulation</span>
            <span className="text-[10px] bg-indigo-950 px-2 py-0.5 rounded-full text-indigo-300 border border-indigo-800">
              Live Vector
            </span>
          </div>

          <div className="flex justify-center py-3">
            <svg className="w-60 h-60" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="80" fill="none" stroke="#334155" strokeWidth="2" strokeDasharray="4 4" />
              <ellipse cx="100" cy="100" rx="80" ry="25" fill="none" stroke="#475569" strokeWidth="1.5" />
              <line x1="100" y1="15" x2="100" y2="185" stroke="#6366f1" strokeWidth="2" />
              <text x="105" y="20" fill="#818cf8" fontSize="12" fontWeight="bold">|0⟩ (North)</text>
              <text x="105" y="190" fill="#818cf8" fontSize="12" fontWeight="bold">|1⟩ (South)</text>
              <line x1="100" y1="100" x2="155" y2="55" stroke="#10b981" strokeWidth="3" />
              <circle cx="155" cy="55" r="5" fill="#10b981" className="animate-ping" />
              <text x="160" y="50" fill="#34d399" fontSize="12" fontWeight="bold">|ψ⟩ = α|0⟩ + β|1⟩</text>
            </svg>
          </div>
        </div>
      )}

      {/* INLINE EXPANDABLE DRILL DOWN (LIGHT THEME) */}
      {hasDrill && isDrillExpanded && topicData && (
        <InlineDrilldownDetail
          topicData={topicData}
          currentLevelNum={currentLevelNum}
          currentLevelData={currentLevelData}
          combinedExamples={combinedExamples}
          expandedExampleIds={drilldownState.expandedExamples[topicKey] || {}}
          isGenerating={!!drilldownState.isGeneratingMap[topicKey]}
          llmQuestion={drilldownState.llmQuestionMap[levelKey] || ''}
          chatHistory={chatHistory}
          isRecording={isRecording}
          isAiThinking={isAiThinking}
          onSelectLevel={(levelNum) => drilldownState.handleLevelSelect(topicKey, levelNum)}
          onClose={drilldownState.closeDrilldown}
          onGenerateExtraExample={() => drilldownState.handleGenerateExtraExample(topicKey)}
          onToggleExampleSolution={(exampleId) => drilldownState.toggleExampleSolution(topicKey, exampleId)}
          onChangeLlmQuestion={(value) => drilldownState.setLlmQuestion(levelKey, value)}
          onAskLlm={(promptText) => drilldownState.handleAskLevelLLM(topicKey, currentLevelNum, promptText)}
          onToggleVoiceRecording={() => drilldownState.toggleVoiceRecording(topicKey, currentLevelNum)}
        />
      )}
    </div>
  );
};

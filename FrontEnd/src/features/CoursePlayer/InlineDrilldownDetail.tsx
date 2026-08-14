import React from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Plus,
  X,
  Check,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { DrillLevelData, ExampleItem, TopicDrilldown } from '../../types';
import { renderLatex } from './renderLatex';
import { LLMAssistantMessage } from './useInlineDrilldownState';
import { LlmAssistantPanel } from './LlmAssistantPanel';

interface InlineDrilldownDetailProps {
  topicData: TopicDrilldown;
  currentLevelNum: number;
  currentLevelData?: DrillLevelData;
  combinedExamples: ExampleItem[];
  expandedExampleIds: Record<string, boolean>;
  isGenerating: boolean;
  llmQuestion: string;
  chatHistory: LLMAssistantMessage[];
  isRecording: boolean;
  isAiThinking: boolean;
  onSelectLevel: (levelNum: number) => void;
  onClose: () => void;
  onGenerateExtraExample: () => void;
  onToggleExampleSolution: (exampleId: string) => void;
  onChangeLlmQuestion: (value: string) => void;
  onAskLlm: (promptText?: string) => void;
  onToggleVoiceRecording: () => void;
}

// Extracted from ReaderCanvas.tsx: the inline expandable 5-level concept drill-down panel shown
// below a sentence -- level selector tabs, level content/key points/formulas, interactive worked
// examples, and the future-LLM-assistant chat/voice mock.
export const InlineDrilldownDetail: React.FC<InlineDrilldownDetailProps> = ({
  topicData,
  currentLevelNum,
  currentLevelData,
  combinedExamples,
  expandedExampleIds,
  isGenerating,
  llmQuestion,
  chatHistory,
  isRecording,
  isAiThinking,
  onSelectLevel,
  onClose,
  onGenerateExtraExample,
  onToggleExampleSolution,
  onChangeLlmQuestion,
  onAskLlm,
  onToggleVoiceRecording,
}) => {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-5 p-5 sm:p-6 rounded-3xl bg-white border border-indigo-200 shadow-md transition-all animate-fade-in space-y-5 text-slate-800"
    >
      {/* Inline Header */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-md">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                5-Level Concept Deep Dive
              </span>
            </div>
            <h4 className="text-base font-extrabold text-slate-900 mt-0.5">
              {topicData.title}
            </h4>
            <p className="text-xs text-slate-500">
              {topicData.overview}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          title="Collapse Inline Drill Down"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 5-Level Selector Tabs */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Select Concept Depth Level (1 to 5):
        </span>
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          {[1, 2, 3, 4, 5].map((lvlNum) => {
            const levelObj = topicData.levels?.find((l) => l.level === lvlNum);
            const isSelectedLevel = currentLevelNum === lvlNum;

            return (
              <button
                type="button"
                key={lvlNum}
                onClick={() => onSelectLevel(lvlNum)}
                className={`px-3 py-2 rounded-2xl text-xs font-bold transition-all flex items-center space-x-2 border shrink-0 ${
                  isSelectedLevel
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-extrabold ${
                    isSelectedLevel ? 'bg-white text-indigo-700' : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {lvlNum}
                </span>
                <span>
                  L{lvlNum}:{' '}
                  {levelObj?.title.split(':')[1]?.trim() || levelObj?.title || `Level ${lvlNum}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Level Body */}
      {currentLevelData && (
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <span className="text-xs font-extrabold uppercase text-indigo-600 tracking-wider">
              {currentLevelData.title}
            </span>
            <h5 className="text-sm font-bold text-slate-900">
              {currentLevelData.subtitle}
            </h5>
          </div>

          {/* Detailed Content */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs leading-relaxed text-slate-800">
            {currentLevelData.content}
          </div>

          {/* Key Points */}
          {currentLevelData.keyPoints?.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Core Takeaways</span>
              </span>
              <div className="grid grid-cols-1 gap-1.5">
                {currentLevelData.keyPoints.map((pt, pIdx) => (
                  <div
                    key={pIdx}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-start space-x-2 text-slate-800"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Math Formulas */}
          {currentLevelData.mathFormulas && currentLevelData.mathFormulas.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Mathematical Expressions
              </span>
              {currentLevelData.mathFormulas.map((f, fIdx) => (
                <div
                  key={fIdx}
                  className="p-3.5 rounded-2xl bg-slate-100 text-slate-900 overflow-x-auto text-center border border-slate-200"
                  dangerouslySetInnerHTML={{ __html: renderLatex(f) }}
                />
              ))}
            </div>
          )}

          {/* Interactive Examples Section (KEEP 1 EXAMPLE EXPANDED BY DEFAULT) */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <div className="flex items-center flex-wrap gap-2 justify-between">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-extrabold text-slate-900">
                  Interactive Practical Examples ({combinedExamples.length})
                </span>
              </div>

              <button
                type="button"
                onClick={onGenerateExtraExample}
                disabled={isGenerating}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {isGenerating ? 'Generating...' : '+ Generate Extra Example'}
                </span>
              </button>
            </div>

            <div className="space-y-3">
              {combinedExamples.map((ex, exIdx) => {
                const isExExpanded = !!expandedExampleIds[ex.id];

                return (
                  <div
                    key={ex.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700">
                          Example #{exIdx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{ex.title}</span>
                      </div>

                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                        {ex.difficulty}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-800">
                      <strong className="text-indigo-700">Problem:</strong> {ex.problem}
                    </p>

                    <button
                      type="button"
                      onClick={() => onToggleExampleSolution(ex.id)}
                      className="text-xs font-bold text-indigo-600 hover:underline flex items-center space-x-1"
                    >
                      <span>{isExExpanded ? 'Hide Step-by-Step Solution' : 'Show Step-by-Step Solution'}</span>
                      {isExExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {isExExpanded && (
                      <div className="p-3.5 rounded-xl bg-white border border-indigo-200 text-xs space-y-2 shadow-2xs">
                        <p className="font-extrabold text-indigo-800 flex items-center space-x-1">
                          <Zap className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Step-by-Step Walkthrough:</span>
                        </p>
                        <ul className="space-y-1 text-slate-700 pl-2 font-medium">
                          {ex.stepByStepSolution.map((sStep, sIdx) => (
                            <li key={sIdx}>• {sStep}</li>
                          ))}
                        </ul>
                        <div className="pt-2 border-t border-slate-100 text-emerald-700 font-extrabold flex items-center space-x-1">
                          <Check className="w-4 h-4 text-emerald-600" />
                          <span>Final Answer: {ex.finalAnswer}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* FUTURE LLM INTEGRATION PRE-DESIGN: Ask AI Assistant at Level X Context */}
          <LlmAssistantPanel
            currentLevelNum={currentLevelNum}
            currentLevelTitle={currentLevelData.title}
            llmQuestion={llmQuestion}
            chatHistory={chatHistory}
            isRecording={isRecording}
            isAiThinking={isAiThinking}
            onChangeLlmQuestion={onChangeLlmQuestion}
            onAskLlm={onAskLlm}
            onToggleVoiceRecording={onToggleVoiceRecording}
          />

        </div>
      )}

      <div className="pt-2 border-t border-slate-200 flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200"
        >
          Collapse Inline Drill Down
        </button>
      </div>
    </div>
  );
};

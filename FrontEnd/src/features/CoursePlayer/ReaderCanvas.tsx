import React, { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import { Sentence, TopicDrilldown, ExampleItem } from '../../types';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Plus,
  X,
  Check,
  Zap,
  Mic,
  MicOff,
  Send,
  Bot,
  MessageSquare,
  Lock,
  CheckCircle2,
  NotebookPen,
} from 'lucide-react';

interface ReaderCanvasProps {
  sentences: Sentence[];
  drilldowns?: Record<string, TopicDrilldown>;
  activeSentenceIndex: number;
  onSelectSentence: (index: number) => void;
  onOpenDrilldown?: (topicKey: string) => void;
  onOpenScratchpadForParagraph?: (index: number) => void;
}

// Reader text size is a fixed, sensible default now that the old Accessibility modal's
// user-configurable font-size control has been removed (see FlexDemy remove-accessibility-modal
// change) -- 16px was the modal's own default.
const READER_FONT_SIZE_PX = 16;

interface LLMAssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const ReaderCanvas: React.FC<ReaderCanvasProps> = ({
  sentences,
  drilldowns = {},
  activeSentenceIndex,
  onSelectSentence,
  onOpenScratchpadForParagraph,
}) => {
  const activeSentenceRef = useRef<HTMLDivElement | null>(null);

  // Drilldown BY DEFAULT IS CLOSED (expandedSentenceId = null)
  const [expandedSentenceId, setExpandedSentenceId] = useState<string | null>(null);

  // Active Level (1..5) per topic drilldown
  const [selectedLevels, setSelectedLevels] = useState<Record<string, number>>({});

  // Expanded examples per topic drilldown (e.g., { topicKey: { exampleId: boolean } })
  const [expandedExamples, setExpandedExamples] = useState<Record<string, Record<string, boolean>>>({});

  // Dynamic examples generated on-the-fly per topic
  const [customExamplesMap, setCustomExamplesMap] = useState<Record<string, ExampleItem[]>>({});
  const [isGeneratingMap, setIsGeneratingMap] = useState<Record<string, boolean>>({});

  // Future LLM Assistant per topic + level state
  // Key format: `${topicKey}_L${levelNum}`
  const [llmQuestionMap, setLlmQuestionMap] = useState<Record<string, string>>({});
  const [llmChatHistoryMap, setLlmChatHistoryMap] = useState<Record<string, LLMAssistantMessage[]>>({});
  const [isRecordingMap, setIsRecordingMap] = useState<Record<string, boolean>>({});
  const [isAiThinkingMap, setIsAiThinkingMap] = useState<Record<string, boolean>>({});

  // Smooth auto-scroll to active sentence when reading progresses
  useEffect(() => {
    if (activeSentenceRef.current) {
      activeSentenceRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSentenceIndex]);

  // Helper to safely render KaTeX
  const renderLaTeX = (latexStr: string) => {
    try {
      return katex.renderToString(latexStr, { throwOnError: false, displayMode: true });
    } catch {
      return latexStr;
    }
  };

  const toggleDrilldownInline = (sentenceId: string) => {
    if (expandedSentenceId === sentenceId) {
      setExpandedSentenceId(null);
    } else {
      setExpandedSentenceId(sentenceId);
    }
  };

  const handleLevelSelect = (topicKey: string, levelNum: number) => {
    setSelectedLevels((prev) => ({ ...prev, [topicKey]: levelNum }));
  };

  const toggleExampleSolution = (topicKey: string, exampleId: string) => {
    setExpandedExamples((prev) => ({
      ...prev,
      [topicKey]: {
        ...prev[topicKey],
        [exampleId]: !prev[topicKey]?.[exampleId],
      },
    }));
  };

  const handleGenerateExtraExample = (topicKey: string) => {
    setIsGeneratingMap((prev) => ({ ...prev, [topicKey]: true }));
    setTimeout(() => {
      const existingCustom = customExamplesMap[topicKey] || [];
      const newEx: ExampleItem = {
        id: `gen_${Date.now()}`,
        title: `Dynamic Practical Application Example #${existingCustom.length + 1}`,
        problem: `Given probability amplitude alpha = cos(pi/${4 + existingCustom.length}) and beta = sin(pi/${4 + existingCustom.length}), calculate normalized state vector magnitude.`,
        stepByStepSolution: [
          `Step 1: Calculate cos^2(pi/${4 + existingCustom.length}) and sin^2(pi/${4 + existingCustom.length}).`,
          'Step 2: Apply fundamental identity cos^2(x) + sin^2(x) = 1.0.',
          'Step 3: Confirm total probability amplitude sums exactly to 100%.',
        ],
        finalAnswer: 'State magnitude is verified to be 1.0 (100% normalized)',
        difficulty: existingCustom.length % 2 === 0 ? 'Medium' : 'Hard',
      };

      setCustomExamplesMap((prev) => ({
        ...prev,
        [topicKey]: [...(prev[topicKey] || []), newEx],
      }));

      // Auto-expand solution for newly generated example
      setExpandedExamples((prev) => ({
        ...prev,
        [topicKey]: {
          ...prev[topicKey],
          [newEx.id]: true,
        },
      }));

      setIsGeneratingMap((prev) => ({ ...prev, [topicKey]: false }));
    }, 500);
  };

  // LLM Level-Bound Query Handling
  const handleAskLevelLLM = (topicKey: string, levelNum: number, promptText?: string) => {
    const levelKey = `${topicKey}_L${levelNum}`;
    const question = promptText || llmQuestionMap[levelKey] || '';
    if (!question.trim()) return;

    const userMsg: LLMAssistantMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setLlmChatHistoryMap((prev) => ({
      ...prev,
      [levelKey]: [...(prev[levelKey] || []), userMsg],
    }));

    setLlmQuestionMap((prev) => ({ ...prev, [levelKey]: '' }));
    setIsAiThinkingMap((prev) => ({ ...prev, [levelKey]: true }));

    // Simulate LLM context-bound response
    setTimeout(() => {
      const aiMsgText = `[LLM Level ${levelNum} Bound Answer]: Focusing strictly on Level ${levelNum} concept — "${question}"\n\nAt this depth, we consider the mathematical boundaries where probability amplitudes sum to 1.0. For practical execution, you do not need full lesson context because Level ${levelNum} isolates the core formula.`;

      const aiMsg: LLMAssistantMessage = {
        id: `ai_${Date.now()}`,
        sender: 'assistant',
        text: aiMsgText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setLlmChatHistoryMap((prev) => ({
        ...prev,
        [levelKey]: [...(prev[levelKey] || []), aiMsg],
      }));
      setIsAiThinkingMap((prev) => ({ ...prev, [levelKey]: false }));
    }, 700);
  };

  // Simulated Voice Assistant Toggle
  const toggleVoiceRecording = (topicKey: string, levelNum: number) => {
    const levelKey = `${topicKey}_L${levelNum}`;
    const isCurrentlyRecording = !!isRecordingMap[levelKey];

    if (isCurrentlyRecording) {
      setIsRecordingMap((prev) => ({ ...prev, [levelKey]: false }));
      // Simulate transcribing voice question
      const voiceTranscribed = `Voice Query for Level ${levelNum}: Can you clarify how probability amplitudes normalize?`;
      setLlmQuestionMap((prev) => ({ ...prev, [levelKey]: voiceTranscribed }));
    } else {
      setIsRecordingMap((prev) => ({ ...prev, [levelKey]: true }));
      // Auto-stop recording after 3 seconds
      setTimeout(() => {
        setIsRecordingMap((prev) => ({ ...prev, [levelKey]: false }));
        const voiceTranscribed = `Voice Query for Level ${levelNum}: Explain the core equation at Level ${levelNum}.`;
        handleAskLevelLLM(topicKey, levelNum, voiceTranscribed);
      }, 2500);
    }
  };

  return (
    <div
      className="space-y-6 transition-all text-slate-800"
      style={{ fontSize: `${READER_FONT_SIZE_PX}px` }}
    >
      {sentences.map((sentence, index) => {
        const isActive = index === activeSentenceIndex;
        const hasDrill = !!(sentence.hasDrilldown && sentence.drilldownTopic && drilldowns[sentence.drilldownTopic]);
        const topicKey = sentence.drilldownTopic || '';
        const isDrillExpanded = expandedSentenceId === sentence.id;
        const topicData = hasDrill ? drilldowns[topicKey] : null;

        // Selected level for this topic (1..5)
        const currentLevelNum = selectedLevels[topicKey] || 1;
        const currentLevelData = topicData?.levels?.find((l) => l.level === currentLevelNum) || topicData?.levels?.[0];

        // All examples (base + dynamic)
        const baseExamples = currentLevelData?.examples || [];
        const extraCustom = customExamplesMap[topicKey] || [];
        const combinedExamples = [...baseExamples, ...extraCustom];

        // LLM State for active level
        const levelKey = `${topicKey}_L${currentLevelNum}`;
        const chatHistory = llmChatHistoryMap[levelKey] || [];
        const isRecording = !!isRecordingMap[levelKey];
        const isAiThinking = !!isAiThinkingMap[levelKey];

        return (
          <div
            key={sentence.id}
            ref={isActive ? activeSentenceRef : null}
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
                      toggleDrilldownInline(sentence.id);
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
                dangerouslySetInnerHTML={{ __html: renderLaTeX(sentence.mathLaTeX) }}
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
                    onClick={() => setExpandedSentenceId(null)}
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
                          onClick={() => handleLevelSelect(topicKey, lvlNum)}
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
                            dangerouslySetInnerHTML={{ __html: renderLaTeX(f) }}
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
                          onClick={() => handleGenerateExtraExample(topicKey)}
                          disabled={isGeneratingMap[topicKey]}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>
                            {isGeneratingMap[topicKey] ? 'Generating...' : '+ Generate Extra Example'}
                          </span>
                        </button>
                      </div>

                      <div className="space-y-3">
                        {combinedExamples.map((ex, exIdx) => {
                          const isExExpanded = !!expandedExamples[topicKey]?.[ex.id];

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
                                onClick={() => toggleExampleSolution(topicKey, ex.id)}
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
                    <div className="pt-4 border-t border-slate-200 space-y-3">
                      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center space-x-2">
                            <Bot className="w-4 h-4 text-indigo-600" />
                            <span className="text-xs font-extrabold text-slate-900">
                              Ask Level {currentLevelNum} LLM AI Assistant
                            </span>
                          </div>

                          <div className="flex items-center space-x-1 text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2.5 py-0.5 rounded-full border border-indigo-200">
                            <Lock className="w-3 h-3 text-emerald-600" />
                            <span>Context Bound: Level {currentLevelNum} - {currentLevelData.title}</span>
                          </div>
                        </div>

                        {/* Predefined Level Drilldown Prompt Chips */}
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">
                            Predefined Level {currentLevelNum} Prompts:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              `💡 Real-world analogy for Level ${currentLevelNum}`,
                              `📐 Equation breakdown for Level ${currentLevelNum}`,
                              `⚡ Common student pitfalls at Level ${currentLevelNum}`,
                              `🧪 Python / Qiskit code sample`,
                            ].map((pChip, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleAskLevelLLM(topicKey, currentLevelNum, pChip)}
                                className="px-2.5 py-1 rounded-xl bg-white hover:bg-indigo-600 hover:text-white text-slate-700 text-[11px] font-medium transition-all border border-slate-200 shadow-2xs"
                              >
                                {pChip}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Text / Voice Input for Question */}
                        <div className="flex items-center space-x-2 pt-1">
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={llmQuestionMap[levelKey] || ''}
                              onChange={(e) =>
                                setLlmQuestionMap((prev) => ({
                                  ...prev,
                                  [levelKey]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAskLevelLLM(topicKey, currentLevelNum);
                                }
                              }}
                              placeholder={`Ask AI a question specifically bound to Level ${currentLevelNum}...`}
                              className="w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                            />

                            {/* Voice Button */}
                            <button
                              type="button"
                              onClick={() => toggleVoiceRecording(topicKey, currentLevelNum)}
                              className={`absolute right-2 top-1.5 p-1 rounded-lg transition-colors ${
                                isRecording ? 'bg-red-600 text-white animate-pulse' : 'text-slate-400 hover:text-slate-700'
                              }`}
                              title="Ask via Voice (LLM Listening Mode)"
                            >
                              {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAskLevelLLM(topicKey, currentLevelNum)}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1 shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Ask</span>
                          </button>
                        </div>

                        {/* Voice Recording Waveform Indicator */}
                        {isRecording && (
                          <div className="p-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2 animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                            <span className="font-bold">Listening to voice input for Level {currentLevelNum}... speak now.</span>
                          </div>
                        )}

                        {/* Chat Response Stream Container */}
                        {isAiThinking && (
                          <div className="p-3 rounded-xl bg-white border border-indigo-200 text-xs text-indigo-700 font-semibold flex items-center space-x-2 animate-pulse">
                            <Bot className="w-4 h-4 text-indigo-600 animate-spin" />
                            <span>LLM binding to Level {currentLevelNum} context and rendering answer...</span>
                          </div>
                        )}

                        {chatHistory.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-indigo-100">
                            {chatHistory.map((msg) => (
                              <div
                                key={msg.id}
                                className={`p-3 rounded-xl text-xs ${
                                  msg.sender === 'user'
                                    ? 'bg-indigo-600 text-white ml-6 shadow-xs'
                                    : 'bg-white border border-slate-200 text-slate-800 mr-6 space-y-1 shadow-2xs'
                                }`}
                              >
                                <div
                                  className={`flex items-center justify-between text-[10px] font-bold mb-1 ${
                                    msg.sender === 'user' ? 'text-indigo-100' : 'text-indigo-700'
                                  }`}
                                >
                                  <span>{msg.sender === 'user' ? 'You' : `Level ${currentLevelNum} AI Assistant`}</span>
                                  <span className={msg.sender === 'user' ? 'text-indigo-200' : 'text-slate-400'}>
                                    {msg.timestamp}
                                  </span>
                                </div>
                                <p className="whitespace-pre-line font-normal">{msg.text}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setExpandedSentenceId(null)}
                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200"
                  >
                    Collapse Inline Drill Down
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

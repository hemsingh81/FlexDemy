import { useState } from 'react';
import { ExampleItem } from '../../types';

export interface LLMAssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

// Extracted from ReaderCanvas.tsx: owns all per-sentence inline drilldown state -- which
// sentence's drilldown is expanded, the selected 1..5 level per topic, expandable worked
// examples (including dynamically-generated ones), and the future-LLM-assistant chat/voice
// simulation per topic+level. State is keyed by topicKey (and `${topicKey}_L${level}` for the
// LLM maps) rather than by sentence, matching the original component's behavior: reopening the
// same topic's drilldown after collapsing it keeps its previously-selected level and chat
// history, since this state lives here rather than inside a child that would unmount on collapse.
export const useInlineDrilldownState = () => {
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

  const toggleDrilldownInline = (sentenceId: string) => {
    setExpandedSentenceId((prev) => (prev === sentenceId ? null : sentenceId));
  };

  const closeDrilldown = () => setExpandedSentenceId(null);

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

  const setLlmQuestion = (levelKey: string, value: string) => {
    setLlmQuestionMap((prev) => ({ ...prev, [levelKey]: value }));
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

  return {
    expandedSentenceId,
    toggleDrilldownInline,
    closeDrilldown,
    selectedLevels,
    handleLevelSelect,
    expandedExamples,
    toggleExampleSolution,
    customExamplesMap,
    isGeneratingMap,
    handleGenerateExtraExample,
    llmQuestionMap,
    setLlmQuestion,
    llmChatHistoryMap,
    isRecordingMap,
    isAiThinkingMap,
    handleAskLevelLLM,
    toggleVoiceRecording,
  };
};

export type InlineDrilldownState = ReturnType<typeof useInlineDrilldownState>;

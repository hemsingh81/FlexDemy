import React from 'react';
import { Bot, Lock, Mic, MicOff, Send } from 'lucide-react';
import { LLMAssistantMessage } from './useInlineDrilldownState';

interface LlmAssistantPanelProps {
  currentLevelNum: number;
  currentLevelTitle: string;
  llmQuestion: string;
  chatHistory: LLMAssistantMessage[];
  isRecording: boolean;
  isAiThinking: boolean;
  onChangeLlmQuestion: (value: string) => void;
  onAskLlm: (promptText?: string) => void;
  onToggleVoiceRecording: () => void;
}

// Extracted from InlineDrilldownDetail.tsx: the "Ask Level X LLM AI Assistant" mock -- prompt
// chips, text/voice question input, and the simulated chat transcript.
export const LlmAssistantPanel: React.FC<LlmAssistantPanelProps> = ({
  currentLevelNum,
  currentLevelTitle,
  llmQuestion,
  chatHistory,
  isRecording,
  isAiThinking,
  onChangeLlmQuestion,
  onAskLlm,
  onToggleVoiceRecording,
}) => {
  return (
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
            <span>Context Bound: Level {currentLevelNum} - {currentLevelTitle}</span>
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
                onClick={() => onAskLlm(pChip)}
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
              value={llmQuestion}
              onChange={(e) => onChangeLlmQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onAskLlm();
                }
              }}
              placeholder={`Ask AI a question specifically bound to Level ${currentLevelNum}...`}
              className="w-full pl-3 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />

            {/* Voice Button */}
            <button
              type="button"
              onClick={onToggleVoiceRecording}
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
            onClick={() => onAskLlm()}
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
  );
};

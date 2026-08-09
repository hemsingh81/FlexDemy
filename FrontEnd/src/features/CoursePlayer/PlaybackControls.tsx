import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Gauge,
  Bookmark,
  Sparkles,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Dropdown } from '../../ui/Dropdown';

interface PlaybackControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSkipNext: () => void;
  onSkipPrev: () => void;
  rate: number;
  onRateChange: (rate: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  autoScroll: boolean;
  onToggleAutoScroll: () => void;
  voices: SpeechSynthesisVoice[];
  selectedVoiceName: string;
  onVoiceChange: (voiceName: string) => void;
  currentSentenceIndex: number;
  totalSentences: number;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onSkipNext,
  onSkipPrev,
  rate,
  onRateChange,
  isMuted,
  onToggleMute,
  autoScroll,
  onToggleAutoScroll,
  voices,
  selectedVoiceName,
  onVoiceChange,
  currentSentenceIndex,
  totalSentences,
}) => {
  return (
    <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 shadow-lg transition-all text-slate-800">
      <div className="w-full px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Progress Scrubber Bar */}
        <div className="w-full md:w-1/3 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center space-x-1 text-indigo-600 font-bold">
              <Bookmark className="w-3.5 h-3.5" />
              <span>Position {currentSentenceIndex + 1} / {totalSentences}</span>
            </span>
            <span>{Math.round(((currentSentenceIndex + 1) / totalSentences) * 100)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
            <div
              className="h-full bg-[#143358] rounded-full transition-all duration-300"
              style={{ width: `${((currentSentenceIndex + 1) / totalSentences) * 100}%` }}
            />
          </div>
        </div>

        {/* Center Primary Playback Controls */}
        <div className="flex items-center space-x-3">
          
          <button
            onClick={onSkipPrev}
            aria-label="Previous sentence"
            disabled={currentSentenceIndex === 0}
            className="p-2.5 rounded-full text-slate-700 hover:bg-slate-100 border border-slate-200/80 disabled:opacity-30 transition-colors shadow-2xs"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause Narration' : 'Play Narration'}
            className="p-4 rounded-full bg-[#143358] hover:bg-[#143358]/90 text-white shadow-md shadow-[#143358]/20 transform hover:scale-105 transition-all cursor-pointer"
          >
            {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
          </button>

          <button
            onClick={onSkipNext}
            aria-label="Next sentence"
            disabled={currentSentenceIndex >= totalSentences - 1}
            className="p-2.5 rounded-full text-slate-700 hover:bg-slate-100 border border-slate-200/80 disabled:opacity-30 transition-colors shadow-2xs"
          >
            <SkipForward className="w-5 h-5" />
          </button>

        </div>

        {/* Right Settings & Voice Multipliers */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          
          {/* Speed Selector */}
          <div className="flex items-center space-x-1 bg-slate-100 border border-slate-200 p-1 rounded-xl">
            {[0.75, 1.0, 1.25, 1.5].map((speed) => (
              <button
                key={speed}
                onClick={() => onRateChange(speed)}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  rate === speed
                    ? 'bg-[#143358] text-white shadow-xs'
                    : 'text-slate-700 hover:bg-slate-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Mute/Unmute */}
          <button
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute voice' : 'Mute voice'}
            className={`p-2.5 rounded-xl border transition-colors ${
              isMuted
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Auto Scroll Toggle */}
          <button
            onClick={onToggleAutoScroll}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              autoScroll
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
            }`}
          >
            Auto-Scroll {autoScroll ? 'ON' : 'OFF'}
          </button>

          {/* Voice Selector Trigger */}
          {voices.length > 0 && (
            <Dropdown
              align="right"
              side="top"
              menuClassName="w-64 bg-white rounded-xl shadow-2xl border border-slate-200 p-3 space-y-2"
              trigger={({ toggle }) => (
                <button
                  onClick={toggle}
                  className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200"
                >
                  <Gauge className="w-4 h-4" />
                </button>
              )}
              menu={() => (
                <>
                  <p className="text-xs font-bold text-slate-900">Select Speech Synthesis Voice</p>
                  <select
                    value={selectedVoiceName}
                    onChange={(e) => onVoiceChange(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Default System Voice</option>
                    {voices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </>
              )}
            />
          )}

        </div>

      </div>
    </div>
  );
};

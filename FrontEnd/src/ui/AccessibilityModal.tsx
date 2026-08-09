import React, { useState, useEffect } from 'react';
import { X, Eye, Type, Keyboard, Volume2, Mic, Gauge, Play, Check } from 'lucide-react';
import { ttsManager } from '../lib/tts';

interface AccessibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  highContrast: boolean;
  setHighContrast: (val: boolean) => void;
  fontSize: number;
  setFontSize: (val: number) => void;
  autoSpeakFocus: boolean;
  setAutoSpeakFocus: (val: boolean) => void;
  preferredVoice?: string;
  setPreferredVoice?: (val: string) => void;
  ttsRate?: number;
  setTtsRate?: (val: number) => void;
  ttsPitch?: number;
  setTtsPitch?: (val: number) => void;
}

export const AccessibilityModal: React.FC<AccessibilityModalProps> = ({
  isOpen,
  onClose,
  highContrast,
  setHighContrast,
  fontSize,
  setFontSize,
  autoSpeakFocus,
  setAutoSpeakFocus,
  preferredVoice = '',
  setPreferredVoice,
  ttsRate = 1.0,
  setTtsRate,
  ttsPitch = 1.0,
  setTtsPitch,
}) => {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const avail = ttsManager.getAvailableVoices();
      setVoices(avail);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePreviewVoice = () => {
    if (isPlayingPreview) {
      ttsManager.cancel();
      setIsPlayingPreview(false);
      return;
    }

    setIsPlayingPreview(true);
    ttsManager.speak(
      "Welcome to FlexDemy! This is a preview of your auto-scroll narration voice settings.",
      {
        rate: ttsRate,
        pitch: ttsPitch,
        voiceName: preferredVoice,
        onEnd: () => setIsPlayingPreview(false),
        onError: () => setIsPlayingPreview(false),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#161618] rounded-2xl shadow-2xl border border-[#27272A] p-6 sm:p-8 text-gray-200 max-h-[90vh] overflow-y-auto">
        
        <button
          onClick={() => {
            ttsManager.cancel();
            setIsPlayingPreview(false);
            onClose();
          }}
          aria-label="Close modal"
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-lg cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">
            WCAG 2.1 Accessibility & Voice Settings
          </h2>
          <p className="text-xs text-gray-400">
            Customize text sizing, color contrast, TTS narration voices, pitch, and speech rates.
          </p>
        </div>

        <div className="space-y-6">

          {/* Voice Settings Sub-Menu Block */}
          <div className="p-5 rounded-2xl bg-[#0E0E10] border border-indigo-900/60 space-y-4">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
              <div className="flex items-center space-x-2.5 text-indigo-400">
                <Mic className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Voice & Narration Settings</h3>
              </div>
              
              <button
                type="button"
                onClick={handlePreviewVoice}
                className="px-3.5 py-1.5 bg-[#EC7B38] hover:bg-[#EC7B38]/90 text-white font-bold text-xs rounded-xl flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Volume2 className={`w-3.5 h-3.5 ${isPlayingPreview ? 'animate-pulse text-amber-300' : ''}`} />
                <span>{isPlayingPreview ? 'Stop Preview' : 'Test Voice Preview'}</span>
              </button>
            </div>

            {/* TTS Voice Picker */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300 block">
                Preferred Text-to-Speech Voice:
              </label>
              <select
                value={preferredVoice}
                onChange={(e) => setPreferredVoice && setPreferredVoice(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#161618] border border-[#27272A] text-xs text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Default System Voice</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>

            {/* Speech Rate Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
                <span>Speech Speed Rate:</span>
                <span className="text-indigo-400 font-bold">{ttsRate}x</span>
              </div>
              <div className="flex items-center space-x-1.5">
                {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setTtsRate && setTtsRate(rate)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      ttsRate === rate
                        ? 'bg-[#EC7B38] text-white border-[#EC7B38] shadow-xs'
                        : 'bg-[#161618] text-gray-300 border-[#27272A] hover:bg-[#1C1C1F]'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {/* Pitch Settings Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-300">
                <span>Narration Pitch Level:</span>
                <span className="text-indigo-400 font-bold">
                  {ttsPitch === 0.8 ? 'Low (0.8)' : ttsPitch === 1.2 ? 'High (1.2)' : 'Normal (1.0)'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Deep / Low', pitch: 0.8 },
                  { label: 'Natural / Standard', pitch: 1.0 },
                  { label: 'High / Crisp', pitch: 1.2 },
                ].map((item) => (
                  <button
                    key={item.pitch}
                    type="button"
                    onClick={() => setTtsPitch && setTtsPitch(item.pitch)}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                      ttsPitch === item.pitch
                        ? 'bg-[#EC7B38] text-white border-[#EC7B38] shadow-xs'
                        : 'bg-[#161618] text-gray-300 border-[#27272A] hover:bg-[#1C1C1F]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
          
          {/* High Contrast Mode */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#0E0E10] border border-[#27272A]">
            <div className="flex items-start space-x-3">
              <Eye className="w-5 h-5 text-indigo-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">High Contrast Mode</p>
                <p className="text-xs text-gray-400">Enhance borders and contrast ratios to 7:1 for low vision.</p>
              </div>
            </div>
            <button
              onClick={() => setHighContrast(!highContrast)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                highContrast ? 'bg-[#EC7B38]' : 'bg-[#27272A]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  highContrast ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Font Size Adjustment */}
          <div className="p-4 rounded-xl bg-[#0E0E10] border border-[#27272A] space-y-3">
            <div className="flex items-center space-x-3">
              <Type className="w-5 h-5 text-indigo-400" />
              <div>
                <p className="text-sm font-semibold text-white">Reader Text Size</p>
                <p className="text-xs text-gray-400">Current size: {fontSize}px</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {[14, 16, 18, 20].map((size) => (
                <button
                  key={size}
                  onClick={() => setFontSize(size)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    fontSize === size
                      ? 'bg-[#EC7B38] text-white border-[#EC7B38] shadow-xs'
                      : 'bg-[#161618] text-gray-300 border-[#27272A] hover:bg-[#1C1C1F]'
                  }`}
                >
                  {size}px
                </button>
              ))}
            </div>
          </div>

          {/* Auto Read Focus */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[#0E0E10] border border-[#27272A]">
            <div className="flex items-start space-x-3">
              <Volume2 className="w-5 h-5 text-indigo-400 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-white">Screen Reader Focus Audio</p>
                <p className="text-xs text-gray-400">Automatically speak sentence text when focused via Keyboard Tab.</p>
              </div>
            </div>
            <button
              onClick={() => setAutoSpeakFocus(!autoSpeakFocus)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                autoSpeakFocus ? 'bg-[#EC7B38]' : 'bg-[#27272A]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoSpeakFocus ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Keyboard Shortcuts Cheatsheet */}
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800 space-y-2">
            <div className="flex items-center space-x-2 text-indigo-300 font-semibold text-xs">
              <Keyboard className="w-4 h-4" />
              <span>Keyboard Shortcuts Cheatsheet</span>
            </div>
            <ul className="text-xs space-y-1.5 text-gray-300">
              <li className="flex justify-between"><span>Play / Pause Narration</span> <kbd className="px-1.5 py-0.5 bg-[#0E0E10] border border-[#27272A] rounded-xs font-mono text-gray-200">Space</kbd></li>
              <li className="flex justify-between"><span>Skip Next Sentence</span> <kbd className="px-1.5 py-0.5 bg-[#0E0E10] border border-[#27272A] rounded-xs font-mono text-gray-200">Right Arrow</kbd></li>
              <li className="flex justify-between"><span>Skip Previous Sentence</span> <kbd className="px-1.5 py-0.5 bg-[#0E0E10] border border-[#27272A] rounded-xs font-mono text-gray-200">Left Arrow</kbd></li>
              <li className="flex justify-between"><span>Toggle Drilldown Panel</span> <kbd className="px-1.5 py-0.5 bg-[#0E0E10] border border-[#27272A] rounded-xs font-mono text-gray-200">D</kbd></li>
              <li className="flex justify-between"><span>Close Modals / Drawers</span> <kbd className="px-1.5 py-0.5 bg-[#0E0E10] border border-[#27272A] rounded-xs font-mono text-gray-200">Esc</kbd></li>
            </ul>
          </div>

        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={() => {
              ttsManager.cancel();
              setIsPlayingPreview(false);
              onClose();
            }}
            className="px-5 py-2.5 bg-[#EC7B38] hover:bg-[#EC7B38]/90 text-white font-semibold rounded-xl text-xs shadow-md cursor-pointer transition-all"
          >
            Apply Settings
          </button>
        </div>

      </div>
    </div>
  );
};


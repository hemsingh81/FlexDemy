import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { Sentence } from '../../types';
import { ttsManager } from '../../lib/tts';

// Extracted from CoursePlayer.tsx: owns text-to-speech playback state (rate/pitch/voice/mute/
// auto-scroll) and the effect that actually drives the speech synthesis narration for the
// currently-active sentence.
export const useNarrationPlayback = (
  sentences: Sentence[],
  currentSentenceIndex: number,
  setCurrentSentenceIndex: Dispatch<SetStateAction<number>>
) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [rate, setRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

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

  return {
    isPlaying,
    setIsPlaying,
    rate,
    setRate,
    pitch,
    setPitch,
    isMuted,
    setIsMuted,
    autoScroll,
    setAutoScroll,
    selectedVoiceName,
    setSelectedVoiceName,
    voices,
  };
};

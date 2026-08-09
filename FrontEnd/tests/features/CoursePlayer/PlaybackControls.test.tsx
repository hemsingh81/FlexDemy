import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaybackControls } from '@/src/features/CoursePlayer/PlaybackControls';

const baseProps = {
  isPlaying: false,
  onTogglePlay: vi.fn(),
  onSkipNext: vi.fn(),
  onSkipPrev: vi.fn(),
  rate: 1.0,
  onRateChange: vi.fn(),
  isMuted: false,
  onToggleMute: vi.fn(),
  autoScroll: true,
  onToggleAutoScroll: vi.fn(),
  voices: [],
  selectedVoiceName: '',
  onVoiceChange: vi.fn(),
  currentSentenceIndex: 0,
  totalSentences: 4,
};

describe('PlaybackControls', () => {
  it('renders playback position and disables skip-prev at the first sentence', () => {
    render(<PlaybackControls {...baseProps} />);

    expect(screen.getByText('Position 1 / 4')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous sentence')).toBeDisabled();
    expect(screen.getByLabelText('Next sentence')).not.toBeDisabled();
  });

  it('calls onTogglePlay when the play/pause button is clicked', async () => {
    const onTogglePlay = vi.fn();
    const user = userEvent.setup();
    render(<PlaybackControls {...baseProps} onTogglePlay={onTogglePlay} />);

    await user.click(screen.getByLabelText('Play Narration'));

    expect(onTogglePlay).toHaveBeenCalled();
  });

  it('calls onRateChange with the selected playback speed', async () => {
    const onRateChange = vi.fn();
    const user = userEvent.setup();
    render(<PlaybackControls {...baseProps} onRateChange={onRateChange} />);

    await user.click(screen.getByText('1.5x'));

    expect(onRateChange).toHaveBeenCalledWith(1.5);
  });
});

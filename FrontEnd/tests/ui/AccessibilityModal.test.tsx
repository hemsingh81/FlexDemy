import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccessibilityModal } from '@/src/ui/AccessibilityModal';

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  highContrast: false,
  setHighContrast: vi.fn(),
  fontSize: 16,
  setFontSize: vi.fn(),
  autoSpeakFocus: false,
  setAutoSpeakFocus: vi.fn(),
};

describe('AccessibilityModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<AccessibilityModal {...baseProps} isOpen={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('toggling high contrast calls setHighContrast', async () => {
    const setHighContrast = vi.fn();
    const user = userEvent.setup();
    render(<AccessibilityModal {...baseProps} setHighContrast={setHighContrast} />);

    const row = screen.getByText('High Contrast Mode').closest('.justify-between')!;
    await user.click(within(row as HTMLElement).getByRole('button'));
    expect(setHighContrast).toHaveBeenCalledWith(true);
  });
});

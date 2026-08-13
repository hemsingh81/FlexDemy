import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { KeywordText } from '../../../src/features/CoursePlayer/KeywordText';
import { useKeywordDefinition } from '../../../src/features/CoursePlayer/useKeywordDefinition';

// KeywordPopover is only ever rendered by KeywordText (it owns the trigger button + activeKeyword
// wiring), so this exercises the two together, driven by the real useKeywordDefinition hook --
// matching how CoursePlayer.tsx actually wires them.
const Harness: React.FC<{ text: string; keywords: string[] }> = ({ text, keywords }) => {
  const keywordState = useKeywordDefinition('course_1');
  return (
    <KeywordText
      text={text}
      keywords={keywords}
      activeKeyword={keywordState.activeKeyword}
      definition={keywordState.definition}
      isOverridden={keywordState.isOverridden}
      isLoading={keywordState.isLoading}
      onDefine={keywordState.define}
      onDismiss={keywordState.dismiss}
    />
  );
};

describe('KeywordPopover (via KeywordText)', () => {
  it('activating a keyword via keyboard (Enter) opens the popover and keeps focus on the keyword button', async () => {
    const user = userEvent.setup();
    render(<Harness text="A wave transfers energy." keywords={['wave']} />);

    const button = screen.getByRole('button', { name: 'wave' });
    button.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());
    expect(document.activeElement).toBe(button);
  });

  it('activating a keyword via keyboard (Space) opens the popover', async () => {
    const user = userEvent.setup();
    render(<Harness text="A wave transfers energy." keywords={['wave']} />);

    const button = screen.getByRole('button', { name: 'wave' });
    button.focus();
    await user.keyboard(' ');

    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());
  });

  it('the definition text is inside an aria-live="polite" region', async () => {
    const user = userEvent.setup();
    render(<Harness text="A wave transfers energy." keywords={['wave']} />);

    await user.click(screen.getByRole('button', { name: 'wave' }));
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());

    const liveRegion = screen.getByRole('tooltip').querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    await waitFor(() => expect(liveRegion?.textContent).not.toBe('Loading…'));
  });

  it('Escape dismisses the popover without moving focus away from the keyword button', async () => {
    const user = userEvent.setup();
    render(<Harness text="A wave transfers energy." keywords={['wave']} />);

    const button = screen.getByRole('button', { name: 'wave' });
    await user.click(button);
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(button);
  });

  it('clicking outside the popover dismisses it', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Harness text="A wave transfers energy." keywords={['wave']} />
        <button type="button">elsewhere</button>
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'wave' }));
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'elsewhere' }));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('an unresolvable keyword shows "Definition unavailable"', async () => {
    const user = userEvent.setup();
    render(<Harness text="Some energy text." keywords={['energy']} />);

    await user.click(screen.getByRole('button', { name: 'energy' }));

    await waitFor(() => expect(screen.getByText('Definition unavailable')).toBeInTheDocument());
  });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReaderCanvas } from '@/src/features/CoursePlayer/ReaderCanvas';
import { Sentence, TopicDrilldown } from '@/src/types';

// jsdom does not implement scrollIntoView; ReaderCanvas calls it to keep the active sentence
// in view.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const sentences: Sentence[] = [
  {
    id: 's1',
    text: 'Wave phenomena are described by the wave equation.',
    hasDrilldown: true,
    drilldownTopic: 'waves',
    mathLaTeX: 'E = mc^2',
  },
  {
    id: 's2',
    text: 'This is a second sentence without a drilldown.',
  },
];

const drilldowns: Record<string, TopicDrilldown> = {
  waves: {
    topicKey: 'waves',
    title: 'Wave Mechanics',
    overview: 'Deep dive into wave phenomena.',
    levels: [
      {
        level: 1,
        title: 'Level 1: ELI5',
        subtitle: 'Simple analogy',
        content: 'Waves are like ripples in water.',
        keyPoints: ['Waves carry energy', 'Not matter'],
        examples: [
          {
            id: 'ex1',
            title: 'Ripple Example',
            problem: 'A stone drops in a pond.',
            stepByStepSolution: ['Step 1: Drop the stone', 'Step 2: Watch the ripples'],
            finalAnswer: 'Ripples spread outward',
            difficulty: 'Easy',
          },
        ],
      },
      {
        level: 2,
        title: 'Level 2: Core Mechanics',
        subtitle: 'Mathematical description',
        content: 'A wave obeys the equation y = A sin(kx - wt).',
        keyPoints: ['Amplitude', 'Wavelength'],
        examples: [],
      },
    ],
  },
};

describe('ReaderCanvas', () => {
  it('renders every sentence and only shows the drill-down toggle for sentences with a drilldown topic', () => {
    render(
      <ReaderCanvas
        sentences={sentences}
        drilldowns={drilldowns}
        activeSentenceIndex={0}
        onSelectSentence={vi.fn()}
      />
    );

    expect(screen.getByText('Wave phenomena are described by the wave equation.')).toBeInTheDocument();
    expect(screen.getByText('This is a second sentence without a drilldown.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Drill Down \(5 Levels\)/ }).length).toBe(1);
  });

  it('calls onSelectSentence with the sentence index when a paragraph is clicked', async () => {
    const user = userEvent.setup();
    const onSelectSentence = vi.fn();
    render(
      <ReaderCanvas
        sentences={sentences}
        drilldowns={drilldowns}
        activeSentenceIndex={0}
        onSelectSentence={onSelectSentence}
      />
    );

    await user.click(screen.getByText('This is a second sentence without a drilldown.'));
    expect(onSelectSentence).toHaveBeenCalledWith(1);
  });

  it('calls onOpenScratchpadForParagraph for the Note button without also selecting the sentence', async () => {
    const user = userEvent.setup();
    const onSelectSentence = vi.fn();
    const onOpenScratchpadForParagraph = vi.fn();
    render(
      <ReaderCanvas
        sentences={sentences}
        drilldowns={drilldowns}
        activeSentenceIndex={0}
        onSelectSentence={onSelectSentence}
        onOpenScratchpadForParagraph={onOpenScratchpadForParagraph}
      />
    );

    await user.click(screen.getAllByText('Note')[0]);
    expect(onOpenScratchpadForParagraph).toHaveBeenCalledWith(0);
    expect(onSelectSentence).not.toHaveBeenCalled();
  });

  it('expands the inline drill-down showing Level 1 content by default, and collapses it again', async () => {
    const user = userEvent.setup();
    render(
      <ReaderCanvas
        sentences={sentences}
        drilldowns={drilldowns}
        activeSentenceIndex={0}
        onSelectSentence={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Drill Down \(5 Levels\)/ }));

    expect(screen.getByText('Wave Mechanics')).toBeInTheDocument();
    expect(screen.getByText('Deep dive into wave phenomena.')).toBeInTheDocument();
    expect(screen.getByText('Waves are like ripples in water.')).toBeInTheDocument();

    await user.click(screen.getByTitle('Collapse Inline Drill Down'));
    expect(screen.queryByText('Waves are like ripples in water.')).not.toBeInTheDocument();
  });

  it('switches to Level 2 content when its tab is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ReaderCanvas
        sentences={sentences}
        drilldowns={drilldowns}
        activeSentenceIndex={0}
        onSelectSentence={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Drill Down \(5 Levels\)/ }));
    await user.click(screen.getByRole('button', { name: /L2:/ }));

    expect(screen.getByText('A wave obeys the equation y = A sin(kx - wt).')).toBeInTheDocument();
    expect(screen.queryByText('Waves are like ripples in water.')).not.toBeInTheDocument();
  });

  it('toggles a worked example\'s step-by-step solution open and closed', async () => {
    const user = userEvent.setup();
    render(
      <ReaderCanvas
        sentences={sentences}
        drilldowns={drilldowns}
        activeSentenceIndex={0}
        onSelectSentence={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Drill Down \(5 Levels\)/ }));
    expect(screen.queryByText('Ripples spread outward', { exact: false })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show Step-by-Step Solution' }));
    expect(screen.getByText(/Step 1: Drop the stone/)).toBeInTheDocument();
    expect(screen.getByText(/Ripples spread outward/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide Step-by-Step Solution' }));
    expect(screen.queryByText(/Step 1: Drop the stone/)).not.toBeInTheDocument();
  });

  it('generates a new dynamic example after the "Generate Extra Example" action resolves', async () => {
    const user = userEvent.setup();
    render(
      <ReaderCanvas
        sentences={sentences}
        drilldowns={drilldowns}
        activeSentenceIndex={0}
        onSelectSentence={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Drill Down \(5 Levels\)/ }));
    expect(screen.getByText('Interactive Practical Examples (1)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Generate Extra Example/ }));

    await waitFor(
      () => expect(screen.getByText('Interactive Practical Examples (2)')).toBeInTheDocument(),
      { timeout: 4000 }
    );
    // The newly generated example's solution auto-expands.
    expect(screen.getByText(/State magnitude is verified/)).toBeInTheDocument();
  }, 10000);

  it('asks the mock LLM assistant a question and shows the simulated reply', async () => {
    const user = userEvent.setup();
    render(
      <ReaderCanvas
        sentences={sentences}
        drilldowns={drilldowns}
        activeSentenceIndex={0}
        onSelectSentence={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Drill Down \(5 Levels\)/ }));

    const input = screen.getByPlaceholderText(/Ask AI a question specifically bound to Level 1/);
    await user.type(input, 'Why do waves not transfer matter?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(screen.getByText('Why do waves not transfer matter?')).toBeInTheDocument();

    await waitFor(
      () => expect(screen.getByText(/LLM Level 1 Bound Answer/)).toBeInTheDocument(),
      { timeout: 4000 }
    );
  }, 10000);
});

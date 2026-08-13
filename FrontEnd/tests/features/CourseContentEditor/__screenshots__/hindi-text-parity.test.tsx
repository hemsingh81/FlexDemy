import { describe, it, expect, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContentTree } from '@/src/features/CourseContentEditor/ContentTreeNode';
import { ReviewAsStudentPreview } from '@/src/features/CourseContentEditor/ReviewAsStudentPreview';
import type { Chapter } from '@/src/features/CourseContentEditor/useCourseContentTree';
import { createNoopTreeMutators } from '../../../support/noopTreeMutators';
import { waitForFontsReady } from '../../../support/waitForFontsReady';

// Story 3.11/AC#1 -- the suite's deliberately "weaker" pair. Unlike the math/chemistry pairs
// (both call the literal same renderNotation() function), text blocks are rendered by
// structurally DIFFERENT components on each side: the editor renders an unstyled, unhighlighted
// <textarea> form control (ContentTreeNode.tsx's shared EditableField), while the student view
// renders a styled <p> with keyword-highlight <button>s (KeywordText.tsx). This pair cannot prove
// the two views produce identical output the way the math pairs do -- what it DOES catch is: (a)
// the Devanagari text/lang attribute surviving unmangled through both render paths, and (b)
// regressions in either view's own font-fallback behavior for Hindi script, since this repo has no
// explicit Devanagari webfont loaded and both sides currently render it via system-font fallback
// (see this story's Dev Notes / Completion Notes for that gap, out of this story's own scope).
const BLOCK_ID = 'block_text_wave_energy';
const TOPIC_TITLE = 'Wave Energy Transfer';
const HINDI_TEXT = 'तरंग ऊर्जा को स्थानांतरित करती है, पदार्थ को नहीं।';

const makeChapters = (): Chapter[] => [
  {
    id: 'chapter_hindi',
    title: 'Waves',
    confirmation: 'confirmed',
    topics: [
      {
        id: 'topic_hindi',
        title: TOPIC_TITLE,
        confirmation: 'confirmed',
        subtopics: [],
        contentBlocks: [{ id: BLOCK_ID, format: 'text', confirmation: 'confirmed', text: HINDI_TEXT, lang: 'hi' }],
      },
    ],
  },
];

describe('Cross-view visual parity: Hindi (Devanagari) text', () => {
  it('editor rendering matches its golden baseline', async () => {
    const { unmount } = render(
      <ContentTree chapters={makeChapters()} mutators={createNoopTreeMutators()} onAddChapter={vi.fn()} />
    );
    await waitForFontsReady();

    // Explicit short name -- without it, toMatchScreenshot() derives the baseline filename from
    // the full "describe > it" title, producing unwieldy ~100-character .png filenames.
    await expect.element(page.getByLabelText('Content block 1 text')).toMatchScreenshot('editor');

    unmount();
  });

  it('student (Review-as-Student) rendering matches its golden baseline', async () => {
    const { unmount } = render(<ReviewAsStudentPreview courseId="course_1" chapters={makeChapters()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: TOPIC_TITLE }));
    await waitForFontsReady();

    await expect.element(page.getByTestId('keyword-text')).toMatchScreenshot('student');

    unmount();
  });
});

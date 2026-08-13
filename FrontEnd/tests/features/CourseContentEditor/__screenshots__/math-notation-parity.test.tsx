import { describe, it, expect, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContentTree } from '@/src/features/CourseContentEditor/ContentTreeNode';
import { ReviewAsStudentPreview } from '@/src/features/CourseContentEditor/ReviewAsStudentPreview';
import type { Chapter } from '@/src/features/CourseContentEditor/useCourseContentTree';
import { createNoopTreeMutators } from '../../../support/noopTreeMutators';
import { waitForFontsReady } from '../../../support/waitForFontsReady';

// Story 3.11/AC#1 -- "strong" parity pair: both ContentTreeNode.tsx (editor) and
// ContentNodeReadingPane.tsx (student, reached here through the real AD-3 Review-as-Student
// cross-feature import, not a directly-instantiated CoursePlayer) call the exact same shared
// renderNotation() function for math blocks. Each screenshot below is compared against its own
// committed baseline; drift in either view's KaTeX rendering is caught independently, and a human
// reviewing the two committed PNGs together confirms they genuinely match.
const BLOCK_ID = 'block_math_wave_speed';
const NOTATION = 'v = f\\lambda';

const makeChapters = (): Chapter[] => [
  {
    id: 'chapter_math',
    title: 'Waves',
    confirmation: 'confirmed',
    topics: [
      {
        id: 'topic_math',
        title: 'Wave Speed',
        confirmation: 'confirmed',
        subtopics: [],
        contentBlocks: [{ id: BLOCK_ID, format: 'math', confirmation: 'confirmed', notation: NOTATION }],
      },
    ],
  },
];

describe('Cross-view visual parity: math notation', () => {
  it('editor rendering matches its golden baseline', async () => {
    const { unmount } = render(
      <ContentTree chapters={makeChapters()} mutators={createNoopTreeMutators()} onAddChapter={vi.fn()} />
    );
    await waitForFontsReady();

    // Explicit short name -- without it, toMatchScreenshot() derives the baseline filename from
    // the full "describe > it" title, producing unwieldy ~100-character .png filenames.
    await expect.element(page.getByTestId(`rendered-notation-${BLOCK_ID}`)).toMatchScreenshot('editor');

    unmount();
  });

  it('student (Review-as-Student) rendering matches its golden baseline', async () => {
    const { unmount } = render(<ReviewAsStudentPreview courseId="course_1" chapters={makeChapters()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Wave Speed' }));
    await waitForFontsReady();

    await expect.element(page.getByTestId(`student-rendered-notation-${BLOCK_ID}`)).toMatchScreenshot('student');

    unmount();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContentTree } from '@/src/features/CourseContentEditor/ContentTreeNode';
import { ReviewAsStudentPreview } from '@/src/features/CourseContentEditor/ReviewAsStudentPreview';
import type { Chapter } from '@/src/features/CourseContentEditor/useCourseContentTree';
import { createNoopTreeMutators } from '../../../support/noopTreeMutators';
import { waitForFontsReady } from '../../../support/waitForFontsReady';

// Story 3.11/AC#1 -- second "strong" parity pair, using mhchem chemistry notation (\ce{...})
// rather than plain math, since KaTeX's mhchem extension has its own separate rendering path
// worth its own regression coverage. Same renderNotation() call on both sides as the math pair.
const BLOCK_ID = 'block_chem_electrolysis';
const NOTATION = '\\ce{2H2O -> 2H2 + O2}';

const makeChapters = (): Chapter[] => [
  {
    id: 'chapter_chem',
    title: 'Chemistry',
    confirmation: 'confirmed',
    topics: [
      {
        id: 'topic_chem',
        title: 'Electrolysis of Water',
        confirmation: 'confirmed',
        subtopics: [],
        contentBlocks: [{ id: BLOCK_ID, format: 'math', confirmation: 'confirmed', notation: NOTATION }],
      },
    ],
  },
];

describe('Cross-view visual parity: chemistry notation (mhchem)', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Electrolysis of Water' }));
    await waitForFontsReady();

    await expect.element(page.getByTestId(`student-rendered-notation-${BLOCK_ID}`)).toMatchScreenshot('student');

    unmount();
  });
});

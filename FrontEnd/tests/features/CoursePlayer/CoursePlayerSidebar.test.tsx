// Story 11.4, Task 4: no test file existed for this component before this story. The outline tree
// renders Chapter/Topic/Sub-Topic/Page levels correctly; selecting a Page calls onSelectPage.
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoursePlayerSidebar } from '@/src/features/CoursePlayer/CoursePlayerSidebar';
import type { OutlineDto } from '@/src/services/courseContentService';
import { Course } from '@/src/types';

const course: Course = {
  id: 'course_1',
  title: 'Quantum Foundations',
  shortDescription: '',
  fullDescription: '',
  subject: 'physics',
  level: 'Beginner',
  type: 'interactive',
  instructor: { name: 'Dr. Rostova', role: 'Professor', avatar: '' },
  rating: 5,
  enrolledCount: 10,
  estimatedHours: 5,
  thumbnail: '',
  badgeIcon: '',
  modules: [],
  prerequisites: [],
};

const outlineWithFullTree: OutlineDto = {
  chapters: [
    {
      id: 'chapter_1',
      title: 'Chemical Reactions',
      description: '',
      isConfirmed: true,
      order: 0,
      pages: [{ id: 'page_chapter', title: 'Chapter Overview', isConfirmed: true, order: 0 }],
      topics: [
        {
          id: 'topic_1',
          title: 'Combustion',
          description: '',
          isConfirmed: true,
          order: 0,
          pages: [{ id: 'page_topic', title: 'Topic Intro', isConfirmed: true, order: 0 }],
          subtopics: [
            {
              id: 'subtopic_1',
              title: 'Combination Reactions',
              description: '',
              isConfirmed: true,
              order: 0,
              pages: [{ id: 'page_subtopic', title: 'Sub-Topic Detail', isConfirmed: true, order: 0 }],
            },
          ],
        },
      ],
    },
  ],
};

const renderSidebar = (outline: OutlineDto | null, onSelectPage = vi.fn()) => {
  render(
    <CoursePlayerSidebar
      show
      course={course}
      currentLessonId="l1"
      onSelectLesson={vi.fn()}
      outline={outline}
      selectedPageId={null}
      onSelectPage={onSelectPage}
    />
  );
  return { onSelectPage };
};

describe('CoursePlayerSidebar', () => {
  it('renders Chapter/Topic/Sub-Topic/Page levels correctly', () => {
    renderSidebar(outlineWithFullTree);

    expect(screen.getByText('Chemical Reactions')).toBeInTheDocument();
    expect(screen.getByText('Combustion')).toBeInTheDocument();
    expect(screen.getByText('Combination Reactions')).toBeInTheDocument();
    expect(screen.getByText('Chapter Overview')).toBeInTheDocument();
    expect(screen.getByText('Topic Intro')).toBeInTheDocument();
    expect(screen.getByText('Sub-Topic Detail')).toBeInTheDocument();
  });

  it('selecting a Page calls onSelectPage with its id', () => {
    const { onSelectPage } = renderSidebar(outlineWithFullTree);

    fireEvent.click(screen.getByRole('button', { name: 'Sub-Topic Detail' }));

    expect(onSelectPage).toHaveBeenCalledWith('page_subtopic');
  });

  it('collapsing a Chapter hides its Pages and child Topics', () => {
    renderSidebar(outlineWithFullTree);

    fireEvent.click(screen.getByRole('button', { name: /Chemical Reactions/ }));

    expect(screen.queryByText('Chapter Overview')).not.toBeInTheDocument();
    expect(screen.queryByText('Combustion')).not.toBeInTheDocument();
  });

  it('renders no outline tree when there are no Chapters yet', () => {
    renderSidebar({ chapters: [] });

    expect(screen.queryByRole('tree', { name: 'Course content' })).not.toBeInTheDocument();
  });

  it('renders no outline tree while the outline is still loading (null)', () => {
    renderSidebar(null);

    expect(screen.queryByRole('tree', { name: 'Course content' })).not.toBeInTheDocument();
  });
});

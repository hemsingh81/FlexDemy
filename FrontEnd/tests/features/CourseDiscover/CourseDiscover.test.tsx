import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CourseDiscover } from '@/src/features/CourseDiscover/CourseDiscover';
import { useCourseDiscover } from '@/src/features/CourseDiscover/useCourseDiscover';
import { Course } from '@/src/types';

vi.mock('@/src/features/CourseDiscover/useCourseDiscover');

const course: Course = {
  id: 'course_1',
  title: 'Quantum Foundations',
  shortDescription: 'An intro to quantum computing.',
  fullDescription: 'A deep dive into quantum computing fundamentals.',
  subject: 'physics',
  level: 'Beginner',
  type: 'interactive',
  instructor: { name: 'Dr. Rostova', role: 'Professor', avatar: '' },
  rating: 4.5,
  enrolledCount: 0,
  estimatedHours: 5,
  thumbnail: '',
  badgeIcon: '',
  modules: [
    {
      id: 'mod_1',
      title: 'Module 1',
      lessons: [{ id: 'l1', title: 'Lesson 1', durationMinutes: 20, sentences: [], drilldowns: {} }],
    },
  ],
  prerequisites: [],
};

describe('CourseDiscover', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(useCourseDiscover).mockReturnValue({ courses: [course], isLoading: false });
  });

  it('renders the course catalog header and the course title', () => {
    render(<CourseDiscover onOpenCourse={vi.fn()} />);
    expect(screen.getByText('Discover Course Library')).toBeInTheDocument();
    expect(screen.getByText('Quantum Foundations')).toBeInTheDocument();
  });

  it('renders nothing while loading', () => {
    vi.mocked(useCourseDiscover).mockReturnValue({ courses: [], isLoading: true });
    const { container } = render(<CourseDiscover onOpenCourse={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('calls onOpenCourse with the course id when enrolling from the catalog', async () => {
    const onOpenCourse = vi.fn();
    const userEventInstance = userEvent.setup();
    render(<CourseDiscover onOpenCourse={onOpenCourse} />);

    await userEventInstance.click(screen.getByText('Enroll Now'));
    expect(onOpenCourse).toHaveBeenCalledWith('course_1');
  });
});

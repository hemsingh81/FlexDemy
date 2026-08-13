import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useExercise } from '../../../src/features/CoursePlayer/useExercise';

describe('useExercise', () => {
  it('a node with no fixture entry resolves exercise: null without an error state', async () => {
    const { result } = renderHook(() => useExercise('course_1', 'does_not_exist'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.exercise).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('loads a numeric exercise and grades submit() with tolerance for formatting', async () => {
    const { result } = renderHook(() => useExercise('course_1', 'subtopic_1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.exercise?.answerType).toBe('numeric');

    act(() => result.current.submit('3.0'));

    expect(result.current.submission?.isCorrect).toBe(true);
    expect(result.current.submission?.feedbackText).toBe(result.current.exercise?.feedback);
  });

  it('rejects numeric submissions with trailing non-numeric text rather than false-positive matching a leading prefix', async () => {
    const { result } = renderHook(() => useExercise('course_1', 'subtopic_1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Number.parseFloat("3xyz") === 3, which would incorrectly match the reference answer "3" --
    // the grader must require the whole (trimmed) submission to be numeric, not just a prefix.
    act(() => result.current.submit('3xyz'));
    expect(result.current.submission?.isCorrect).toBe(false);

    act(() => result.current.reset());
    act(() => result.current.submit('3 meters'));
    expect(result.current.submission?.isCorrect).toBe(false);

    act(() => result.current.reset());
    act(() => result.current.submit(''));
    expect(result.current.submission?.isCorrect).toBe(false);
  });

  it('an incorrect numeric submission still returns feedback, just isCorrect: false', async () => {
    const { result } = renderHook(() => useExercise('course_1', 'subtopic_1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.submit('99'));

    expect(result.current.submission?.isCorrect).toBe(false);
    expect(result.current.submission?.feedbackText).not.toBe('');
  });

  it('grades a multipleChoice submission with case-insensitive, whitespace-trimmed matching', async () => {
    const { result } = renderHook(() => useExercise('course_1', 'subtopic_2'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.exercise?.answerType).toBe('multipleChoice');
    expect(result.current.exercise?.options?.length).toBeGreaterThanOrEqual(3);

    act(() => result.current.submit('  A DISTURBANCE THAT TRANSFERS ENERGY WITHOUT TRANSFERRING MATTER  '));

    expect(result.current.submission?.isCorrect).toBe(true);
  });

  it('grades a shortText submission with case-insensitive, whitespace-trimmed matching', async () => {
    const { result } = renderHook(() => useExercise('course_1', 'topic_1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.exercise?.answerType).toBe('shortText');

    act(() => result.current.submit('  ENERGY  '));

    expect(result.current.submission?.isCorrect).toBe(true);
  });

  it('reset() clears the submission so the exercise can be retried', async () => {
    const { result } = renderHook(() => useExercise('course_1', 'subtopic_1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.submit('3'));
    expect(result.current.submission).not.toBeNull();

    act(() => result.current.reset());
    expect(result.current.submission).toBeNull();
  });
});

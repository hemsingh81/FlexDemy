import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDrilldownContent } from '../../../src/features/CoursePlayer/useDrilldownContent';

describe('useDrilldownContent', () => {
  it('starts at unlockedLevel 1 and loads mock data keyed by nodeId', async () => {
    const { result } = renderHook(() => useDrilldownContent('course_1', 'subtopic_1'));

    expect(result.current.unlockedLevel).toBe(1);
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).not.toBeNull();
    expect(result.current.data).toHaveLength(5);
    expect(result.current.data?.[0].level).toBe(1);
  });

  it('returns null data for an unknown nodeId', async () => {
    const { result } = renderHook(() => useDrilldownContent('course_1', 'does_not_exist'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBeNull();
  });

  it('revealNextLevel increments unlockedLevel by exactly one and caps at 5', async () => {
    const { result } = renderHook(() => useDrilldownContent('course_1', 'subtopic_1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.unlockedLevel).toBe(1);

    act(() => result.current.revealNextLevel());
    expect(result.current.unlockedLevel).toBe(2);

    act(() => result.current.revealNextLevel());
    act(() => result.current.revealNextLevel());
    act(() => result.current.revealNextLevel());
    expect(result.current.unlockedLevel).toBe(5);

    act(() => result.current.revealNextLevel());
    expect(result.current.unlockedLevel).toBe(5);
  });

  it('resets unlockedLevel to 1 when nodeId changes', async () => {
    const { result, rerender } = renderHook(
      ({ nodeId }: { nodeId: string }) => useDrilldownContent('course_1', nodeId),
      { initialProps: { nodeId: 'subtopic_1' } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.revealNextLevel());
    expect(result.current.unlockedLevel).toBe(2);

    rerender({ nodeId: 'topic_2' });

    expect(result.current.unlockedLevel).toBe(1);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.[2].isOverridden).toBe(true);
  });
});

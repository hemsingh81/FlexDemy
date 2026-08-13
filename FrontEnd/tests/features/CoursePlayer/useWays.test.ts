import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWays } from '../../../src/features/CoursePlayer/useWays';

describe('useWays', () => {
  it('starts at activeWayIndex 0 and loads exactly 5 mock ways keyed by nodeId', async () => {
    const { result } = renderHook(() => useWays('course_1', 'subtopic_1'));

    expect(result.current.activeWayIndex).toBe(0);
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.ways).toHaveLength(5);
  });

  it('setActiveWayIndex is freely settable to any index with no gating (no lock state)', async () => {
    const { result } = renderHook(() => useWays('course_1', 'subtopic_1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setActiveWayIndex(4));
    expect(result.current.activeWayIndex).toBe(4);

    act(() => result.current.setActiveWayIndex(1));
    expect(result.current.activeWayIndex).toBe(1);

    act(() => result.current.setActiveWayIndex(0));
    expect(result.current.activeWayIndex).toBe(0);
  });

  it('returns an empty ways array for an unknown nodeId', async () => {
    const { result } = renderHook(() => useWays('course_1', 'does_not_exist'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.ways).toEqual([]);
  });

  it('resets activeWayIndex to 0 when nodeId changes', async () => {
    const { result, rerender } = renderHook(({ nodeId }: { nodeId: string }) => useWays('course_1', nodeId), {
      initialProps: { nodeId: 'subtopic_1' },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setActiveWayIndex(3));
    expect(result.current.activeWayIndex).toBe(3);

    rerender({ nodeId: 'topic_2' });

    expect(result.current.activeWayIndex).toBe(0);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.ways).toHaveLength(5);
    expect(result.current.ways.some((way) => way.isOverridden)).toBe(true);
  });
});

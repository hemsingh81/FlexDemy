import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useKeywordDefinition } from '../../../src/features/CoursePlayer/useKeywordDefinition';

describe('useKeywordDefinition', () => {
  it('define() sets activeKeyword immediately and resolves definition after the mock delay', async () => {
    const { result } = renderHook(() => useKeywordDefinition('course_1'));

    act(() => result.current.define('wave'));

    expect(result.current.activeKeyword).toBe('wave');
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.definition).not.toBeNull();
  });

  it('is case-insensitive when looking up the definition', async () => {
    const { result } = renderHook(() => useKeywordDefinition('course_1'));

    act(() => result.current.define('WAVE'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.definition).not.toBeNull();
  });

  it('an unknown keyword resolves definition: null, not an error', async () => {
    const { result } = renderHook(() => useKeywordDefinition('course_1'));

    act(() => result.current.define('nonexistent'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.definition).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('dismiss() clears both activeKeyword and definition', async () => {
    const { result } = renderHook(() => useKeywordDefinition('course_1'));

    act(() => result.current.define('wave'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.dismiss());

    expect(result.current.activeKeyword).toBeNull();
    expect(result.current.definition).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('a second define() call before the first resolves only settles on the latest keyword', async () => {
    const { result } = renderHook(() => useKeywordDefinition('course_1'));

    act(() => result.current.define('wave'));
    act(() => result.current.define('frequency'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeKeyword).toBe('frequency');
    expect(result.current.definition).not.toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { PAGE_TRANSITION_FADE_MS, usePageTransition } from '@/src/hooks/usePageTransition';

// jsdom's requestAnimationFrame isn't reliably driven by vi.useFakeTimers()'s timer advancement,
// so it's stubbed here as a plain macrotask (setTimeout) -- this lets the two nested "flip
// visible next frame" rAFs be flushed deterministically via vi.advanceTimersByTime, the same way
// the fade-out -> swap setTimeout is.
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(0), 0) as unknown as number) as typeof requestAnimationFrame);
  vi.stubGlobal('cancelAnimationFrame', ((id: number) => clearTimeout(id)) as typeof cancelAnimationFrame);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// Advances past the fade-out setTimeout, then flushes every timer it chains to (the two
// nested stubbed rAFs) so a transition fully settles. vi.runAllTimers() (rather than a fixed
// number of advanceTimersByTime(0) calls) is used for the second step because it keeps draining
// newly-scheduled timers until none are left, which is what's needed for a *chain* of
// zero-delay timeouts (raf1's callback schedules raf2).
const flushTransition = () => {
  act(() => {
    vi.advanceTimersByTime(PAGE_TRANSITION_FADE_MS);
  });
  act(() => {
    vi.runAllTimers();
  });
};

describe('usePageTransition', () => {
  it('shows the initial content immediately and fully visible, with no fade-in from nothing on first mount', () => {
    const { result } = renderHook(() => usePageTransition('a', 'Content A'));

    expect(result.current.displayedKey).toBe('a');
    expect(result.current.displayedContent).toBe('Content A');
    expect(result.current.isVisible).toBe(true);
  });

  it('fades the old content out, then swaps to the new content and fades it in on a key change', () => {
    const { result, rerender } = renderHook(({ k, c }) => usePageTransition(k, c), {
      initialProps: { k: 'a', c: 'Content A' },
    });

    act(() => {
      rerender({ k: 'b', c: 'Content B' });
    });

    // Old content stays on screen, now fading out -- not swapped in the same render.
    expect(result.current.displayedKey).toBe('a');
    expect(result.current.displayedContent).toBe('Content A');
    expect(result.current.isVisible).toBe(false);

    act(() => {
      vi.advanceTimersByTime(PAGE_TRANSITION_FADE_MS);
    });

    // Swapped to the new content, but still invisible until the next-frame flip.
    expect(result.current.displayedKey).toBe('b');
    expect(result.current.displayedContent).toBe('Content B');
    expect(result.current.isVisible).toBe(false);

    act(() => {
      vi.runAllTimers();
    });

    expect(result.current.isVisible).toBe(true);
  });

  it('rapid consecutive key changes settle on the latest content, not a stale intermediate one', () => {
    const { result, rerender } = renderHook(({ k, c }) => usePageTransition(k, c), {
      initialProps: { k: 'a', c: 'Content A' },
    });

    act(() => {
      rerender({ k: 'b', c: 'Content B' });
      rerender({ k: 'c', c: 'Content C' });
    });

    flushTransition();

    expect(result.current.displayedKey).toBe('c');
    expect(result.current.displayedContent).toBe('Content C');
    expect(result.current.isVisible).toBe(true);
  });

  it('does not throw and settles fully visible when the key flips back before the fade-out finishes', () => {
    const { result, rerender } = renderHook(({ k, c }) => usePageTransition(k, c), {
      initialProps: { k: 'a', c: 'Content A' },
    });

    act(() => {
      rerender({ k: 'b', c: 'Content B' });
    });
    expect(result.current.isVisible).toBe(false);

    expect(() => {
      act(() => {
        rerender({ k: 'a', c: 'Content A (again)' });
      });
      act(() => {
        vi.advanceTimersByTime(PAGE_TRANSITION_FADE_MS + 50);
      });
    }).not.toThrow();

    // Never left mid-transition or stuck invisible -- back to 'a', fully visible, fresh content.
    expect(result.current.displayedKey).toBe('a');
    expect(result.current.displayedContent).toBe('Content A (again)');
    expect(result.current.isVisible).toBe(true);
  });

  it('does not throw when unmounted mid-transition (pending timers/rAFs are cleaned up)', () => {
    const { rerender, unmount } = renderHook(({ k, c }) => usePageTransition(k, c), {
      initialProps: { k: 'a', c: 'Content A' },
    });

    act(() => {
      rerender({ k: 'b', c: 'Content B' });
    });

    expect(() => {
      unmount();
      act(() => {
        vi.advanceTimersByTime(PAGE_TRANSITION_FADE_MS + 50);
      });
    }).not.toThrow();
  });
});

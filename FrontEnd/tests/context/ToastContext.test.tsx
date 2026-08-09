import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider, useToast, TOAST_AUTO_DISMISS_MS } from '@/src/context/ToastContext';

// Same rAF-as-macrotask stubbing hooks/usePageTransition.test.ts uses -- jsdom's
// requestAnimationFrame isn't reliably driven by vi.useFakeTimers()'s timer advancement, so it's
// stubbed as a plain zero-delay setTimeout. That lets the two nested "flip visible next frame"
// rAFs this provider schedules (mirroring usePageTransition.ts's own mount-hidden-then-flip
// pattern) be flushed deterministically via vi.advanceTimersByTime(0), without also tripping the
// far-future auto-dismiss timer that's scheduled in the same call.
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

// Flushes just the two chained zero-delay rAF timeouts (the mount -> visible flip) by running
// exactly the next-scheduled timer twice -- rather than vi.runAllTimers(), which would also fire
// the much-longer TOAST_AUTO_DISMISS_MS timer that's pending alongside them (and, transitively,
// the exit-transition timer dismiss() schedules from it), unmounting the toast before the
// assertions below ever get to see it visible.
const flushMountFlip = () => {
  act(() => {
    vi.advanceTimersToNextTimer();
  });
  act(() => {
    vi.advanceTimersToNextTimer();
  });
};

function Probe() {
  const { showToast } = useToast();
  return (
    <div>
      <button onClick={() => showToast({ message: 'Country created.', variant: 'success' })}>Fire success</button>
      <button onClick={() => showToast({ message: 'Heads up.' })}>Fire info</button>
    </div>
  );
}

describe('useToast() outside a ToastProvider', () => {
  it('is a safe no-op rather than throwing (many existing screens render without a mounted ToastProvider)', () => {
    function Standalone() {
      const { showToast } = useToast();
      return <button onClick={() => showToast({ message: 'x' })}>Fire</button>;
    }
    render(<Standalone />);

    expect(() => fireEvent.click(screen.getByText('Fire'))).not.toThrow();
  });
});

describe('ToastProvider / useToast', () => {
  it('mounts a toast hidden, then flips it visible on the next frame', () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Fire success'));

    const toastNode = screen.getByText('Country created.').closest('[role="status"]') as HTMLElement;
    expect(toastNode).toBeInTheDocument();
    expect(toastNode.className).toMatch(/opacity-0/);

    flushMountFlip();

    expect(toastNode.className).toMatch(/opacity-100/);
  });

  it('auto-dismisses after TOAST_AUTO_DISMISS_MS, animating out before actually unmounting', () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Fire success'));
    flushMountFlip();
    const toastNode = screen.getByText('Country created.').closest('[role="status"]') as HTMLElement;

    act(() => {
      vi.advanceTimersByTime(TOAST_AUTO_DISMISS_MS);
    });

    // Exit transition started (visible -> false) but the node is still mounted.
    expect(screen.getByText('Country created.')).toBeInTheDocument();
    expect(toastNode.className).toMatch(/opacity-0/);

    act(() => {
      vi.runAllTimers();
    });

    expect(screen.queryByText('Country created.')).not.toBeInTheDocument();
  });

  it('is manually dismissible via its close button before the auto-dismiss timer fires', () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Fire success'));
    flushMountFlip();

    fireEvent.click(screen.getByLabelText('Dismiss notification'));
    act(() => {
      vi.runAllTimers();
    });

    expect(screen.queryByText('Country created.')).not.toBeInTheDocument();
  });

  it('stacks multiple toasts at once instead of replacing the previous one', () => {
    render(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Fire success'));
    fireEvent.click(screen.getByText('Fire info'));
    flushMountFlip();

    expect(screen.getByText('Country created.')).toBeInTheDocument();
    expect(screen.getByText('Heads up.')).toBeInTheDocument();
  });

  it('does not throw when unmounted with toasts/timers still pending', () => {
    const { unmount } = render(
      <ToastProvider>
        <Probe />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Fire success'));

    expect(() => {
      unmount();
      act(() => {
        vi.runAllTimers();
      });
    }).not.toThrow();
  });
});

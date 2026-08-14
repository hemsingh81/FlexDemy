import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as errorsService from '@/src/services/errorsService';
import { ErrorBoundary } from '@/src/ErrorBoundary';

vi.mock('@/src/services/errorsService', async () => {
  const actual = await vi.importActual('@/src/services/errorsService');
  return { ...actual, reportError: vi.fn().mockResolvedValue(undefined) };
});

const Bomb = () => {
  throw new Error('kaboom');
};

const StringBomb = () => {
  throw 'a plain string, not an Error instance';
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.mocked(errorsService.reportError).mockClear();
    // React logs its own error boundary warning to console.error -- expected noise for this
    // test, not a real assertion target.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('renders the fallback UI instead of crashing when a child throws during render', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('kaboom')).not.toBeInTheDocument();
  });

  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('All good')).toBeInTheDocument();
  });

  it('reports the caught error via errorsService.reportError', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    );

    expect(errorsService.reportError).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(errorsService.reportError).mock.calls[0][0];
    expect(payload.message).toBe('kaboom');
    expect(typeof payload.url).toBe('string');
    expect(typeof payload.userAgent).toBe('string');
    expect(typeof payload.timestamp).toBe('string');
  });

  // Code-review patch: React passes through whatever was actually thrown, regardless of what
  // componentDidCatch's TS signature claims -- a component can throw a plain string or object,
  // not just an Error instance.
  it('still renders the fallback UI and reports a real message when a child throws a non-Error value', () => {
    render(
      <ErrorBoundary>
        <StringBomb />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(errorsService.reportError).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(errorsService.reportError).mock.calls[0][0];
    expect(payload.message).toBe('a plain string, not an Error instance');
  });
});

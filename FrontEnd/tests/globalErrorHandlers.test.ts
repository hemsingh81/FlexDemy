import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import * as errorsService from '@/src/services/errorsService';
import { registerGlobalErrorHandlers } from '@/src/globalErrorHandlers';

vi.mock('@/src/services/errorsService', async () => {
  const actual = await vi.importActual('@/src/services/errorsService');
  return { ...actual, reportError: vi.fn().mockResolvedValue(undefined) };
});

describe('globalErrorHandlers', () => {
  // Registered exactly once for the whole suite -- calling it per-test would stack duplicate
  // window listeners (registerGlobalErrorHandlers has no unregister/idempotency guard, matching
  // its real call site: main.tsx invokes it exactly once at app startup).
  beforeAll(() => {
    registerGlobalErrorHandlers();
  });

  beforeEach(() => {
    vi.mocked(errorsService.reportError).mockClear();
  });

  it('reports a raw window "error" event (e.g. from setTimeout or a raw event handler)', () => {
    const error = new Error('outside React');
    const event = new ErrorEvent('error', { message: 'outside React', error });
    window.dispatchEvent(event);

    expect(errorsService.reportError).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(errorsService.reportError).mock.calls[0][0];
    expect(payload.message).toBe('outside React');
    expect(payload.stack).toBe(error.stack);
    expect(typeof payload.url).toBe('string');
    expect(typeof payload.userAgent).toBe('string');
    expect(typeof payload.timestamp).toBe('string');
  });

  it('reports an unhandled Promise rejection with an Error reason', () => {
    const reason = new Error('rejected without a .catch()');
    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(event, 'reason', { value: reason });
    Object.defineProperty(event, 'promise', { value: Promise.reject(reason).catch(() => undefined) });
    window.dispatchEvent(event);

    expect(errorsService.reportError).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(errorsService.reportError).mock.calls[0][0];
    expect(payload.message).toBe('rejected without a .catch()');
    expect(payload.stack).toBe(reason.stack);
  });

  it('reports an unhandled Promise rejection whose reason is not an Error', () => {
    const event = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(event, 'reason', { value: 'plain string rejection' });
    Object.defineProperty(event, 'promise', { value: Promise.reject('plain string rejection').catch(() => undefined) });
    window.dispatchEvent(event);

    expect(errorsService.reportError).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(errorsService.reportError).mock.calls[0][0];
    expect(payload.message).toBe('plain string rejection');
  });
});

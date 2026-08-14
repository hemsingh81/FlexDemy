// PRD FR-6: catches errors React's Error Boundary can't -- a raw exception outside the render
// cycle (setTimeout, a raw event handler) or a rejected Promise with no .catch(). Registered
// once from main.tsx before the app renders.
import { reportError } from './services/errorsService';

const buildBasePayload = () => ({
  url: window.location.href,
  userAgent: navigator.userAgent,
  timestamp: new Date().toISOString(),
});

export const registerGlobalErrorHandlers = (): void => {
  window.addEventListener('error', (event: ErrorEvent) => {
    void reportError({
      message: event.message,
      stack: event.error instanceof Error ? event.error.stack : undefined,
      ...buildBasePayload(),
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    void reportError({
      message: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
      ...buildBasePayload(),
    });
  });
};

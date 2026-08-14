import React, { useEffect, useRef, useState } from 'react';
import * as errorsService from '../../../services/errorsService';
import { SidePanel } from '../../../ui/SidePanel';
import { Spinner } from '../../../ui/Spinner';
import { Button } from '../../../ui/Button';
import { PRIORITY_BADGE_CLASSES, STATUS_BADGE_CLASSES, humanizeEnumValue } from './errorLogConstants';

interface ErrorDetailPanelProps {
  id: string;
  onClose: () => void;
  // Story 4.7/AC #1, #3: clicking the Correlation ID filters the list behind this panel to only
  // records sharing that exact trace. Lifted up rather than owned here -- ErrorLog.tsx holds the
  // filter state (useErrorLog), so this component just reports the click.
  onCorrelationIdClick: (correlationId: string) => void;
}

// Story 4.6/AC #1, #2, #4. Keyed by action name so at most one action's button shows its own
// loading spinner at a time -- matches this codebase's existing single-in-flight-action pattern.
type LifecycleAction = 'archive' | 'resolve' | 'increase-priority';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide mb-1">{label}</div>
    <div className="text-sm text-[#142030]">{children}</div>
  </div>
);

// AC #4: full untruncated StackTrace, RequestPath/Route, OriginContext, occurrence timeline,
// plus a related-entity link when RelatedEntityType/RelatedEntityId is set. [ASSUMPTION per the
// story's own Task 10 note: the exact deep-link target per RelatedEntityType isn't specified by
// the PRD -- rendered here as plain text with the id, not a live link, until a concrete route is
// confirmed.] Self-contained fetch (own loading/error state) rather than requiring the parent to
// pre-fetch, so ErrorLog.tsx only needs to pass the id of whichever row was clicked.
export const ErrorDetailPanel: React.FC<ErrorDetailPanelProps> = ({ id, onClose, onCorrelationIdClick }) => {
  const [detail, setDetail] = useState<errorsService.ErrorRecordDetailDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<LifecycleAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Code-review patch: idRef/mountedRef guard every fetch (initial load AND the post-action
  // silent refetch below) against applying a stale result -- either because the panel was
  // closed (SidePanel calls onClose synchronously for both Escape and closeOnBackdropClick) or
  // because `id` changed to a different record while a fetch was still in flight.
  const idRef = useRef(id);
  const mountedRef = useRef(true);

  // `silent`: the post-action refetch (runAction below) must not flip isLoading/reset error --
  // that would tear down the whole populated panel back to a full-page spinner on every
  // Archive/Resolve/Increase Priority click, discarding the admin's place in the view for what
  // should be a targeted, in-place refresh.
  const fetchDetail = (options?: { silent?: boolean }) => {
    const requestId = idRef.current;
    const silent = options?.silent ?? false;
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }
    errorsService
      .getErrorDetail(requestId)
      .then((dto) => {
        if (mountedRef.current && idRef.current === requestId) setDetail(dto);
      })
      .catch((err: unknown) => {
        if (!silent && mountedRef.current && idRef.current === requestId) {
          setError(err instanceof Error ? err.message : 'Could not load this error.');
        }
      })
      .finally(() => {
        if (!silent && mountedRef.current && idRef.current === requestId) setIsLoading(false);
      });
  };

  useEffect(() => {
    idRef.current = id;
    mountedRef.current = true;
    setDetail(null);
    fetchDetail();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // On success, silently re-fetch this record's own detail so the admin immediately sees the
  // new Status/Priority/timestamp without the panel flashing back to a loading state. The list
  // behind this panel picks up the change on its own next filter/page change -- the story's Dev
  // Notes call out that either choice is acceptable and the PRD doesn't mandate a live-refreshing
  // list.
  const runAction = (action: LifecycleAction, run: () => Promise<void>) => {
    setPendingAction(action);
    setActionError(null);
    run()
      .then(() => fetchDetail({ silent: true }))
      .catch((err: unknown) => {
        if (mountedRef.current) setActionError(err instanceof Error ? err.message : 'Could not complete this action.');
      })
      .finally(() => {
        if (mountedRef.current) setPendingAction(null);
      });
  };

  return (
    <SidePanel title="Error Detail" onClose={onClose} closeOnBackdropClick width="lg">
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-[#5E6A79]">
          <Spinner size="lg" className="mr-2" />
          <span className="text-sm">Loading...</span>
        </div>
      ) : error ? (
        <p role="alert" className="text-xs font-semibold text-red-600">
          {error}
        </p>
      ) : detail ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${PRIORITY_BADGE_CLASSES[detail.priority] ?? 'bg-slate-100 text-slate-600'}`}>
              {detail.priority}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${STATUS_BADGE_CLASSES[detail.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {detail.status}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              isLoading={pendingAction === 'archive'}
              disabled={detail.status === 'Archived' || pendingAction !== null}
              onClick={() => runAction('archive', () => errorsService.archiveError(detail.id))}
            >
              Archive
            </Button>
            <Button
              variant="secondary"
              size="sm"
              isLoading={pendingAction === 'resolve'}
              disabled={detail.status === 'Resolved' || pendingAction !== null}
              onClick={() => runAction('resolve', () => errorsService.resolveError(detail.id))}
            >
              Mark Resolved
            </Button>
            <Button
              variant="primary"
              size="sm"
              isLoading={pendingAction === 'increase-priority'}
              disabled={detail.priority === 'P0' || pendingAction !== null}
              onClick={() => runAction('increase-priority', () => errorsService.increasePriority(detail.id))}
            >
              Increase Priority
            </Button>
          </div>
          {actionError && (
            <p role="alert" className="text-xs font-semibold text-red-600">
              {actionError}
            </p>
          )}
          <Field label="Category">{humanizeEnumValue(detail.category)}</Field>
          <Field label="Message">{detail.message}</Field>
          {detail.exceptionType && <Field label="Exception Type">{detail.exceptionType}</Field>}
          <Field label="Source">{detail.source}</Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Occurrences">{detail.occurrenceCount}</Field>
            <Field label="First Occurred">{new Date(detail.firstOccurredAt).toLocaleString()}</Field>
          </div>
          <Field label="Last Occurred">{new Date(detail.lastOccurredAt).toLocaleString()}</Field>
          {detail.requestPath && <Field label="Request Path">{detail.requestPath}</Field>}
          {detail.originContext && <Field label="Origin Context">{detail.originContext}</Field>}
          {detail.correlationId && (
            <div>
              <div className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide mb-1">Correlation ID</div>
              <button
                type="button"
                className="text-sm text-[#BA5012] font-semibold underline underline-offset-2 hover:text-[#BA5012]/80 cursor-pointer"
                onClick={() => {
                  onCorrelationIdClick(detail.correlationId!);
                  onClose();
                }}
              >
                {detail.correlationId}
              </button>
            </div>
          )}
          {detail.relatedEntityType && (
            <Field label="Related Entity">
              {detail.relatedEntityType} ({detail.relatedEntityId})
            </Field>
          )}
          <div>
            <div className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide mb-1">Stack Trace</div>
            <pre className="whitespace-pre-wrap text-xs bg-[#F3F0E6] rounded-lg p-3 overflow-x-auto text-[#142030]">
              {detail.stackTrace ?? 'No stack trace captured.'}
            </pre>
          </div>
        </div>
      ) : null}
    </SidePanel>
  );
};

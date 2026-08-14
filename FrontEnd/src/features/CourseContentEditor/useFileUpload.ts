import { useEffect, useRef, useState } from 'react';
import { deleteFile as deleteFileRequest, getFiles, uploadFile, type CourseFileDto } from '../../services/courseFileService';

export type FileUploadStatus = 'queued' | 'parsing' | 'done' | 'failed';

const KNOWN_STATUSES: readonly FileUploadStatus[] = ['queued', 'parsing', 'done', 'failed'];

export interface FileUploadEntry {
  id: string;
  name: string;
  sizeBytes: number;
  status: FileUploadStatus;
  // Story 2.6: populated only when status === 'failed' -- the server's specific rejection
  // reason (PRD FR-11), surfaced by CourseContentEditor.tsx's FileRow.
  failureReason?: string;
  // Populated once status === 'done' -- the raw text Docling parsed from this file, with no AI
  // structuring step in between. Undefined while pending/failed, or before the first server sync.
  parsedContent?: string | null;
}

// How often to poll getFiles() for the async scan/parse outcome while any file is in a
// non-terminal status -- matches this codebase's existing named-constant convention for tunable
// timing (e.g. ToastContext.tsx's TOAST_AUTO_DISMISS_MS).
export const FILE_POLL_INTERVAL_MS = 3000;

const NON_TERMINAL_STATUSES: readonly FileUploadStatus[] = ['queued', 'parsing'];

let pendingIdSeq = 0;
const nextPendingId = () => `pending_${++pendingIdSeq}`;

// Backend serializes Status via enum.ToString() (PascalCase, e.g. "Queued") -- lower-cased here
// to match this hook's own lower-case FileUploadStatus union. Code-review patch: falls back to
// 'queued' for anything the frontend doesn't recognize, rather than propagating an invalid value
// into FileUploadEntry.status (which every STATUS_LABEL/STATUS_BADGE_CLASSES lookup in
// CourseContentEditor.tsx assumes is always one of the 5 known values).
const toStatus = (raw: string): FileUploadStatus => {
  const lowered = raw.toLowerCase();
  return (KNOWN_STATUSES as readonly string[]).includes(lowered) ? (lowered as FileUploadStatus) : 'queued';
};

const toEntry = (dto: CourseFileDto, name: string, sizeBytes: number): FileUploadEntry => ({
  id: dto.id,
  name,
  sizeBytes,
  status: toStatus(dto.status),
  failureReason: dto.failureReason ?? undefined,
  parsedContent: dto.parsedContent,
});

interface UseFileUploadResult {
  data: FileUploadEntry[];
  isLoading: boolean;
  error: string | null;
  addFiles: (files: File[]) => void;
  retryFile: (id: string) => void;
  // Permanently deletes an uploaded file (server + local list). Optimistic: removes the row
  // immediately, restoring it if the server call fails.
  deleteFile: (id: string) => void;
  // Clears the file list, cancels the poll, and forgets every retained File -- called by the
  // caller when the screen closes or switches to a different draft.
  resetFiles: () => void;
}

// Feature-local hook (AD-2). Story 2.6 live-wires this against real courseFileService.ts
// upload/scan-status calls, keeping the exact same { data, isLoading, error } + mutator shape
// (AD-1) Story 2.2's mock hook already established.
export const useFileUpload = (courseId: string | null): UseFileUploadResult => {
  const [data, setData] = useState<FileUploadEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Retains the raw File behind each entry's *current* id so retryFile can re-submit it -- the
  // file picker's <input> doesn't retain rejected files by default. Re-keyed whenever a pending
  // local id is swapped for the server-issued one (addFiles/retryFile below).
  const filesRef = useRef<Map<string, File>>(new Map());
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Code-review patch: ids with an upload/retry currently in flight -- excluded from poll
  // reconciliation below, otherwise a poll tick landing between retryFile's optimistic 'queued'
  // reset and the retry's own response can flip the row back to its stale 'failed' state.
  const inFlightIdsRef = useRef<Set<string>>(new Set());

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  // Reconciles a getFiles() response into local state by matching on id, overwriting
  // status/failureReason for entries whose server status changed. A pending (not-yet-uploaded)
  // entry, or one currently mid-retry, has no reliable server counterpart yet and is left alone.
  const applyServerFiles = (dtos: CourseFileDto[]) => {
    setData((prev) =>
      prev.map((entry) => {
        if (inFlightIdsRef.current.has(entry.id)) return entry;
        const match = dtos.find((d) => d.id === entry.id);
        if (!match) return entry;
        return {
          ...entry,
          status: toStatus(match.status),
          failureReason: match.failureReason ?? undefined,
          parsedContent: match.parsedContent,
        };
      })
    );
  };

  // Polls while any file is in a non-terminal status (queued/parsing) -- not just queued alone,
  // since Story 2.7 drives files through parsing too. Stops itself
  // once every file has reached a terminal status (done/failed). Matches useCourseDraft.ts's
  // useEffect-cascading-fetch idiom.
  useEffect(() => {
    const hasNonTerminal = data.some((f) => NON_TERMINAL_STATUSES.includes(f.status));
    if (!courseId || !hasNonTerminal) {
      stopPolling();
      return;
    }
    if (!pollTimerRef.current) {
      pollTimerRef.current = setInterval(() => {
        getFiles(courseId)
          .then(applyServerFiles)
          // A transient poll failure isn't the user's active request -- the next tick retries;
          // it doesn't surface as the hook's error state.
          .catch(() => undefined);
      }, FILE_POLL_INTERVAL_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, courseId]);

  // Cancels the poll on unmount -- without this, a long-lived timer keeps firing setData after
  // the component is gone.
  useEffect(() => () => stopPolling(), []);

  // Code-review patch: without this, reopening the Content Editor for a course that already has
  // files uploaded from a prior session showed an empty list -- GetFilesAsync's own stated
  // purpose (backend Dev Notes) is exactly to make that history visible. Merges in any
  // server-known file not already present locally (addFiles' own optimistic entries, still
  // in flight, are left alone).
  useEffect(() => {
    if (!courseId) return undefined;
    let cancelled = false;
    getFiles(courseId)
      .then((dtos) => {
        if (cancelled) return;
        setData((prev) => {
          const knownIds = new Set(prev.map((f) => f.id));
          const fromServer = dtos.filter((d) => !knownIds.has(d.id)).map((d) => toEntry(d, d.fileName, d.sizeBytes));
          return fromServer.length === 0 ? prev : [...fromServer, ...prev];
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const uploadOne = (pendingId: string, file: File) => {
    if (!courseId) return;
    setIsLoading(true);
    inFlightIdsRef.current.add(pendingId);
    uploadFile(courseId, file)
      .then((dto) => {
        const entry = toEntry(dto, file.name, file.size);
        filesRef.current.delete(pendingId);
        filesRef.current.set(entry.id, file);
        inFlightIdsRef.current.delete(pendingId);
        setData((prev) => prev.map((f) => (f.id === pendingId ? entry : f)));
      })
      .catch((e) => {
        inFlightIdsRef.current.delete(pendingId);
        const reason = e instanceof Error ? e.message : 'Could not upload this file. Please try again.';
        setData((prev) => prev.map((f) => (f.id === pendingId ? { ...f, status: 'failed', failureReason: reason } : f)));
      })
      .finally(() => setIsLoading(false));
  };

  // Fans out into one independent uploadFile call per file, matching the backend's
  // single-file-per-request endpoint -- a rejection on one file must not block or roll back the
  // others (AC#2).
  const addFiles = (files: File[]) => {
    if (!courseId) {
      setError('Your course draft has not been saved yet. Please try again.');
      return;
    }
    setError(null);

    files.forEach((file) => {
      const pendingId = nextPendingId();
      filesRef.current.set(pendingId, file);
      setData((prev) => [...prev, { id: pendingId, name: file.name, sizeBytes: file.size, status: 'queued' }]);
      uploadOne(pendingId, file);
    });
  };

  const retryFile = (id: string) => {
    // Only a failed entry (with its original File still retained) can be retried -- the UI
    // already only ever shows a Retry button on a failed row, but the hook itself shouldn't
    // trust that.
    const entry = data.find((f) => f.id === id);
    const file = filesRef.current.get(id);
    if (!entry || entry.status !== 'failed' || !file || !courseId) return;

    setData((prev) => prev.map((f) => (f.id === id ? { ...f, status: 'queued', failureReason: undefined } : f)));
    uploadOne(id, file);
  };

  const deleteFile = (id: string) => {
    if (!courseId) return;
    const removed = data.find((f) => f.id === id);
    setData((prev) => prev.filter((f) => f.id !== id));
    deleteFileRequest(courseId, id).catch(() => {
      // Restore the row if the delete failed server-side, rather than leaving the UI silently
      // out of sync with what's actually still there.
      if (removed) setData((prev) => [...prev, removed]);
      setError('Could not delete this file. Please try again.');
    });
  };

  const resetFiles = () => {
    stopPolling();
    filesRef.current.clear();
    inFlightIdsRef.current.clear();
    setData([]);
    setError(null);
  };

  return { data, isLoading, error, addFiles, retryFile, deleteFile, resetFiles };
};

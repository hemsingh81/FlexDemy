// ErrorObservability PRD FR-6/FR-7: the frontend's single reporting path for uncaught errors --
// consumed by ErrorBoundary.tsx, globalErrorHandlers.ts, and nothing else. FR-23/AD-7: reads
// httpClient.ts's current correlation ID into the payload when one is available.
import { request, getCurrentCorrelationId } from './httpClient';

export interface ReportErrorPayload {
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  timestamp: string;
}

// AC #3: must never itself surface a visible error to the user, even if the report fails --
// swallow both a network failure and a non-ok backend response (ErrorReportingController
// itself always returns 202 per Story 4.4's Task 7, but this stays defensive regardless).
export const reportError = async (payload: ReportErrorPayload): Promise<void> => {
  try {
    const correlationId = getCurrentCorrelationId();
    await request('/api/v1/errors/client', 'POST', {
      ...payload,
      ...(correlationId ? { correlationId } : {}),
    });
  } catch (e) {
    // Swallowed deliberately -- see AC #3 above.
  }
};

// Story 4.5: the admin Error Log's list/detail reads. Field names/casing mirror the backend's
// ErrorRecordSummaryDto/ErrorRecordDetailDto exactly (ASP.NET Core's default camelCase JSON
// policy). Unlike reportError() above, these let httpClient.ts's HttpClientError propagate --
// useErrorLog.ts needs to surface a real error state to the admin, not swallow it.
export interface ErrorRecordSummaryDto {
  id: string;
  category: string;
  priority: string;
  status: string;
  message: string;
  source: string;
  occurrenceCount: number;
  lastOccurredAt: string;
}

export interface ErrorRecordDetailDto extends ErrorRecordSummaryDto {
  stackTrace: string | null;
  requestPath: string | null;
  originContext: string | null;
  firstOccurredAt: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  correlationId: string | null;
  exceptionType: string | null;
}

export interface PagedResultDto<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// Mirrors the backend's ErrorListQuery -- every field optional/omittable except paging.
export interface ErrorListFilters {
  category?: string;
  priority?: string;
  status?: string;
  source?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  includeArchived?: boolean;
  // Story 4.7/AC #2: exact match only, unlike search above.
  correlationId?: string;
}

export const getErrorList = (
  filters: ErrorListFilters,
  page: number,
  pageSize: number
): Promise<PagedResultDto<ErrorRecordSummaryDto>> => {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.status) params.set('status', filters.status);
  if (filters.source) params.set('source', filters.source);
  if (filters.fromDate) params.set('fromDate', filters.fromDate);
  if (filters.toDate) params.set('toDate', filters.toDate);
  if (filters.search) params.set('search', filters.search);
  if (filters.includeArchived) params.set('includeArchived', 'true');
  if (filters.correlationId) params.set('correlationId', filters.correlationId);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));

  return request(`/api/v1/errors?${params.toString()}`, 'GET');
};

export const getErrorDetail = (id: string): Promise<ErrorRecordDetailDto> =>
  request(`/api/v1/errors/${encodeURIComponent(id)}`, 'GET');

// Story 4.6/AC #1, #2, #4: lifecycle actions -- thin POST wrappers, same pattern as
// getErrorList/getErrorDetail above. Each returns 204 No Content on success; a rejected
// promise (HttpClientError) is the failure signal, same as every other services/* call.
export const archiveError = (id: string): Promise<void> => request(`/api/v1/errors/${encodeURIComponent(id)}/archive`, 'POST');

export const resolveError = (id: string): Promise<void> => request(`/api/v1/errors/${encodeURIComponent(id)}/resolve`, 'POST');

export const increasePriority = (id: string): Promise<void> => request(`/api/v1/errors/${encodeURIComponent(id)}/increase-priority`, 'POST');

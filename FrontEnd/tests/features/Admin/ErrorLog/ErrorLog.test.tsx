import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorLog } from '@/src/features/Admin/ErrorLog/ErrorLog';
import * as errorsService from '@/src/services/errorsService';

vi.mock('@/src/services/errorsService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/errorsService')>('@/src/services/errorsService');
  return { ...actual, getErrorList: vi.fn(), getErrorDetail: vi.fn(), archiveError: vi.fn() };
});

const makeRow = (id: string, overrides: Partial<errorsService.ErrorRecordSummaryDto> = {}): errorsService.ErrorRecordSummaryDto => ({
  id,
  category: 'ValidationError',
  priority: 'P2',
  status: 'New',
  message: `boom ${id}`,
  source: 'Backend',
  occurrenceCount: 1,
  lastOccurredAt: '2026-08-14T00:00:00Z',
  ...overrides,
});

const makePagedResult = (items: errorsService.ErrorRecordSummaryDto[]) => ({ items, totalCount: items.length, page: 1, pageSize: 25 });

describe('ErrorLog', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows a loading state, then renders fetched rows', async () => {
    vi.mocked(errorsService.getErrorList).mockResolvedValue(makePagedResult([makeRow('err_1'), makeRow('err_2')]));

    render(<ErrorLog />);

    expect(screen.getByText(/loading errors/i)).toBeInTheDocument();

    expect(await screen.findByText('boom err_1')).toBeInTheDocument();
    expect(screen.getByText('boom err_2')).toBeInTheDocument();
  });

  it('shows an inline error instead of a table when the fetch fails', async () => {
    vi.mocked(errorsService.getErrorList).mockRejectedValue(new Error('Could not reach the server. Please try again.'));

    render(<ErrorLog />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server. Please try again.');
  });

  it('shows an empty state when no rows match', async () => {
    vi.mocked(errorsService.getErrorList).mockResolvedValue(makePagedResult([]));

    render(<ErrorLog />);

    expect(await screen.findByText(/no errors match the current filters/i)).toBeInTheDocument();
  });

  it('changing a filter triggers a new fetch with the updated filter applied', async () => {
    vi.mocked(errorsService.getErrorList).mockResolvedValue(makePagedResult([makeRow('err_1')]));
    const user = userEvent.setup();
    render(<ErrorLog />);
    await screen.findByText('boom err_1');

    await user.selectOptions(screen.getByLabelText('Priority'), 'P0');

    await waitFor(() =>
      expect(errorsService.getErrorList).toHaveBeenLastCalledWith(expect.objectContaining({ priority: 'P0' }), 1, expect.any(Number))
    );
  });

  it('clicking a row opens the detail panel for that row', async () => {
    vi.mocked(errorsService.getErrorList).mockResolvedValue(makePagedResult([makeRow('err_1')]));
    vi.mocked(errorsService.getErrorDetail).mockResolvedValue({
      ...makeRow('err_1'),
      stackTrace: 'at Foo.Bar()',
      requestPath: null,
      originContext: null,
      firstOccurredAt: '2026-08-14T00:00:00Z',
      relatedEntityType: null,
      relatedEntityId: null,
      correlationId: null,
      exceptionType: null,
    });
    const user = userEvent.setup();
    render(<ErrorLog />);
    const row = await screen.findByText('boom err_1');

    await user.click(row);

    expect(await screen.findByText('at Foo.Bar()')).toBeInTheDocument();
    expect(errorsService.getErrorDetail).toHaveBeenCalledWith('err_1');
  });

  it('closing the detail panel after a successful lifecycle action refetches the list behind it', async () => {
    vi.mocked(errorsService.getErrorList).mockResolvedValue(makePagedResult([makeRow('err_1', { status: 'New' })]));
    vi.mocked(errorsService.getErrorDetail).mockResolvedValue({
      ...makeRow('err_1'),
      stackTrace: null,
      requestPath: null,
      originContext: null,
      firstOccurredAt: '2026-08-14T00:00:00Z',
      relatedEntityType: null,
      relatedEntityId: null,
      correlationId: null,
      exceptionType: null,
    });
    vi.mocked(errorsService.archiveError).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ErrorLog />);
    await user.click(await screen.findByText('boom err_1'));
    await screen.findByRole('button', { name: 'Archive' });

    await user.click(screen.getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(errorsService.archiveError).toHaveBeenCalledWith('err_1'));
    expect(errorsService.getErrorList).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Close panel' }));

    await waitFor(() => expect(errorsService.getErrorList).toHaveBeenCalledTimes(2));
  });

  it('closing the detail panel without taking any action does not refetch the list', async () => {
    vi.mocked(errorsService.getErrorList).mockResolvedValue(makePagedResult([makeRow('err_1')]));
    vi.mocked(errorsService.getErrorDetail).mockResolvedValue({
      ...makeRow('err_1'),
      stackTrace: null,
      requestPath: null,
      originContext: null,
      firstOccurredAt: '2026-08-14T00:00:00Z',
      relatedEntityType: null,
      relatedEntityId: null,
      correlationId: null,
      exceptionType: null,
    });
    const user = userEvent.setup();
    render(<ErrorLog />);
    await user.click(await screen.findByText('boom err_1'));
    await screen.findByRole('button', { name: 'Archive' });
    expect(errorsService.getErrorList).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Close panel' }));

    expect(errorsService.getErrorList).toHaveBeenCalledTimes(1);
  });

  // Code-review patch (AC #1/#3): clicking a Correlation ID must show every record sharing that
  // trace, not just the subset that also happens to match whatever filter was already active
  // when the admin opened the detail panel.
  it('clicking a Correlation ID in the detail panel clears other active filters and shows Archived trace members', async () => {
    vi.mocked(errorsService.getErrorList).mockResolvedValue(makePagedResult([makeRow('err_1')]));
    vi.mocked(errorsService.getErrorDetail).mockResolvedValue({
      ...makeRow('err_1'),
      stackTrace: null,
      requestPath: null,
      originContext: null,
      firstOccurredAt: '2026-08-14T00:00:00Z',
      relatedEntityType: null,
      relatedEntityId: null,
      correlationId: 'corr_upload_1',
      exceptionType: null,
    });
    const user = userEvent.setup();
    render(<ErrorLog />);
    await screen.findByText('boom err_1');

    // An unrelated filter is active before the click.
    await user.selectOptions(screen.getByLabelText('Priority'), 'P0');
    await waitFor(() => expect(errorsService.getErrorList).toHaveBeenLastCalledWith(expect.objectContaining({ priority: 'P0' }), 1, expect.any(Number)));

    await user.click(await screen.findByText('boom err_1'));
    await user.click(await screen.findByRole('button', { name: 'corr_upload_1' }));

    await waitFor(() =>
      expect(errorsService.getErrorList).toHaveBeenLastCalledWith({ correlationId: 'corr_upload_1', includeArchived: true }, 1, expect.any(Number))
    );
  });
});

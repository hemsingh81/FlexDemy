import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorDetailPanel } from '@/src/features/Admin/ErrorLog/ErrorDetailPanel';
import * as errorsService from '@/src/services/errorsService';

vi.mock('@/src/services/errorsService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/errorsService')>('@/src/services/errorsService');
  return {
    ...actual,
    getErrorDetail: vi.fn(),
    archiveError: vi.fn(),
    resolveError: vi.fn(),
    increasePriority: vi.fn(),
  };
});

const makeDetail = (overrides: Partial<errorsService.ErrorRecordDetailDto> = {}): errorsService.ErrorRecordDetailDto => ({
  id: 'err_1',
  category: 'ValidationError',
  priority: 'P2',
  status: 'New',
  message: 'boom',
  source: 'Backend',
  occurrenceCount: 1,
  lastOccurredAt: '2026-08-14T00:00:00Z',
  stackTrace: 'at Foo.Bar()',
  requestPath: null,
  originContext: null,
  firstOccurredAt: '2026-08-14T00:00:00Z',
  relatedEntityType: null,
  relatedEntityId: null,
  correlationId: null,
  exceptionType: null,
  ...overrides,
});

describe('ErrorDetailPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('clicking Archive calls archiveError with the record id and re-fetches the detail', async () => {
    vi.mocked(errorsService.getErrorDetail).mockResolvedValueOnce(makeDetail()).mockResolvedValueOnce(makeDetail({ status: 'Archived' }));
    vi.mocked(errorsService.archiveError).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ErrorDetailPanel id="err_1" onClose={vi.fn()} onCorrelationIdClick={vi.fn()} />);
    await screen.findByText('boom');

    await user.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() => expect(errorsService.archiveError).toHaveBeenCalledWith('err_1'));
    await waitFor(() => expect(errorsService.getErrorDetail).toHaveBeenCalledTimes(2));
  });

  it('clicking Mark Resolved calls resolveError with the record id and re-fetches the detail', async () => {
    vi.mocked(errorsService.getErrorDetail).mockResolvedValueOnce(makeDetail()).mockResolvedValueOnce(makeDetail({ status: 'Resolved' }));
    vi.mocked(errorsService.resolveError).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ErrorDetailPanel id="err_1" onClose={vi.fn()} onCorrelationIdClick={vi.fn()} />);
    await screen.findByText('boom');

    await user.click(screen.getByRole('button', { name: 'Mark Resolved' }));

    await waitFor(() => expect(errorsService.resolveError).toHaveBeenCalledWith('err_1'));
    await waitFor(() => expect(errorsService.getErrorDetail).toHaveBeenCalledTimes(2));
  });

  it('clicking Increase Priority calls increasePriority with the record id and re-fetches the detail', async () => {
    vi.mocked(errorsService.getErrorDetail).mockResolvedValueOnce(makeDetail({ priority: 'P2' })).mockResolvedValueOnce(makeDetail({ priority: 'P1' }));
    vi.mocked(errorsService.increasePriority).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ErrorDetailPanel id="err_1" onClose={vi.fn()} onCorrelationIdClick={vi.fn()} />);
    await screen.findByText('boom');

    await user.click(screen.getByRole('button', { name: 'Increase Priority' }));

    await waitFor(() => expect(errorsService.increasePriority).toHaveBeenCalledWith('err_1'));
    await waitFor(() => expect(errorsService.getErrorDetail).toHaveBeenCalledTimes(2));
  });

  it('does not show a full-page loading spinner during the post-action re-fetch (targeted refresh, not a full reload)', async () => {
    let resolveRefetch: (() => void) | undefined;
    vi.mocked(errorsService.getErrorDetail)
      .mockResolvedValueOnce(makeDetail())
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefetch = () => resolve(makeDetail({ status: 'Archived' }));
          })
      );
    vi.mocked(errorsService.archiveError).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<ErrorDetailPanel id="err_1" onClose={vi.fn()} onCorrelationIdClick={vi.fn()} />);
    await screen.findByText('boom');

    await user.click(screen.getByRole('button', { name: 'Archive' }));

    // The re-fetch is in flight (resolveRefetch not yet called) -- the panel must still show the
    // populated detail, not tear down to the full "Loading..." state.
    await waitFor(() => expect(errorsService.getErrorDetail).toHaveBeenCalledTimes(2));
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();

    resolveRefetch?.();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled());
  });

  it('disables every lifecycle action button while any one action is in flight', async () => {
    let resolveArchive: (() => void) | undefined;
    vi.mocked(errorsService.getErrorDetail).mockResolvedValue(makeDetail());
    vi.mocked(errorsService.archiveError).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveArchive = () => resolve(undefined);
        })
    );
    const user = userEvent.setup();
    render(<ErrorDetailPanel id="err_1" onClose={vi.fn()} onCorrelationIdClick={vi.fn()} />);
    await screen.findByText('boom');

    await user.click(screen.getByRole('button', { name: 'Archive' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark Resolved' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Increase Priority' })).toBeDisabled();

    resolveArchive?.();
  });

  it('disables the Increase Priority button when the record is already at P0', async () => {
    vi.mocked(errorsService.getErrorDetail).mockResolvedValue(makeDetail({ priority: 'P0' }));
    render(<ErrorDetailPanel id="err_1" onClose={vi.fn()} onCorrelationIdClick={vi.fn()} />);
    await screen.findByText('boom');

    expect(screen.getByRole('button', { name: 'Increase Priority' })).toBeDisabled();
  });

  it('disables the Archive button when the record is already Archived', async () => {
    vi.mocked(errorsService.getErrorDetail).mockResolvedValue(makeDetail({ status: 'Archived' }));
    render(<ErrorDetailPanel id="err_1" onClose={vi.fn()} onCorrelationIdClick={vi.fn()} />);
    await screen.findByText('boom');

    expect(screen.getByRole('button', { name: 'Archive' })).toBeDisabled();
  });

  it('disables the Mark Resolved button when the record is already Resolved', async () => {
    vi.mocked(errorsService.getErrorDetail).mockResolvedValue(makeDetail({ status: 'Resolved' }));
    render(<ErrorDetailPanel id="err_1" onClose={vi.fn()} onCorrelationIdClick={vi.fn()} />);
    await screen.findByText('boom');

    expect(screen.getByRole('button', { name: 'Mark Resolved' })).toBeDisabled();
  });

  it('shows an inline error and leaves the detail intact when an action fails', async () => {
    vi.mocked(errorsService.getErrorDetail).mockResolvedValue(makeDetail());
    vi.mocked(errorsService.archiveError).mockRejectedValue(new Error('Something went wrong. Please try again.'));
    const user = userEvent.setup();
    render(<ErrorDetailPanel id="err_1" onClose={vi.fn()} onCorrelationIdClick={vi.fn()} />);
    await screen.findByText('boom');

    await user.click(screen.getByRole('button', { name: 'Archive' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.getByText('boom')).toBeInTheDocument();
  });

  // Story 4.7/AC #1, #3.
  it('clicking the Correlation ID calls onCorrelationIdClick with its value and closes the panel', async () => {
    vi.mocked(errorsService.getErrorDetail).mockResolvedValue(makeDetail({ correlationId: 'corr_abc123' }));
    const onClose = vi.fn();
    const onCorrelationIdClick = vi.fn();
    const user = userEvent.setup();
    render(<ErrorDetailPanel id="err_1" onClose={onClose} onCorrelationIdClick={onCorrelationIdClick} />);
    await screen.findByText('boom');

    await user.click(screen.getByRole('button', { name: 'corr_abc123' }));

    expect(onCorrelationIdClick).toHaveBeenCalledWith('corr_abc123');
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render a clickable Correlation ID when the record has none', async () => {
    vi.mocked(errorsService.getErrorDetail).mockResolvedValue(makeDetail({ correlationId: null }));
    render(<ErrorDetailPanel id="err_1" onClose={vi.fn()} onCorrelationIdClick={vi.fn()} />);
    await screen.findByText('boom');

    expect(screen.queryByText('Correlation ID')).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorLogFilters } from '@/src/features/Admin/ErrorLog/ErrorLogFilters';
import type { ErrorListFilters } from '@/src/services/errorsService';

describe('ErrorLogFilters', () => {
  it('the "From" date is sent as start-of-day', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ErrorLogFilters filters={{ includeArchived: false }} onChange={onChange} />);

    await user.type(screen.getByLabelText('From'), '2026-08-14');

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fromDate: '2026-08-14T00:00:00.000Z' }));
  });

  // Code-review patch: LastOccurredAt <= ToDate must include the entire selected day, not just
  // the single instant at its start.
  it('the "To" date is sent as end-of-day, not start-of-day', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ErrorLogFilters filters={{ includeArchived: false }} onChange={onChange} />);

    await user.type(screen.getByLabelText('To'), '2026-08-14');

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ toDate: '2026-08-14T23:59:59.999Z' }));
  });

  it('clearing the "To" date sends undefined', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ErrorLogFilters filters={{ includeArchived: false, toDate: '2026-08-14T23:59:59.999Z' }} onChange={onChange} />);

    await user.clear(screen.getByLabelText('To'));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ toDate: undefined }));
  });

  // Code-review patch: a filter change made while the search debounce timer is still pending
  // must not be silently reverted when that timer finally fires. Uses real timers (not fake --
  // userEvent + fake timers interact poorly with this component's own setTimeout) and waits out
  // the real 250ms debounce.
  it('a filter change made while the search debounce is pending is not reverted when the debounce fires', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const filters: ErrorListFilters = { includeArchived: false };
    const { rerender } = render(<ErrorLogFilters filters={filters} onChange={onChange} />);

    await user.type(screen.getByPlaceholderText(/message or exception type/i), 'timeout');

    // Simulate the parent applying an unrelated filter change (e.g. a Category select) while
    // the 250ms search debounce is still in flight -- ErrorLog.tsx would re-render this
    // component with the updated `filters` prop.
    const updatedFilters: ErrorListFilters = { ...filters, category: 'ValidationError' };
    rerender(<ErrorLogFilters filters={updatedFilters} onChange={onChange} />);

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'ValidationError', search: 'timeout' }));
  }, 10000);

  // Story 4.7/AC #2: a direct filter-panel field for Correlation ID -- the frontend just passes
  // the typed string through; exact-match semantics are a backend query concern (Task 1).
  it('typing into the Correlation ID field updates filter state', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ErrorLogFilters filters={{ includeArchived: false }} onChange={onChange} />);

    await user.type(screen.getByLabelText('Correlation ID'), 'corr_abc123');

    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ correlationId: 'corr_abc123' }));
  }, 10000);

  it('the Correlation ID field reflects a value set from elsewhere (e.g. clicking a Correlation ID in the detail panel)', () => {
    const onChange = vi.fn();
    render(<ErrorLogFilters filters={{ includeArchived: false, correlationId: 'corr_from_detail' }} onChange={onChange} />);

    expect(screen.getByLabelText('Correlation ID')).toHaveValue('corr_from_detail');
  });
});

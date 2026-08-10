import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/src/ui/Button';

describe('Button', () => {
  it('renders its label and calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Save Changes</Button>);

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to the secondary (navy) variant', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('bg-[#143358]');
  });

  it('applies the primary (orange) and danger (red) variant classes', () => {
    const { rerender } = render(<Button variant="primary">Add</Button>);
    expect(screen.getByRole('button', { name: 'Add' }).className).toContain('bg-[#BA5012]');

    rerender(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('bg-red-600');
  });

  it('disables itself, shows a spinner, and swaps in loadingText while isLoading', () => {
    render(
      <Button isLoading loadingText="Saving...">
        Save
      </Button>
    );
    const button = screen.getByRole('button', { name: 'Saving...' });
    expect(button).toBeDisabled();
    expect(button.querySelector('svg.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
  });

  it('keeps the original label while loading when no loadingText is given, still showing the spinner', () => {
    render(<Button isLoading>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button.querySelector('svg.animate-spin')).toBeInTheDocument();
  });

  it('hides the leading icon and trailing icon while loading, showing both when idle', () => {
    const { rerender } = render(
      <Button icon={<span data-testid="lead">L</span>} trailingIcon={<span data-testid="trail">T</span>}>
        Sign In
      </Button>
    );
    expect(screen.getByTestId('lead')).toBeInTheDocument();
    expect(screen.getByTestId('trail')).toBeInTheDocument();

    rerender(
      <Button isLoading icon={<span data-testid="lead">L</span>} trailingIcon={<span data-testid="trail">T</span>}>
        Sign In
      </Button>
    );
    expect(screen.queryByTestId('lead')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trail')).not.toBeInTheDocument();
  });

  it('does not fire onClick when disabled via the isLoading prop', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button isLoading onClick={onClick}>
        Save
      </Button>
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner, SpinnerSize } from '@/src/ui/Spinner';

describe('Spinner', () => {
  it('renders with the default md size and no accessibility role when unlabeled', () => {
    const { container } = render(<Spinner />);
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon?.getAttribute('class')).toContain('w-4');
    expect(icon?.getAttribute('class')).toContain('animate-spin');
    expect(icon).not.toHaveAttribute('role');
  });

  it('maps each size prop to its pixel classes', () => {
    const sizes: [SpinnerSize, string][] = [
      ['xs', 'w-3'],
      ['sm', 'w-3.5'],
      ['md', 'w-4'],
      ['lg', 'w-5'],
      ['xl', 'w-8'],
    ];
    sizes.forEach(([size, expectedClass]) => {
      const { container } = render(<Spinner size={size} />);
      expect(container.querySelector('svg')?.getAttribute('class')).toContain(expectedClass);
    });
  });

  it('exposes role="status" and the given label when used standalone (e.g. a full-page spinner)', () => {
    render(<Spinner size="xl" label="Checking your session..." />);
    expect(screen.getByRole('status', { name: 'Checking your session...' })).toBeInTheDocument();
  });

  it('forwards extra className for one-off spacing/color overrides', () => {
    const { container } = render(<Spinner className="mr-2 text-[#143358]" />);
    const icon = container.querySelector('svg');
    expect(icon?.getAttribute('class')).toContain('mr-2');
    expect(icon?.getAttribute('class')).toContain('text-[#143358]');
  });
});

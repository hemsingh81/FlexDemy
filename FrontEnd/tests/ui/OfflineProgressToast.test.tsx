import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineProgressToast } from '@/src/ui/OfflineProgressToast';

describe('OfflineProgressToast', () => {
  it('renders nothing when online and not overridden', () => {
    const { container } = render(<OfflineProgressToast />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the offline banner when isOfflineOverride is true', () => {
    render(<OfflineProgressToast isOfflineOverride />);
    expect(screen.getByText(/Offline Mode/)).toBeInTheDocument();
  });
});

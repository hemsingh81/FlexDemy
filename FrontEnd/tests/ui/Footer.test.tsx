import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/src/ui/Footer';

describe('Footer', () => {
  it('renders the app title, tagline, and a copyright line', () => {
    render(<Footer />);
    expect(screen.getAllByText('FlexDemy').length).toBeGreaterThan(0);
    expect(screen.getByText('My time. My academy.')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} FlexDemy`))).toBeInTheDocument();
  });
});

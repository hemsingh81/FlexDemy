import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MarkdownViewer } from '@/src/ui/MarkdownViewer';

// Rendering assertions live here; the parsing rules themselves are covered in tests/lib/markdown.test.ts.
describe('MarkdownViewer', () => {
  it('renders a heading as a real heading element at the source level', () => {
    render(<MarkdownViewer source="## Profile" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Profile' })).toBeInTheDocument();
  });

  it('renders a pipe table as a table with column headers and cells', () => {
    render(<MarkdownViewer source={'| Name | Role |\n| --- | --- |\n| Ada | Engineer |'} />);

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Role' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'Ada' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'Engineer' })).toBeInTheDocument();
  });

  it('renders bullets as list items rather than literal dashes', () => {
    render(<MarkdownViewer source={'- alpha\n- beta'} />);

    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['alpha', 'beta']);
    expect(screen.queryByText(/^- alpha/)).not.toBeInTheDocument();
  });

  it('renders a safe link as an anchor that cannot reach back through window.opener', () => {
    render(<MarkdownViewer source="[docs](https://example.com)" />);

    const link = screen.getByRole('link', { name: 'docs' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  // The security property that matters most here: document text is third-party input, so a
  // javascript: URL must never become a clickable anchor.
  it('does not create an anchor for a javascript: URL', () => {
    render(<MarkdownViewer source="[click](javascript:alert(1))" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('[click](javascript:alert(1))')).toBeInTheDocument();
  });

  // The parser emits React elements and never HTML, so embedded markup is inert by construction --
  // this pins that rather than trusting it stays true.
  it('renders embedded HTML as visible text, never as live markup', () => {
    const { container } = render(<MarkdownViewer source={'<img src=x onerror="alert(1)">'} />);

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText(/<img src=x onerror="alert\(1\)">/)).toBeInTheDocument();
  });

  it('keeps fenced code verbatim instead of interpreting the markup inside it', () => {
    render(<MarkdownViewer source={'```\nconst a = **not bold**;\n```'} />);
    expect(screen.getByText('const a = **not bold**;')).toBeInTheDocument();
  });

  it('renders nothing for empty content without throwing', () => {
    const { container } = render(<MarkdownViewer source="" />);
    expect(container.textContent).toBe('');
  });
});

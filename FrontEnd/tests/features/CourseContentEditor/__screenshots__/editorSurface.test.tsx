// REAL-BROWSER tests for the editor surface styling added for the "make it feel like Confluence"
// pass: the empty-line "/" placeholder and the table's visible cell borders.
//
// These cannot be jsdom tests for the same reason as slashMenuStacking.test.tsx: both assertions
// are about COMPUTED STYLE, and jsdom neither applies real stylesheets nor computes layout. A
// jsdom test could only assert that a class name string is present, which says nothing about
// whether a tutor can actually see a table gridline.
//
// Unlike the sibling file, this one imports the app's real stylesheet rather than reproducing
// rules inline -- the whole point here is to verify what src/index.css actually paints, so
// substituting my own CSS would test the test. Note the visual project's shared setup
// deliberately does NOT load this (see tests/support/visualTestSetup.ts, which scopes itself to
// katex.min.css so screenshot baselines stay narrow); importing it per-file is the exception, not
// a change to that policy.
import '@/src/index.css';

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';

const PLACEHOLDER_TEXT = "Type '/' to insert a block";

const Harness: React.FC<{ content: string }> = ({ content }) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ includeChildren: true, placeholder: PLACEHOLDER_TEXT }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content,
    autofocus: 'start',
  });
  return <EditorContent editor={editor} />;
};

const mountEditor = async (content: string) => {
  render(<Harness content={content} />);
  return waitFor(() => {
    const el = document.querySelector<HTMLElement>('.ProseMirror');
    if (!el) throw new Error('editor not mounted');
    return el;
  });
};

afterEach(() => cleanup());

describe('editor placeholder', () => {
  it('paints the "/" hint on an empty paragraph via a ::before decoration', async () => {
    const prose = await mountEditor('<p></p>');

    const empty = await waitFor(() => {
      const el = prose.querySelector<HTMLElement>('p.is-empty');
      if (!el) throw new Error('no empty paragraph decoration');
      return el;
    });

    // The text comes from the data-placeholder attribute rendered into ::before content, so it is
    // never real document text -- it can never leak into the serialized Markdown body.
    expect(empty.getAttribute('data-placeholder')).toBe(PLACEHOLDER_TEXT);

    const before = window.getComputedStyle(empty, '::before');
    // `attr(data-placeholder)` resolves to the literal string in a computed ::before content.
    expect(before.content).toContain(PLACEHOLDER_TEXT);
    // Visible: a rule that resolved to `content: none` or opacity 0 would be a silent no-op.
    expect(before.content).not.toBe('none');
    expect(Number(before.opacity)).toBeGreaterThan(0);
  });

  it('does not paint a placeholder on a paragraph that has text', async () => {
    const prose = await mountEditor('<p>Already written</p>');
    await waitFor(() => expect(prose.textContent).toContain('Already written'));
    expect(prose.querySelector('p.is-empty')).toBeNull();
  });
});

describe('table cell borders', () => {
  it('renders visible gridlines on every cell while editing', async () => {
    const prose = await mountEditor(
      '<table><tbody><tr><th>Head</th><th>Head 2</th></tr><tr><td>Body</td><td>Body 2</td></tr></tbody></table>'
    );

    const cell = await waitFor(() => {
      const el = prose.querySelector<HTMLElement>('td');
      if (!el) throw new Error('no table cell');
      return el;
    });

    const style = window.getComputedStyle(cell);
    // The bug this guards: a table used to render with no cell edges at all, so a tutor filling in
    // a grid could not see the grid. Asserting a real, non-zero, non-transparent border rather
    // than the presence of a class name.
    expect(parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
    expect(parseFloat(style.borderLeftWidth)).toBeGreaterThan(0);
    expect(style.borderTopStyle).not.toBe('none');
    expect(style.borderTopColor).not.toBe('rgba(0, 0, 0, 0)');
    // Padding, so text is not jammed against the gridline.
    expect(parseFloat(style.paddingTop)).toBeGreaterThan(0);
  });

  it('gives header cells a distinct fill from body cells', async () => {
    const prose = await mountEditor(
      '<table><tbody><tr><th>Head</th><th>Head 2</th></tr><tr><td>Body</td><td>Body 2</td></tr></tbody></table>'
    );

    const header = await waitFor(() => {
      const el = prose.querySelector<HTMLElement>('th');
      if (!el) throw new Error('no header cell');
      return el;
    });
    const body = prose.querySelector<HTMLElement>('td')!;

    expect(window.getComputedStyle(header).backgroundColor).not.toBe(window.getComputedStyle(body).backgroundColor);
  });
});

// The bug these guard: `prose prose-slate` on EditorContent never matched anything
// (@tailwindcss/typography is not installed) while Tailwind's Preflight reset lists to
// `list-style: none; padding: 0`. A bulleted list inserted from the slash menu was created
// correctly and rendered with no marker and no indent -- indistinguishable from a paragraph, which
// is why it was reported three times as "bulleted list still not working".
//
// Every existing test asserted the <ul> was in the DOM, which it always was. Only COMPUTED STYLE
// can tell the difference between a list and a list that looks like a paragraph, and only a real
// browser computes it.
describe('list markers', () => {
  it('renders disc markers and an indent on a bulleted list', async () => {
    const prose = await mountEditor('<ul><li><p>First</p></li><li><p>Second</p></li></ul>');

    const list = await waitFor(() => {
      const el = prose.querySelector<HTMLElement>('ul');
      if (!el) throw new Error('no list');
      return el;
    });

    const style = window.getComputedStyle(list);
    expect(style.listStyleType).toBe('disc');
    expect(parseFloat(style.paddingLeft)).toBeGreaterThan(0);
  });

  it('renders decimal markers on a numbered list', async () => {
    const prose = await mountEditor('<ol><li><p>First</p></li><li><p>Second</p></li></ol>');

    const list = await waitFor(() => {
      const el = prose.querySelector<HTMLElement>('ol');
      if (!el) throw new Error('no list');
      return el;
    });

    const style = window.getComputedStyle(list);
    expect(style.listStyleType).toBe('decimal');
    expect(parseFloat(style.paddingLeft)).toBeGreaterThan(0);
  });

  it('collapses the paragraph margin Tiptap wraps each list item in', async () => {
    const prose = await mountEditor('<ul><li><p>First</p></li></ul>');
    const inner = await waitFor(() => {
      const el = prose.querySelector<HTMLElement>('li > p');
      if (!el) throw new Error('no item paragraph');
      return el;
    });
    // Without this the list reads as a stack of separate blocks rather than a list.
    expect(parseFloat(window.getComputedStyle(inner).marginTop)).toBe(0);
  });
});

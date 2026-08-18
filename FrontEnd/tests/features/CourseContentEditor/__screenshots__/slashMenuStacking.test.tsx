// REAL-BROWSER regression test for the slash menu, run under Chromium via the `visual` Vitest
// project (vite.config.ts) rather than the jsdom `unit` project.
//
// WHY IT CANNOT BE A JSDOM TEST -- this is the whole point of the file:
// jsdom has no layout engine and no stacking contexts. Every existing slash-menu test asserts the
// menu is *in the DOM* (`getByRole('listbox')`), and all of them passed while the menu was
// completely unusable in a real browser: @tiptap/suggestion's managed `mount()` appends the popup
// to document.body with no z-index, so it painted underneath the Course Content Editor's own
// `position: fixed; z-index: 50` maximized takeover. Present in the DOM, invisible to a user.
// "Is it in the document" is simply the wrong question; "is it the element a user's click would
// actually hit" is the right one, and only a real browser can answer it.
//
// The harness deliberately uses INLINE STYLES rather than the app's Tailwind classes: the visual
// project's setup loads only katex.min.css (see tests/support/visualTestSetup.ts), so Tailwind
// utilities would silently no-op and the test would pass for the wrong reason. Inline styles also
// state the exact stacking situation being reproduced, right here, instead of hiding it behind
// class names that live in another file.
import React from 'react';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { SlashCommandExtension } from '@/src/lib/editor/SlashCommandExtension';
import type { SlashCommandItem } from '@/src/lib/editor/slashMenuTypes';

// Enough commands to overflow the menu's own max-h-80 scroll region several times over -- the
// real command list is now this long too (six panel variants alone), which is what surfaced the
// bug: arrowing past roughly the fifth option scrolled the highlight out of sight.
const MANY_COMMANDS: SlashCommandItem[] = Array.from({ length: 20 }, (_, index) => ({
  id: `cmd-${index}`,
  category: 'Basic',
  label: `Command ${index}`,
  description: `Description ${index}`,
  execute: ({ editor, range }) => {
    editor.chain().focus().deleteRange(range).run();
  },
}));

const COMMANDS: SlashCommandItem[] = [
  {
    id: 'paragraph',
    category: 'Basic',
    label: 'Paragraph',
    description: 'Start writing plain text',
    execute: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('paragraph').run();
    },
  },
  {
    id: 'warning',
    category: 'Media & data',
    label: 'Warning panel',
    description: 'A common mistake or caution',
    execute: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
    },
  },
];

const ManyCommandHarness: React.FC = () => {
  const editor = useEditor({
    extensions: [StarterKit, SlashCommandExtension.configure({ getItems: () => MANY_COMMANDS })],
    content: '<p></p>',
    autofocus: 'start',
  });
  return <div style={{ padding: '2rem' }}><EditorContent editor={editor} /></div>;
};

// Reproduces the real containment the Course Content Editor creates when maximized:
// `fixed inset-0 z-50` with an opaque background (CourseContentEditor.tsx). Anything the app
// mounts into document.body without its own higher z-index paints behind this.
const MaximizedEditorHarness: React.FC = () => {
  const editor = useEditor({
    extensions: [StarterKit, SlashCommandExtension.configure({ getItems: () => COMMANDS })],
    content: '<p></p>',
    autofocus: 'start',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#ffffff', padding: '2rem' }}>
      <EditorContent editor={editor} />
    </div>
  );
};

// The visual project loads only katex.min.css, so SlashMenuList's own Tailwind utilities
// (`max-h-80 overflow-y-auto`) never apply here. Without them the listbox grows to fit all 20
// options, nothing can overflow, and a scroll test would pass whether or not the component
// scrolls anything -- which is exactly what an earlier version of this file did. Reproducing the
// two utilities that matter, in real CSS, is what makes the assertion below mean something.
// It is not enough to reproduce only the height cap: without Tailwind the option <button>s are
// inline-block and lay themselves out on ONE long horizontal row inside a shrink-to-fit absolutely
// positioned box, so all 20 collapsed into 57px total and nothing overflowed. The block/full-width
// rules below are what make the list a vertical column, which is the layout being tested.
// 20rem = `max-h-80`, 18rem = `w-72`, and the padding mirrors the options' own `px-3 py-2`.
const LISTBOX_CONSTRAINT = `
  [role="listbox"] { max-height: 20rem; overflow-y: auto; width: 18rem; }
  [role="listbox"] [role="option"] { display: block; width: 100%; padding: 0.5rem 0.75rem; }
`;

let styleEl: HTMLStyleElement | null = null;
beforeEach(() => {
  styleEl = document.createElement('style');
  styleEl.textContent = LISTBOX_CONSTRAINT;
  document.head.appendChild(styleEl);
});

afterEach(() => {
  styleEl?.remove();
  styleEl = null;
  cleanup();
});

describe('slash menu in a real browser', () => {
  it('renders ABOVE the maximized editor takeover, not behind it', async () => {
    const user = userEvent.setup();
    render(<MaximizedEditorHarness />);

    const prose = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.ProseMirror');
      if (!el) throw new Error('editor not mounted');
      return el;
    });

    await user.click(prose);
    await user.keyboard('/');

    const menu = await waitFor(() => {
      const el = document.getElementById('slash-menu-listbox');
      if (!el) throw new Error('slash menu never mounted');
      return el;
    });

    const rect = menu.getBoundingClientRect();

    // 1. It has real size. A zero-size popup is "in the DOM" and still invisible.
    expect(rect.width).toBeGreaterThan(0);
    expect(rect.height).toBeGreaterThan(0);

    // 2. It is inside the viewport. This is what the Floating UI `strategy: 'fixed'` fix protects:
    //    absolute-strategy coordinates resolve against the document origin while Floating UI
    //    measures in viewport coordinates, so inside a position:fixed takeover the two frames
    //    disagree by the scroll offset and the menu lands somewhere off-screen.
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
    expect(rect.right).toBeLessThanOrEqual(window.innerWidth);

    // 3. THE ASSERTION THAT ACTUALLY CAUGHT THE BUG: the topmost element at the menu's own centre
    //    must be the menu (or something inside it). Before the z-index fix this returned the
    //    harness's opaque z-50 overlay -- the menu was painted behind it, so a user saw nothing and
    //    a click would have hit the overlay instead.
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    expect(hit).not.toBeNull();
    expect(menu.contains(hit)).toBe(true);
  });
});

describe('slash menu keyboard scrolling', () => {
  it('keeps the highlighted option inside the visible scroll region when arrowing past the fold', async () => {
    const user = userEvent.setup();
    render(<ManyCommandHarness />);

    const prose = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.ProseMirror');
      if (!el) throw new Error('editor not mounted');
      return el;
    });

    await user.click(prose);
    await user.keyboard('/');

    const menu = await waitFor(() => {
      const el = document.getElementById('slash-menu-listbox');
      if (!el) throw new Error('slash menu never mounted');
      return el;
    });

    // The element that actually scrolls is the listbox itself (max-h-80 overflow-y-auto), which is
    // the ReactRenderer wrapper's child rather than the wrapper the plugin positions.
    const listbox = menu.querySelector<HTMLElement>('[role="listbox"]') ?? menu;

    // Far enough down to be well past the initial visible rows.
    for (let i = 0; i < 12; i += 1) {
      await user.keyboard('{ArrowDown}');
    }

    const selected = await waitFor(() => {
      const el = listbox.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
      if (!el) throw new Error('no option is selected');
      return el;
    });

    // Sanity: we really did move the selection deep into the list, so a passing assertion below
    // cannot be an artefact of the highlight never having left the first screenful.
    expect(selected.textContent).toContain('Command 12');

    // Precondition: the list must genuinely be overflowing its scroll box, or the in-view
    // assertion below is trivially true and proves nothing -- an earlier version of this test
    // passed with the scrollIntoView effect deleted for exactly that reason.
    expect(listbox.scrollHeight).toBeGreaterThan(listbox.clientHeight);

    const listRect = listbox.getBoundingClientRect();
    const optionRect = selected.getBoundingClientRect();

    // The whole highlighted row is inside the scroll viewport -- this is what fails without the
    // scrollIntoView effect, where the option sits below the listbox's bottom edge.
    expect(optionRect.top).toBeGreaterThanOrEqual(listRect.top - 1);
    expect(optionRect.bottom).toBeLessThanOrEqual(listRect.bottom + 1);
  });
});

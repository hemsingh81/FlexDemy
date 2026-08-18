// Story 7.2, Task 7 (AC #6, #9): entries are derived by walking the live Tiptap document's own
// heading nodes (h1-h4) -- never a separately-fetched/separately-managed tree -- so the rail and
// native screen-reader heading-navigation always reach the same stops (UX-DR7).
//
// Activating an entry moves REAL DOM focus to the target heading (tabindex="-1" + .focus()), never
// a scroll-only jump (UX-DR7's explicit requirement) -- scrollIntoView alone would leave a
// keyboard/screen-reader user positioned back at the rail, not at the heading they activated.
//
// Story 7.4, Task 8: real ARIA tree semantics -- role="tree" on the container, role="treeitem"
// per entry with aria-level, and roving tabindex (only the active entry is tabIndex 0; every
// other entry is -1). Arrow Up/Down moves the roving position and real DOM focus together,
// matching standard ARIA treeview keyboard convention.
//
// Story 7.4, Task 4: confirmation glyphs sourced from CourseContentContext, never from the Tiptap
// node itself -- structure/order stay derived from the live document (walkHeadings below, keyed
// by position); confirmation display is a separate lookup by entityId, so the two can never drift.
import React, { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Check, Circle, Plus } from 'lucide-react';
import { useCourseContent } from '../../context/CourseContentContext';

interface TocEntry {
  level: number;
  text: string;
  pos: number;
  entityId: string | null;
}

interface TableOfContentsRailProps {
  editor: Editor | null;
  chapterId: string | null;
  onAddChapter: () => void;
  disabled?: boolean;
}

const walkHeadings = (editor: Editor, chapterId: string | null): TocEntry[] => {
  const entries: TocEntry[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const entityId = node.attrs.level === 1 ? chapterId : (node.attrs.entityId as string | undefined) ?? null;
      entries.push({ level: node.attrs.level, text: node.textContent || 'Untitled', pos, entityId });
    }
    return true;
  });
  return entries;
};

const LEVEL_INDENT: Record<number, string> = {
  1: 'pl-0 font-bold',
  2: 'pl-3',
  3: 'pl-6 text-muted-foreground',
  4: 'pl-9 text-muted-foreground',
};

export const TableOfContentsRail: React.FC<TableOfContentsRailProps> = ({ editor, chapterId, onAddChapter, disabled = false }) => {
  const { isConfirmed } = useCourseContent();
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!editor) {
      setEntries([]);
      return undefined;
    }

    const recompute = () => setEntries(walkHeadings(editor, chapterId));
    recompute();
    editor.on('transaction', recompute);
    editor.on('update', recompute);
    return () => {
      editor.off('transaction', recompute);
      editor.off('update', recompute);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, chapterId]);

  useEffect(() => {
    if (activeIndex >= entries.length) setActiveIndex(Math.max(0, entries.length - 1));
  }, [entries, activeIndex]);

  const activate = (entry: TocEntry) => {
    if (!editor) return;
    const dom = editor.view.nodeDOM(entry.pos) as HTMLElement | null;
    if (!dom) return;
    if (!dom.hasAttribute('tabindex')) dom.setAttribute('tabindex', '-1');
    dom.focus();
  };

  const moveRovingFocus = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= entries.length) return;
    setActiveIndex(nextIndex);
    itemRefs.current[nextIndex]?.focus();
  };

  const handleTreeKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveRovingFocus(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveRovingFocus(activeIndex - 1);
    }
  };

  return (
    <nav aria-label="Table of contents" className="w-56 shrink-0 border-r border-border pr-3 space-y-1">
      <ul role="tree" aria-label="Document outline" className="space-y-0.5" onKeyDown={handleTreeKeyDown}>
        {entries.map((entry, index) => {
          const confirmed = entry.entityId ? isConfirmed(entry.entityId) : undefined;
          return (
            <li key={`${entry.pos}-${index}`} role="none">
              <button
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="treeitem"
                aria-level={entry.level}
                aria-selected={index === activeIndex}
                tabIndex={index === activeIndex ? 0 : -1}
                onFocus={() => setActiveIndex(index)}
                onClick={() => {
                  setActiveIndex(index);
                  activate(entry);
                }}
                className={`w-full flex items-center gap-1.5 text-left truncate text-xs py-1 rounded hover:text-accent hover:bg-muted/60 ${LEVEL_INDENT[entry.level] ?? 'pl-9'}`}
                title={entry.text}
              >
                {confirmed !== undefined && (entry.level === 1 || entry.level === 2 || entry.level === 3) && (
                  <span
                    aria-hidden="true"
                    className={`shrink-0 inline-flex items-center justify-center w-3 h-3 rounded-full ${
                      confirmed ? 'bg-[#179765] text-white' : 'border border-muted-foreground text-transparent'
                    }`}
                  >
                    {confirmed ? <Check className="w-2 h-2" /> : <Circle className="w-2 h-2" />}
                  </span>
                )}
                <span className="truncate">{entry.text}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onAddChapter}
        disabled={disabled}
        className="w-full flex items-center gap-1.5 text-xs font-bold text-accent hover:underline pt-2 disabled:opacity-40 disabled:pointer-events-none"
      >
        <Plus className="w-3.5 h-3.5" />
        Add chapter
      </button>
    </nav>
  );
};

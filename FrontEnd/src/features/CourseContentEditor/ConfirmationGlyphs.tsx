// Story 7.4, Task 9 (AC #6, UX-DR8): a filled check-glyph (Confirmed) vs. an outlined circle-
// glyph (Unconfirmed) beside every Chapter/Topic/Sub-Topic heading -- a shape difference, never
// color-alone. Page markers (h4) already carry this via their own badge-pill (Story 7.3);
// this covers the three heading levels that didn't have one before.
//
// Reads confirmation from CourseContentContext, never from a Tiptap node attribute -- Structure
// (headings, order) stays sourced from the live document; confirmation display is sourced from
// Context, so the two can never drift against each other (Task 4's own resolved design tension).
// Rendered as a React sibling, coordsAtPos-positioned, same pattern as HeadingControls.tsx.
import React, { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Check, Circle } from 'lucide-react';
import { useCourseContent } from '../../context/CourseContentContext';

interface GlyphEntry {
  entityId: string;
  title: string;
  top: number;
}

interface ConfirmationGlyphsProps {
  editor: Editor | null;
  chapterId: string | null;
}

const collectGlyphHeadings = (editor: Editor, chapterId: string | null): { entityId: string; title: string; pos: number }[] => {
  const entries: { entityId: string; title: string; pos: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return true;
    if (node.attrs.level === 1 && chapterId) {
      entries.push({ entityId: chapterId, title: node.textContent, pos });
    } else if ((node.attrs.level === 2 || node.attrs.level === 3) && node.attrs.entityId) {
      entries.push({ entityId: node.attrs.entityId, title: node.textContent, pos });
    }
    return true;
  });
  return entries;
};

export const ConfirmationGlyphs: React.FC<ConfirmationGlyphsProps> = ({ editor, chapterId }) => {
  const { isConfirmed } = useCourseContent();
  const [entries, setEntries] = useState<GlyphEntry[]>([]);

  useEffect(() => {
    if (!editor) return undefined;

    const recompute = () => {
      const headings = collectGlyphHeadings(editor, chapterId);
      setEntries(
        headings.map((entry) => {
          try {
            return { ...entry, top: editor.view.coordsAtPos(entry.pos).top };
          } catch {
            return { ...entry, top: 0 };
          }
        })
      );
    };

    recompute();
    editor.on('transaction', recompute);
    editor.on('update', recompute);
    return () => {
      editor.off('transaction', recompute);
      editor.off('update', recompute);
    };
  }, [editor, chapterId]);

  if (!editor) return null;

  return (
    <>
      {entries.map((entry) => {
        const confirmed = isConfirmed(entry.entityId);
        if (confirmed === undefined) return null; // outline not loaded yet
        return (
          <span
            key={entry.entityId}
            style={{ position: 'fixed', top: entry.top, right: 0 }}
            aria-label={confirmed ? `${entry.title || 'Untitled'}: confirmed` : `${entry.title || 'Untitled'}: unconfirmed`}
            title={confirmed ? 'Confirmed' : 'Unconfirmed'}
            className={`z-10 inline-flex items-center justify-center w-4 h-4 rounded-full ${
              confirmed ? 'bg-[#179765] text-white' : 'border-2 border-muted-foreground text-transparent'
            }`}
          >
            {confirmed ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
          </span>
        );
      })}
    </>
  );
};

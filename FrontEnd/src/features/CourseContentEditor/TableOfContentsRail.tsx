// Story 7.2, Task 7 (AC #6, #9): entries are derived by walking the live Tiptap document's own
// heading nodes (h1-h6) -- never a separately-fetched/separately-managed tree -- so the rail and
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
//
// -- Structure-tree revision --
// This rail used to be a FLAT list whose only expression of hierarchy was left padding. It is now
// a real nested tree (Chapter > Topic > Sub-Topic > Page > in-page headings) with per-branch
// collapse/expand, because a chapter with a dozen topics made the flat list longer than the
// viewport and gave a tutor no way to fold away the parts they are not working on.
//
// The nesting is DERIVED, not stored: buildTree below re-parents the same flat walkHeadings output
// by heading level. Nothing about the document, the DTOs, or the persistence path changes -- this
// renders exactly the entries the flat version listed, which is what keeps UX-DR7's "the rail and
// heading-navigation reach the same stops" property true.
//
// Collapse state is keyed by a stable path key (entityId when persisted, else parent-path +
// position), NOT by array index -- the entries array is rebuilt on every Tiptap transaction, so an
// index-keyed collapse set would reshuffle its own state on every keystroke.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Check, ChevronDown, ChevronRight, Circle, ListTree, Plus } from 'lucide-react';
import { useCourseContent } from '../../context/CourseContentContext';

interface TocEntry {
  level: number;
  text: string;
  pos: number;
  entityId: string | null;
}

interface TocNode extends TocEntry {
  /** Stable across re-derivations -- see the header comment on why this cannot be an index. */
  key: string;
  children: TocNode[];
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

// The document's own heading levels ARE the structure (h1 Chapter / h2 Topic / h3 Sub-Topic /
// h4 Page -- DocumentCanvas.tsx's StructuralHeading levels). h5/h6 are ordinary in-page headings a
// tutor typed inside a Page body; they still appear as leaves so the rail keeps reaching every stop
// native heading-navigation reaches, they just carry no structural label.
const KIND_LABEL: Record<number, string> = {
  1: 'Chapter',
  2: 'Topic',
  3: 'Sub-Topic',
  4: 'Page',
};

const LEVEL_TEXT: Record<number, string> = {
  1: 'font-bold text-foreground',
  2: 'font-semibold text-foreground',
  3: 'text-foreground',
  4: 'text-muted-foreground',
};

// A stack-based re-parent of the flat, document-ordered heading list. A heading attaches to the
// nearest preceding heading of a strictly lower level; anything with no such ancestor (the first
// h1, or a document that opens on a deeper level than it later uses) becomes a root.
//
// Deliberately tolerant of level SKIPS (an h2 followed directly by an h4, which a tutor produces by
// writing a Page under a Topic with no Sub-Topic in between -- a legitimate, supported shape per
// FR-3). The skipped level simply has no node; the h4 nests directly under the h2.
export const buildTree = (entries: TocEntry[]): TocNode[] => {
  const roots: TocNode[] = [];
  const stack: TocNode[] = [];

  entries.forEach((entry, index) => {
    while (stack.length > 0 && stack[stack.length - 1].level >= entry.level) stack.pop();
    const parent = stack[stack.length - 1] ?? null;
    // entityId is the stable identity whenever the node is persisted. Before that (a heading the
    // tutor has typed but whose create-call has not resolved yet), fall back to a parent-scoped
    // positional key -- unstable if the tutor reorders siblings mid-creation, but that window is
    // one request long and the only cost is a collapsed branch re-expanding.
    const key = entry.entityId ?? `${parent?.key ?? 'root'}/${entry.level}:${index}`;
    const node: TocNode = { ...entry, key, children: [] };
    if (parent) parent.children.push(node);
    else roots.push(node);
    stack.push(node);
  });

  return roots;
};

interface VisibleRow {
  node: TocNode;
  depth: number;
  /** 1-based position among its own siblings, plus that sibling group's size -- ARIA treeview
   * requires both when the rows are rendered flat rather than in nested group elements. */
  posInSet: number;
  setSize: number;
  isLast: boolean;
}

// Flattens the tree into exactly the rows currently rendered, honouring collapse. The roving
// tabindex and every arrow key operate over THIS list, not over the full tree -- a collapsed
// branch's descendants must not be reachable by ArrowDown, per ARIA treeview convention.
export const flattenVisible = (nodes: TocNode[], collapsed: Set<string>, depth = 0, out: VisibleRow[] = []): VisibleRow[] => {
  nodes.forEach((node, index) => {
    out.push({ node, depth, posInSet: index + 1, setSize: nodes.length, isLast: index === nodes.length - 1 });
    if (node.children.length > 0 && !collapsed.has(node.key)) flattenVisible(node.children, collapsed, depth + 1, out);
  });
  return out;
};

const collectKeysWithChildren = (nodes: TocNode[], out: string[] = []): string[] => {
  nodes.forEach((node) => {
    if (node.children.length > 0) {
      out.push(node.key);
      collectKeysWithChildren(node.children, out);
    }
  });
  return out;
};

export const TableOfContentsRail: React.FC<TableOfContentsRailProps> = ({ editor, chapterId, onAddChapter, disabled = false }) => {
  const { isConfirmed } = useCourseContent();
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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

  const tree = useMemo(() => buildTree(entries), [entries]);
  const rows = useMemo(() => flattenVisible(tree, collapsed), [tree, collapsed]);
  const expandableKeys = useMemo(() => collectKeysWithChildren(tree), [tree]);
  const allCollapsed = expandableKeys.length > 0 && expandableKeys.every((key) => collapsed.has(key));

  useEffect(() => {
    if (activeIndex >= rows.length) setActiveIndex(Math.max(0, rows.length - 1));
  }, [rows, activeIndex]);

  const activate = (node: TocNode) => {
    if (!editor) return;
    const dom = editor.view.nodeDOM(node.pos) as HTMLElement | null;
    if (!dom) return;
    if (!dom.hasAttribute('tabindex')) dom.setAttribute('tabindex', '-1');
    dom.focus();
  };

  const moveRovingFocus = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= rows.length) return;
      setActiveIndex(nextIndex);
      itemRefs.current[nextIndex]?.focus();
    },
    [rows.length],
  );

  const setCollapsedFor = (key: string, shouldCollapse: boolean) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (shouldCollapse) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(expandableKeys));

  // Standard ARIA treeview keyboard model. ArrowRight/ArrowLeft are the two that make a tree a tree
  // rather than a list: Right expands (or descends into an already-expanded node), Left collapses
  // (or climbs to the parent of an already-collapsed/leaf node).
  const handleTreeKeyDown = (event: React.KeyboardEvent) => {
    const row = rows[activeIndex];
    if (!row) return;
    const hasChildren = row.node.children.length > 0;
    const isCollapsed = collapsed.has(row.node.key);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveRovingFocus(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveRovingFocus(activeIndex - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      if (hasChildren && isCollapsed) setCollapsedFor(row.node.key, false);
      else if (hasChildren) moveRovingFocus(activeIndex + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (hasChildren && !isCollapsed) {
        setCollapsedFor(row.node.key, true);
      } else {
        // Climb: the nearest preceding row one level shallower is this row's parent.
        for (let i = activeIndex - 1; i >= 0; i -= 1) {
          if (rows[i].depth < row.depth) {
            moveRovingFocus(i);
            break;
          }
        }
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveRovingFocus(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveRovingFocus(rows.length - 1);
    }
  };

  return (
    <nav aria-label="Table of contents" className="w-60 shrink-0 border-r border-border pr-3 space-y-1">
      <div className="flex items-center justify-between gap-2 pb-1">
        <span className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">On this page</span>
        {expandableKeys.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            // One toggle rather than two buttons -- the label states which way it will go, so its
            // accessible name is never ambiguous about the action it performs.
            aria-label={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-accent rounded px-1 py-0.5"
          >
            <ListTree className="w-3 h-3" />
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        )}
      </div>

      <ul role="tree" aria-label="Document outline" className="space-y-0.5" onKeyDown={handleTreeKeyDown}>
        {rows.map((row, index) => {
          const { node, depth, posInSet, setSize, isLast } = row;
          const hasChildren = node.children.length > 0;
          const isCollapsed = collapsed.has(node.key);
          const confirmed = node.entityId ? isConfirmed(node.entityId) : undefined;
          const kind = KIND_LABEL[node.level];

          return (
            <li key={node.key} role="none" className="relative">
              {/* Tree-graph connectors: one vertical rule per ancestor depth, plus an elbow into
                  this row. Rendered as absolutely-positioned spans rather than nested wrapper
                  elements so the list stays flat -- role="tree" > role="treeitem" with no
                  intervening generic elements is what lets a screen reader read it as one tree.
                  A last child's own rule stops at the elbow (h-1/2) instead of running full height,
                  which is what makes a branch visibly terminate. */}
              {Array.from({ length: depth }, (_, level) => (
                <span
                  key={`rule-${level}`}
                  aria-hidden="true"
                  className={`absolute top-0 w-px bg-border ${level === depth - 1 && isLast ? 'h-1/2' : 'h-full'}`}
                  style={{ left: `${level * 12 + 7}px` }}
                />
              ))}
              {depth > 0 && (
                <span aria-hidden="true" className="absolute top-1/2 h-px w-2 bg-border" style={{ left: `${(depth - 1) * 12 + 7}px` }} />
              )}

              <div className="flex items-center" style={{ paddingLeft: `${depth * 12}px` }}>
                {hasChildren ? (
                  <button
                    type="button"
                    // Deliberately outside the tab order and hidden from the a11y tree:
                    // ArrowLeft/ArrowRight on the treeitem are the keyboard path to
                    // collapse/expand, so a separately-tabbable twisty would only add a redundant
                    // stop per branch. aria-expanded on the treeitem itself already announces the
                    // state, so nothing is lost by hiding this control.
                    tabIndex={-1}
                    aria-hidden="true"
                    onClick={() => setCollapsedFor(node.key, !isCollapsed)}
                    className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-accent hover:bg-muted/60"
                  >
                    {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                ) : (
                  <span aria-hidden="true" className="shrink-0 w-4" />
                )}

                <button
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  role="treeitem"
                  aria-level={node.level}
                  aria-posinset={posInSet}
                  aria-setsize={setSize}
                  aria-selected={index === activeIndex}
                  // Only set on nodes that actually have children -- ARIA reads aria-expanded on a
                  // leaf as "this node can be expanded", which would make every Page announce a
                  // twisty it does not have.
                  aria-expanded={hasChildren ? !isCollapsed : undefined}
                  tabIndex={index === activeIndex ? 0 : -1}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => {
                    setActiveIndex(index);
                    activate(node);
                  }}
                  className={`flex-1 min-w-0 flex items-center gap-1.5 text-left text-xs py-1 px-1 rounded hover:text-accent hover:bg-muted/60 ${
                    LEVEL_TEXT[node.level] ?? 'text-muted-foreground'
                  } ${index === activeIndex ? 'bg-muted/60' : ''}`}
                  title={kind ? `${kind}: ${node.text}` : node.text}
                >
                  {confirmed !== undefined && node.level >= 1 && node.level <= 3 && (
                    <span
                      aria-hidden="true"
                      className={`shrink-0 inline-flex items-center justify-center w-3 h-3 rounded-full ${
                        confirmed ? 'bg-[#179765] text-white' : 'border border-muted-foreground text-transparent'
                      }`}
                    >
                      {confirmed ? <Check className="w-2 h-2" /> : <Circle className="w-2 h-2" />}
                    </span>
                  )}
                  {/* The structural kind is announced but not shown -- the visual hierarchy is
                      already carried by the connectors and text weight, and a "TOPIC" chip on every
                      row would out-shout the titles themselves at this width. */}
                  {kind && <span className="sr-only">{kind}: </span>}
                  <span className="truncate">{node.text}</span>
                </button>
              </div>
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

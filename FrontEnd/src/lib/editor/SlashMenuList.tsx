// Generic slash-menu list UI (AD-10 -- no domain knowledge, the command list is data passed in
// by the feature). Built against EXPERIENCE.md's Accessibility Floor for the "/" slash-command
// menu verbatim:
//  - Trigger: role="combobox", aria-expanded, aria-controls (owned by the caller -- see
//    SlashCommandExtension.tsx, which renders this component and manages the trigger attributes
//    on the editor's own DOM).
//  - Menu: role="listbox"; each command role="option"; category eyebrow labels are
//    role="group"/aria-label, skipped by Arrow-key traversal (never counted as an option).
//  - Highlighted option exposed via aria-activedescendant on the trigger -- never color-alone.
//  - Arrow Up/Down moves the highlighted option; Enter commits; Escape closes without inserting;
//    Tab is never repurposed as an in-menu navigation key.
//  - Zero-match state renders a literal "No matching blocks" text row inside the still-open
//    listbox -- never a collapsed/blank menu.
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { SlashCommandItem } from './slashMenuTypes';

export interface SlashMenuListProps {
  items: SlashCommandItem[];
  query: string;
  onSelect: (item: SlashCommandItem) => void;
  /** Called with the id of the currently-highlighted option, so the caller (which owns the
   * trigger's DOM node) can update aria-activedescendant on it -- this component doesn't render
   * the trigger, only the listbox. */
  onHighlightChange: (optionId: string | null) => void;
}

export interface SlashMenuListHandle {
  /** Returns true if the key was handled (caller should preventDefault and stop propagation). */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const OPTION_ID_PREFIX = 'slash-menu-option-';

export const optionElementId = (itemId: string): string => `${OPTION_ID_PREFIX}${itemId}`;

export const SlashMenuList = forwardRef<SlashMenuListHandle, SlashMenuListProps>(({ items, query, onSelect, onHighlightChange }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const categories = useMemo(() => {
    const seen: { category: string; items: SlashCommandItem[] }[] = [];
    for (const item of items) {
      const group = seen.find((g) => g.category === item.category);
      if (group) group.items.push(item);
      else seen.push({ category: item.category, items: [item] });
    }
    return seen;
  }, [items]);

  // THE ORDER KEYBOARD NAVIGATION MUST FOLLOW, and the bug this fixes:
  //
  // `items` arrives in the order the feature assembled it (BASIC_COMMANDS, then structure
  // commands, then page-body commands). The menu does NOT render in that order -- it groups by
  // category, so an item's visual row and its index in `items` are unrelated. Every selection path
  // here indexed into `items`, so from the first row ("Paragraph") a single ArrowDown highlighted
  // `items[1]` -- "Topic heading", which renders far down the list under the STRUCTURE group --
  // while the row visually below the cursor was "Sub-heading". The highlight appeared to jump at
  // random, and committing with Enter inserted a block the tutor had not chosen (which is why
  // "Bulleted list" and "Numbered list" seemed not to work at all: arrowing to them selected
  // something else entirely).
  //
  // Flattening the grouped structure back out gives one canonical order that rendering, arrow
  // traversal, Enter, aria-activedescendant and the scroll-into-view refs all share -- so what is
  // highlighted is always the row directly under the last ArrowDown, by construction.
  const orderedItems = useMemo(() => categories.flatMap((group) => group.items), [categories]);


  // Reset the highlighted option whenever the filtered item set changes (a new keystroke
  // narrowing/widening the query) -- an index carried over from a longer list could otherwise
  // point past the end of a shorter one, or silently highlight the wrong row.
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useEffect(() => {
    onHighlightChange(orderedItems.length > 0 ? optionElementId(orderedItems[selectedIndex]?.id ?? orderedItems[0].id) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, orderedItems]);

  // The listbox is a fixed-height scroll region (max-h-80), so arrowing past roughly the fifth
  // option moved the highlight out of sight -- the selection was still tracking correctly and
  // aria-activedescendant was still correct, but a sighted user watched the highlight vanish off
  // the bottom edge with no indication anything was selected.
  //
  // `block: 'nearest'` is what makes this unobtrusive: it scrolls only when the option is actually
  // outside the viewport, so ordinary arrowing within the visible rows does not jerk the list
  // around. Guarded on the menu having focus-equivalent state anyway -- this element is never the
  // scroll container of the page, so it cannot steal page scroll.
  useEffect(() => {
    optionRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex, orderedItems]);

  const selectByOffset = (offset: number) => {
    if (orderedItems.length === 0) return;
    setSelectedIndex((prev) => (prev + offset + orderedItems.length) % orderedItems.length);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent): boolean => {
      // IME composition owns Arrow/Enter while a candidate window is open -- never hijack it
      // (UX-DR4/AD-9's IME-safety requirement, extended to this menu's own keyboard model).
      if (event.isComposing) return false;

      if (event.key === 'ArrowDown') {
        selectByOffset(1);
        return true;
      }
      if (event.key === 'ArrowUp') {
        selectByOffset(-1);
        return true;
      }
      if (event.key === 'Enter') {
        if (orderedItems.length > 0) onSelect(orderedItems[selectedIndex]);
        return true;
      }
      // Escape and Tab are NOT handled here -- both close the menu without inserting, which is
      // the caller's job (SlashCommandExtension owns the ProseMirror range/focus manipulation
      // that closing requires). Returning false lets the caller's own handler run.
      return false;
    },
  }));

  return (
    <div
      role="listbox"
      aria-label="Insert block"
      className="w-72 max-h-80 overflow-y-auto rounded-lg border border-border bg-card shadow-xl animate-[fade-in-scale_150ms_ease-out]"
    >
      <div className="px-3 py-2 border-b border-border text-xs text-muted-foreground">
        <span aria-hidden="true">/</span>
        {query}
      </div>

      {items.length === 0 ? (
        <div className="px-3 py-3 text-sm text-muted-foreground">No matching blocks</div>
      ) : (
        categories.map((group) => (
          <div key={group.category}>
            <div role="group" aria-label={group.category} className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {group.category}
            </div>
            {group.items.map((item) => {
              const globalIndex = orderedItems.indexOf(item);
              const isHighlighted = globalIndex === selectedIndex;
              return (
                <button
                  key={item.id}
                  id={optionElementId(item.id)}
                  ref={(el) => {
                    optionRefs.current[globalIndex] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isHighlighted}
                  onMouseEnter={() => setSelectedIndex(globalIndex)}
                  onClick={() => onSelect(item)}
                  className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors ${
                    isHighlighted ? 'bg-muted' : 'hover:bg-muted/60'
                  }`}
                >
                  <span className="text-sm font-semibold text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.description}</span>
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
});

SlashMenuList.displayName = 'SlashMenuList';

// Generic "/" slash-command mechanism (AD-10) -- built on Tiptap's @tiptap/suggestion utility.
// Tiptap's own official slash-commands example is itself labeled "experimental"; this hardens it
// against EXPERIENCE.md's Accessibility Floor rather than dropping the example in as-is.
//
// Lives in lib/editor/ -- AD-10's explicit named exception to "lib/ is only ever called from
// services/" (this module has no data-access/persistence concern to route through a service).
// No domain knowledge: the command list is feature-owned config passed in via `addOptions`.
import { Extension } from '@tiptap/core';
import Suggestion, { exitSuggestion, type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import type { SlashMenuListHandle } from './SlashMenuList';
import { SlashMenuList } from './SlashMenuList';
import type { SlashCommandItem } from './slashMenuTypes';

export interface SlashCommandOptions {
  /** The full command list -- feature-owned, assembled by features/CourseContentEditor/.
   * A function (not a plain array) so later stories' position-aware filtering (Description-zone
   * schema constraint, AD-10) can look at the current editor state before deciding what's
   * offered -- this story's own command list never needs that yet, but the extension point is
   * built now so 7.2/7.3 don't have to retrofit it. */
  getItems: (context: { query: string; editor: import('@tiptap/core').Editor }) => SlashCommandItem[];
}

const ARIA_LIVE_REGION_ID = 'slash-menu-announcer';

// One step above this app's overlay tier (z-50: SidePanel, ConfirmModal, CourseReviewModal, and
// the Course Content Editor's own maximized takeover). The slash menu is always summoned FROM one
// of those surfaces, so it has to outrank them rather than merely match them.
const SLASH_MENU_Z_INDEX = '60';

// aria-live="polite" announcer for "what was inserted" (UX-DR6) -- a single, reused region
// rather than one created per mount, matching this codebase's existing batched-announcer
// convention (CourseContentEditor.tsx's own aria-live region for file-status updates).
const announce = (message: string) => {
  let region = document.getElementById(ARIA_LIVE_REGION_ID);
  if (!region) {
    region = document.createElement('div');
    region.id = ARIA_LIVE_REGION_ID;
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('role', 'status');
    region.className = 'sr-only';
    document.body.appendChild(region);
  }
  // Clearing first forces a re-announcement even if the same message fires twice in a row
  // (e.g. inserting the same block type consecutively) -- screen readers de-dupe identical,
  // unchanged live-region text.
  region.textContent = '';
  window.setTimeout(() => {
    region!.textContent = message;
  }, 20);
};

export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
  name: 'slashCommand',

  addOptions() {
    return {
      getItems: () => [],
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        allowSpaces: false,
        startOfLine: false,

        // BROWSER-ONLY BUG FIX (invisible to jsdom, which has no layout or stacking contexts, so
        // every existing slash-menu test passed while the menu was unusable in a real browser):
        //
        // `props.mount()` appends the popup to document.body and positions it with Floating UI,
        // whose default strategy is "absolute". Absolute coordinates resolve against the document
        // origin, but Floating UI computes them from getBoundingClientRect, i.e. VIEWPORT
        // coordinates. Inside the Course Content Editor's maximized `fixed inset-0` takeover --
        // and on any scrolled page -- those two frames disagree by the scroll offset, so the menu
        // is positioned somewhere off the visible area entirely. `fixed` makes the popup resolve
        // in the same viewport frame Floating UI measured in, which is the frame a fixed-position
        // editor already lives in.
        floatingUi: { strategy: 'fixed' },

        items: ({ query, editor }) => extensionThis.options.getItems({ query, editor }),

        command: ({ editor, range, props }) => {
          const item = props as SlashCommandItem;
          item.execute({ editor, range });
          announce(`${item.label} inserted`);
        },

        render: () => {
          let renderer: ReactRenderer<SlashMenuListHandle> | null = null;
          let unmount: (() => void) | null = null;
          let editorRoot: HTMLElement | null = null;
          let previousActiveDescendant: string | null = null;

          const setTriggerAria = (expanded: boolean) => {
            editorRoot = extensionThis.editor.view.dom as HTMLElement;
            if (expanded) {
              previousActiveDescendant = editorRoot.getAttribute('aria-activedescendant');
              editorRoot.setAttribute('role', 'combobox');
              editorRoot.setAttribute('aria-expanded', 'true');
              editorRoot.setAttribute('aria-controls', 'slash-menu-listbox');
            } else if (editorRoot) {
              editorRoot.removeAttribute('role');
              editorRoot.removeAttribute('aria-expanded');
              editorRoot.removeAttribute('aria-controls');
              if (previousActiveDescendant) editorRoot.setAttribute('aria-activedescendant', previousActiveDescendant);
              else editorRoot.removeAttribute('aria-activedescendant');
            }
          };

          const buildProps = (props: SuggestionProps) => ({
            items: props.items as SlashCommandItem[],
            query: props.query,
            onSelect: (item: SlashCommandItem) => props.command(item),
            onHighlightChange: (optionId: string | null) => {
              if (optionId) editorRoot?.setAttribute('aria-activedescendant', optionId);
            },
          });

          return {
            onStart: (props: SuggestionProps) => {
              renderer = new ReactRenderer(SlashMenuList, {
                props: buildProps(props),
                editor: props.editor,
              });
              renderer.element.id = 'slash-menu-listbox';
              // The second half of the same browser-only bug: the popup is a document.body child
              // with no z-index of its own, so it sits at z-auto in the root stacking context --
              // underneath the Course Content Editor's own `fixed inset-0 z-50` takeover (and the
              // Navbar's z-50). It mounted, it was in the DOM, tests found it by role, and a real
              // user saw nothing because it was painted behind an opaque white surface.
              //
              // Set imperatively rather than as a Tailwind class because this element is
              // ReactRenderer's own wrapper div, not markup SlashMenuList controls.
              renderer.element.style.zIndex = SLASH_MENU_Z_INDEX;

              // Managed mounting/positioning (Floating UI under the hood, already a transitive
              // dependency of @tiptap/suggestion -- no new package added) -- anchors the menu to
              // the cursor and repositions it on scroll/resize automatically.
              unmount = props.mount(renderer.element);

              setTriggerAria(true);
            },

            onUpdate: (props: SuggestionProps) => {
              renderer?.updateProps(buildProps(props));
            },

            onKeyDown: (props: SuggestionKeyDownProps): boolean => {
              // Escape: close without inserting, strip the typed "/"+query, and return focus to
              // the exact document position "/" was typed at.
              // Code-review fix: returning `true` only tells Tiptap/ProseMirror's own keymap
              // chain this key was handled -- it does NOT stop the native DOM KeyboardEvent from
              // continuing to bubble up to CourseContentEditor.tsx's own document-level Escape
              // listener, which closes the whole editor. Without stopPropagation(), dismissing
              // the menu with Escape also closed the entire Course Content Editor on the same
              // keypress, silently discarding any not-yet-synced Topic/Sub-Topic the tutor had
              // just typed.
              if (!props.event.isComposing && props.event.key === 'Escape') {
                props.event.stopPropagation();
                extensionThis.editor.chain().focus().deleteRange(props.range).run();
                return true;
              }

              // Tab is never repurposed as in-menu navigation. Unlike Escape, Tab does not strip
              // the typed "/"+query -- it only needs to close the menu. exitSuggestion closes it
              // programmatically (a metadata-only transaction, safe against mapping errors);
              // returning false (not "handled") afterward lets the browser's native Tab
              // focus-shift still proceed, which is what moves focus to the next element.
              if (props.event.key === 'Tab') {
                exitSuggestion(props.view);
                return false;
              }

              return renderer?.ref?.onKeyDown(props.event) ?? false;
            },

            onExit: () => {
              setTriggerAria(false);
              unmount?.();
              renderer?.destroy();
              unmount = null;
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});

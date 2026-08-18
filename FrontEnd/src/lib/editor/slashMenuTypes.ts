// AD-10: the slash-menu mechanism is generic and has no domain knowledge -- it accepts a
// command list as data. ContentAuthoring-specific commands (Topic heading, New Page, Image,
// Math, ...) are assembled by features/CourseContentEditor/ and passed in, added incrementally
// by later stories (7.2/7.3/8.1/9.x). This story seeds a single "Paragraph" command purely to
// prove the mechanism end-to-end.
import type { Editor, Range } from '@tiptap/core';

export interface SlashCommandItem {
  /** Stable id, used as the React key and for test/query targeting. */
  id: string;
  /** Category eyebrow label -- commands are grouped under it; the label itself is never a
   * selectable option (role="group", skipped by Arrow-key traversal). */
  category: string;
  label: string;
  description: string;
  /** Executed on commit -- `range` is the "/"+query text (or the zero-width position the "+"
   * affordance opened at) to be replaced by whatever the command inserts. */
  execute: (context: { editor: Editor; range: Range }) => void;
}

// Story 10.1, Task 1: domain-agnostic Markdown-structure splitting -- takes lib/markdown.ts's own
// `parseMarkdown` output and groups it into top-level sections, one heading plus everything until
// the next same-or-higher-level heading (or end of document). Lives in lib/editor/ (not
// features/CourseContentEditor/) since it has no course/page-specific knowledge, only
// Markdown-shape knowledge -- matches lib/markdown.ts's own precedent for where this kind of
// logic lives.
//
// HEURISTIC, VALIDATED (Story 10.1, Task 0/AC #3) against 6 real, distinct Docling-parsed source
// files from the dev database (AICOE1.pdf, Style_Guide.pdf, Hem_Singh.docx, Hem_Singh.pdf,
// kemh1a1.pdf, verify.pdf -- 83 headings total): real Docling output uses a SINGLE flat heading
// level uniformly (zero `#`/H1, zero `###`+/H3 observed anywhere in the sample -- every heading
// Docling emits is `##`/H2). No table or code block was ever split mid-way by a heading boundary
// (headings never appeared adjacent to a table row in the sample). Conclusion: "top-level
// heading" is computed dynamically as the MINIMUM heading level actually present in a given
// document, rather than hardcoded to a specific level -- this handles the real all-H2 corpus
// correctly without special-casing, and still does the right thing for a hand-authored file that
// happens to use H1. One minor, non-blocking observation noted here rather than silently
// dropped: a handful of real H2 lines are pure extraction artifacts (bare page-number fragments
// like "04", stray percentages like "25%") rather than meaningful section titles -- these produce
// syntactically-correct but oddly-labeled short sections, not a broken or mis-tokenized split; a
// possible "section title quality" polish for later, not a defect in this heuristic itself.
import type { MarkdownBlock } from '../markdown';
import { inlineText } from '../markdown';

export interface Section {
  title: string;
  blocks: MarkdownBlock[];
}

export const splitIntoSections = (blocks: MarkdownBlock[]): Section[] => {
  const headingLevels = blocks.filter((b) => b.type === 'heading').map((b) => (b as Extract<MarkdownBlock, { type: 'heading' }>).level);
  if (headingLevels.length === 0) return [];
  const topLevel = Math.min(...headingLevels);

  const sections: Section[] = [];
  let current: Section | null = null;

  for (const block of blocks) {
    if (block.type === 'heading' && block.level <= topLevel) {
      current = { title: inlineText(block.content) || 'Untitled section', blocks: [block] };
      sections.push(current);
      continue;
    }
    // Content before the first top-level heading has no section to belong to -- dropped rather
    // than fabricating a synthetic "preamble" section; a source file this parser splits is
    // expected to open with its own top-level heading (every real sample did).
    current?.blocks.push(block);
  }

  return sections;
};

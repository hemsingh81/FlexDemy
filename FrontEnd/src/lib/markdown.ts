// Minimal Markdown parser for the Course Content Editor's Viewer tab.
//
// WHY HAND-ROLLED, not `marked`/`react-markdown`: the only Markdown this renders is what Docling
// produces from an uploaded document, and it is deliberately turned into React elements rather
// than an HTML string. That removes the whole `dangerouslySetInnerHTML` + sanitiser story -- a
// parser that cannot emit raw HTML cannot inject a <script>, so there is no XSS surface to
// sanitise and no second dependency to keep patched. Raw HTML embedded in the source is therefore
// NOT rendered as markup; it falls through as literal text, which is the safe reading for
// third-party document text.
//
// SUPPORTED SUBSET, chosen from what Docling actually emits (measured across the 31 parsed files
// in the dev database: headings 31, bullet lists 30, ordered lists 29, tables 24, fenced code 8,
// inline code 8; zero bold/italic/link/image/blockquote/hr occurrences):
//   blocks -- ATX headings, paragraphs, fenced code, ordered/unordered lists (nested), tables,
//             blockquotes, thematic breaks
//   inline -- code spans, bold, italic, links, images (rendered as their alt text)
// Anything outside that subset degrades to plain text rather than throwing. If a document ever
// needs more (footnotes, task lists, reference links), extend this file and its tests -- don't
// reach for innerHTML.
//
// Story 9.2 grows this subset deliberately beyond Docling's own output -- Math/Callout/Resource
// card are tutor-authored constructs (via the Course Content Editor's slash menu), never
// extracted-document artifacts:
//   blocks -- Math (`$$…$$` fenced, block-level only, no inline `$…$`), Callout (a blockquote
//             whose first line starts with `[!note]`, degrading to a plain blockquote otherwise),
//             Resource card (a paragraph whose sole content is one `[label](resource:{id})` link
//             -- promoted from an ordinary inline link only when it's the paragraph's only content)
//   inline -- `resource:` is now a SAFE_LINK scheme too (needed for a Resource card's own link,
//             and reused by resourceImage's image-href check, Story 8.3)

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'em'; children: InlineNode[] }
  | { type: 'link'; href: string; children: InlineNode[] }
  // Story 8.3, FR-30: an image whose href is a `resource:{resourceId}` URI -- the one exception
  // to "images render as alt text only" below. Never carries a raw storage URL; resolving
  // resourceId to a real served URL happens at render time (MarkdownViewer.tsx), not here.
  | { type: 'resourceImage'; resourceId: string; alt: string };

export interface ListItem {
  content: InlineNode[];
  children: MarkdownBlock[];
}

export type MarkdownBlock =
  | { type: 'heading'; level: number; content: InlineNode[] }
  | { type: 'paragraph'; content: InlineNode[] }
  | { type: 'code'; lang: string | null; value: string }
  | { type: 'list'; ordered: boolean; items: ListItem[] }
  | { type: 'table'; header: InlineNode[][]; rows: InlineNode[][][] }
  | { type: 'blockquote'; children: MarkdownBlock[] }
  | { type: 'hr' }
  // Story 9.2, FR-28: block-level `$$…$$` math, rendered via KaTeX (lib/renderLatex.ts) at
  // render time. No inline `$…$` variant -- out of scope, per this story's own explicit decision.
  | { type: 'math'; value: string }
  // Story 9.2, FR-28: a blockquote whose first line starts with `[!note]` -- the marker is
  // stripped from that first line's content once recognized. Any blockquote without the marker
  // stays a plain `blockquote` (unchanged, pre-existing behavior) -- this IS the mechanism behind
  // AC #2's "degrading to a plain blockquote anywhere unsupported."
  | { type: 'callout'; children: MarkdownBlock[] }
  // Story 9.2, FR-28/FR-30/FR-31: promoted from an ordinary paragraph only when its entire
  // content is exactly one `[label](resource:{id})` link and nothing else -- a `resource:` link
  // sharing a paragraph with other text stays an ordinary inline link (see the promotion check
  // at the bottom of parseMarkdown below).
  | { type: 'resourceCard'; resourceId: string; label: string };

// Only these schemes become real links. A bare `[click](javascript:alert(1))` is the one genuine
// injection vector left once HTML is off the table -- React happily sets any string as href -- so
// anything else renders as plain text instead. Protocol-relative `//evil.com` is also rejected:
// it has no scheme to match here but the browser would resolve it as one.
// Story 9.2: `resource:` added -- needed for a Resource card's own link (and shared with
// resourceImage's own independent, narrower `/^resource:/` check, Story 8.3 -- that check stays
// separate on purpose, see that story's own "Gating gotcha" note: broadening SAFE_LINK must never
// make an ordinary `http://` image href start rendering, only `resource:` ones for images).
const SAFE_LINK = /^(https?:\/\/|mailto:|#|\/(?!\/)|resource:)/i;

const INLINE_SOURCE = [
  '(`+)([\\s\\S]*?)\\1', // 1-2: code span (longest-run fence, so `` a ` b `` works)
  '!\\[([^\\]]*)\\]\\(([^)\\s]*)[^)]*\\)', // 3-4: image -> alt text only
  '\\[([^\\]]+)\\]\\(([^)\\s]*)[^)]*\\)', // 5-6: link
  '\\*\\*([\\s\\S]+?)\\*\\*', // 7: bold
  '__([\\s\\S]+?)__', // 8: bold
  '\\*([^*\\s][\\s\\S]*?)\\*', // 9: italic (won't match the '* ' of a bullet)
  '_([^_\\s][\\s\\S]*?)_', // 10: italic
].join('|');

export const parseInline = (text: string): InlineNode[] => {
  // A FRESH regex per call, not one shared module-level instance. This function recurses (bold
  // and link contents are themselves inline markup), and a /g/ regex carries mutable lastIndex
  // state on the object itself -- a nested call would reset and re-advance the very same lastIndex
  // the outer loop is iterating on, which spins forever rather than merely misparsing.
  const pattern = new RegExp(INLINE_SOURCE, 'g');
  const nodes: InlineNode[] = [];
  let lastIndex = 0;

  const pushText = (value: string) => {
    if (!value) return;
    const previous = nodes[nodes.length - 1];
    // Merge with the preceding text node so a rejected link (emitted as text) doesn't leave the
    // caller with a needlessly fragmented list.
    if (previous?.type === 'text') previous.value += value;
    else nodes.push({ type: 'text', value });
  };

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    pushText(text.slice(lastIndex, match.index));
    lastIndex = pattern.lastIndex;

    const [, , codeValue, imageAlt, imageHref, linkText, linkHref, boldStar, boldUnderscore, italicStar, italicUnderscore] =
      match;

    if (codeValue !== undefined) nodes.push({ type: 'code', value: codeValue.trim() });
    else if (imageAlt !== undefined) {
      // Story 8.3, FR-30: a `resource:{id}` URI is the one image href this parser resolves at
      // all -- everything else still degrades to alt text only (no remote fetches from document
      // text, unchanged from before this story).
      const resourceMatch = /^resource:(.+)$/.exec(imageHref ?? '');
      if (resourceMatch) nodes.push({ type: 'resourceImage', resourceId: resourceMatch[1], alt: imageAlt });
      else pushText(imageAlt);
    } else if (linkText !== undefined) {
      if (SAFE_LINK.test(linkHref ?? '')) nodes.push({ type: 'link', href: linkHref, children: parseInline(linkText) });
      else pushText(match[0]); // unsafe scheme: keep the source text visible, drop the link
    } else if (boldStar !== undefined) nodes.push({ type: 'strong', children: parseInline(boldStar) });
    else if (boldUnderscore !== undefined) nodes.push({ type: 'strong', children: parseInline(boldUnderscore) });
    else if (italicStar !== undefined) nodes.push({ type: 'em', children: parseInline(italicStar) });
    else if (italicUnderscore !== undefined) nodes.push({ type: 'em', children: parseInline(italicUnderscore) });
  }

  pushText(text.slice(lastIndex));
  return nodes;
};

const HEADING = /^(#{1,6})\s+(.*)$/;
const FENCE = /^\s*(`{3,}|~{3,})\s*(\S+)?\s*$/;
const HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const BLOCKQUOTE = /^\s*>\s?(.*)$/;
const UNORDERED = /^(\s*)[-*+]\s+(.*)$/;
const ORDERED = /^(\s*)\d+[.)]\s+(.*)$/;
// Story 9.2: a line that is exactly `$$` (block math fence) -- mirrors FENCE's own "collect until
// the matching closing marker" shape.
const MATH_FENCE = /^\s*\$\$\s*$/;
const CALLOUT_MARKER = /^\[!note\]\s*/i;

// Flattens an inline tree back to plain text -- used for a Resource card's own `label` (its link
// text is always plain, since it's tutor-typed via the "Resource card" command's own UI, not
// free-form prose that could carry nested bold/italic/links). Exported (Story 10.1) for
// lib/editor/splitIntoSections.ts's own need to extract a heading's plain-text title for display.
export const inlineText = (nodes: InlineNode[]): string =>
  nodes
    .map((node) => {
      if (node.type === 'text' || node.type === 'code') return node.value;
      if (node.type === 'strong' || node.type === 'em' || node.type === 'link') return inlineText(node.children);
      return '';
    })
    .join('');
// A table separator is what actually distinguishes a table from a paragraph that merely contains
// pipes -- GitHub-flavoured Markdown requires it, and so does this parser.
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

const splitTableRow = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const indentWidth = (raw: string): number => raw.replace(/\t/g, '    ').length;

export const parseMarkdown = (source: string): MarkdownBlock[] => {
  // Normalise line endings up front: Docling output and pasted text both turn up with CRLF, and
  // every pattern here is anchored with `$`, which would otherwise match before a stray \r.
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  const isTableStart = (index: number): boolean =>
    index + 1 < lines.length && lines[index].includes('|') && TABLE_SEPARATOR.test(lines[index + 1]);

  const parseListAt = (startIndent: number): MarkdownBlock => {
    // The two markers are mutually exclusive ('- x' can't also match the ordered pattern), so the
    // ordered flag is just which pattern the opening line matched.
    const ordered = ORDERED.test(lines[i]);
    const items: ListItem[] = [];

    while (i < lines.length) {
      const line = lines[i];
      const match = UNORDERED.exec(line) ?? ORDERED.exec(line);
      if (!match) break;
      const indent = indentWidth(match[1]);
      if (indent < startIndent) break;
      if (indent > startIndent) {
        // Deeper bullet: belongs to the item just emitted, not to this list.
        const nested = parseListAt(indent);
        if (items.length > 0) items[items.length - 1].children.push(nested);
        else items.push({ content: [], children: [nested] });
        continue;
      }
      // Same level, but a different marker kind starts a NEW list rather than continuing this one.
      if (ORDERED.test(line) !== ordered) break;
      items.push({ content: parseInline(match[2]), children: [] });
      i += 1;
    }

    return { type: 'list', ordered, items };
  };

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Story 9.2: checked before FENCE -- a `$$` line never matches FENCE's own backtick/tilde
    // pattern, but this keeps math grouped with the other "collect until closing marker" blocks.
    if (MATH_FENCE.test(line)) {
      i += 1;
      const body: string[] = [];
      while (i < lines.length && !MATH_FENCE.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // consume the closing $$ (a no-op past EOF for an unterminated block)
      blocks.push({ type: 'math', value: body.join('\n').trim() });
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const lang = fence[2] ?? null;
      i += 1;
      const body: string[] = [];
      while (i < lines.length && !new RegExp(`^\\s*${marker}{3,}\\s*$`).test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // consume the closing fence (a no-op past EOF for an unterminated block)
      blocks.push({ type: 'code', lang, value: body.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, content: parseInline(heading[2].trim()) });
      i += 1;
      continue;
    }

    // Checked before the list patterns: `---` and `***` are also valid bullet markers, and a
    // thematic break is the more likely reading of a line that is nothing but those characters.
    if (HR.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    if (BLOCKQUOTE.test(line)) {
      const quoted: string[] = [];
      while (i < lines.length && BLOCKQUOTE.test(lines[i])) {
        quoted.push(BLOCKQUOTE.exec(lines[i])![1]);
        i += 1;
      }
      // Story 9.2: a `[!note]` marker on the first quoted line promotes this from a plain
      // blockquote to a callout -- the marker is stripped before re-parsing the quoted lines as
      // the callout's own children. No marker -- unchanged, pre-existing blockquote behavior.
      const calloutMatch = CALLOUT_MARKER.exec(quoted[0] ?? '');
      if (calloutMatch) {
        quoted[0] = quoted[0].slice(calloutMatch[0].length);
        blocks.push({ type: 'callout', children: parseMarkdown(quoted.join('\n')) });
      } else {
        blocks.push({ type: 'blockquote', children: parseMarkdown(quoted.join('\n')) });
      }
      continue;
    }

    if (isTableStart(i)) {
      const header = splitTableRow(line).map(parseInline);
      i += 2;
      const rows: InlineNode[][][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        rows.push(splitTableRow(lines[i]).map(parseInline));
        i += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    if (UNORDERED.test(line) || ORDERED.test(line)) {
      const match = (UNORDERED.exec(line) ?? ORDERED.exec(line))!;
      blocks.push(parseListAt(indentWidth(match[1])));
      continue;
    }

    // Paragraph: consecutive lines up to a blank line or the start of any other block.
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim()) {
      const next = lines[i];
      // A block can begin on the very next line with no blank line between (Docling emits tables
      // straight after a lead-in sentence), so every block opener has to end the paragraph here --
      // otherwise the table header and separator get swallowed as paragraph text.
      if (
        paragraph.length > 0 &&
        (HEADING.test(next) ||
          FENCE.test(next) ||
          MATH_FENCE.test(next) ||
          HR.test(next) ||
          BLOCKQUOTE.test(next) ||
          UNORDERED.test(next) ||
          ORDERED.test(next) ||
          isTableStart(i))
      ) {
        break;
      }
      paragraph.push(next.trim());
      i += 1;
    }
    const content = parseInline(paragraph.join(' '));
    // Story 9.2: promote to a Resource card only when the link is the paragraph's SOLE content --
    // a `resource:` link sharing a paragraph with other text stays an ordinary inline link. This
    // is the deliberate design decision that makes `[label](resource:{id})` a standalone download
    // card only when it looks exactly like what the "Resource card" command itself would emit.
    if (content.length === 1 && content[0].type === 'link' && /^resource:/i.test(content[0].href)) {
      blocks.push({ type: 'resourceCard', resourceId: content[0].href.slice('resource:'.length), label: inlineText(content[0].children) });
    } else {
      blocks.push({ type: 'paragraph', content });
    }
  }

  return blocks;
};

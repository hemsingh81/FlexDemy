import { describe, it, expect } from 'vitest';
import { parseMarkdown, parseInline, type MarkdownBlock } from '@/src/lib/markdown';

// The block shapes Docling actually produces (measured across the parsed files in the dev
// database: headings, bullet lists, ordered lists, tables, fenced code, inline code) get the most
// attention here; the rest of the supported subset is covered enough to catch a regression.

const types = (blocks: MarkdownBlock[]) => blocks.map((b) => b.type);

describe('parseMarkdown', () => {
  it('parses ATX headings with their level', () => {
    const [h2, h4] = parseMarkdown('## PROFILE\n\n#### Sub');
    expect(h2).toMatchObject({ type: 'heading', level: 2 });
    expect(h4).toMatchObject({ type: 'heading', level: 4 });
  });

  it('joins wrapped lines into one paragraph but starts a new block at a blank line', () => {
    const blocks = parseMarkdown('one line\nstill same para\n\nsecond para');
    expect(types(blocks)).toEqual(['paragraph', 'paragraph']);
    expect(blocks[0]).toMatchObject({ content: [{ type: 'text', value: 'one line still same para' }] });
  });

  it('parses a pipe table into header and rows', () => {
    const [table] = parseMarkdown('| Name | Role |\n| --- | --- |\n| Ada | Engineer |\n| Grace | Admiral |');
    expect(table.type).toBe('table');
    if (table.type !== 'table') return;
    expect(table.header).toHaveLength(2);
    expect(table.header[0]).toEqual([{ type: 'text', value: 'Name' }]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[1][1]).toEqual([{ type: 'text', value: 'Admiral' }]);
  });

  // Docling emits a table immediately after its lead-in sentence, with no blank line -- without an
  // explicit look-ahead the paragraph swallows the header and separator as text.
  it('ends a paragraph when a table starts on the very next line', () => {
    const blocks = parseMarkdown('Here are the results:\n| A | B |\n| --- | --- |\n| 1 | 2 |');
    expect(types(blocks)).toEqual(['paragraph', 'table']);
  });

  // Pipes alone don't make a table -- GFM requires the separator row, and so does this parser.
  it('treats a pipe-containing line with no separator row as a paragraph', () => {
    expect(types(parseMarkdown('a | b | c'))).toEqual(['paragraph']);
  });

  it('parses unordered and ordered lists, keeping them as separate blocks', () => {
    const blocks = parseMarkdown('- one\n- two\n\n1. first\n2. second');
    expect(types(blocks)).toEqual(['list', 'list']);
    expect(blocks[0]).toMatchObject({ ordered: false });
    expect(blocks[1]).toMatchObject({ ordered: true });
    if (blocks[1].type === 'list') expect(blocks[1].items).toHaveLength(2);
  });

  it('nests a deeper-indented list under the item above it', () => {
    const [list] = parseMarkdown('- parent\n  - child\n- sibling');
    expect(list.type).toBe('list');
    if (list.type !== 'list') return;
    expect(list.items).toHaveLength(2);
    expect(list.items[0].children).toHaveLength(1);
    expect(list.items[0].children[0]).toMatchObject({ type: 'list' });
    expect(list.items[1].children).toHaveLength(0);
  });

  it('keeps fenced code verbatim, including characters that are markup elsewhere', () => {
    const [code] = parseMarkdown('```ts\nconst a = 1; // **not bold**\n```');
    expect(code).toMatchObject({ type: 'code', lang: 'ts', value: 'const a = 1; // **not bold**' });
  });

  it('closes an unterminated fence at end of input instead of dropping the content', () => {
    const [code] = parseMarkdown('```\nstill code');
    expect(code).toMatchObject({ type: 'code', value: 'still code' });
  });

  it('reads a line of only dashes as a thematic break, not a bullet', () => {
    expect(types(parseMarkdown('above\n\n---\n\nbelow'))).toEqual(['paragraph', 'hr', 'paragraph']);
  });

  it('parses a blockquote by re-parsing its stripped content as blocks', () => {
    const [quote] = parseMarkdown('> ## Quoted heading\n> and a line');
    expect(quote.type).toBe('blockquote');
    if (quote.type !== 'blockquote') return;
    expect(types(quote.children)).toEqual(['heading', 'paragraph']);
  });

  it('normalises CRLF so patterns anchored at end-of-line still match', () => {
    expect(types(parseMarkdown('# Title\r\n\r\nbody'))).toEqual(['heading', 'paragraph']);
  });

  it('returns no blocks for empty or whitespace-only input', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('\n\n   \n')).toEqual([]);
  });
});

describe('parseInline', () => {
  it('parses bold, italic and code spans', () => {
    expect(parseInline('**b**')).toEqual([{ type: 'strong', children: [{ type: 'text', value: 'b' }] }]);
    expect(parseInline('*i*')).toEqual([{ type: 'em', children: [{ type: 'text', value: 'i' }] }]);
    expect(parseInline('`x`')).toEqual([{ type: 'code', value: 'x' }]);
  });

  it('does not treat markup inside a code span as markup', () => {
    expect(parseInline('`**literal**`')).toEqual([{ type: 'code', value: '**literal**' }]);
  });

  it('keeps a safe link as a link', () => {
    expect(parseInline('[docs](https://example.com)')).toEqual([
      { type: 'link', href: 'https://example.com', children: [{ type: 'text', value: 'docs' }] },
    ]);
  });

  // The one real injection vector left once HTML is off the table: React will set any string as
  // href, so an unsafe scheme has to degrade to visible text rather than become a live link.
  it.each(['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', '//evil.example.com'])(
    'refuses to linkify %s, rendering the source as text instead',
    (href) => {
      const nodes = parseInline(`[click](${href})`);
      expect(nodes.every((n) => n.type !== 'link')).toBe(true);
      expect(nodes).toEqual([{ type: 'text', value: `[click](${href})` }]);
    },
  );

  it('renders an image as its alt text rather than fetching anything', () => {
    expect(parseInline('![a diagram](https://example.com/x.png)')).toEqual([{ type: 'text', value: 'a diagram' }]);
  });

  // Story 8.3, FR-30: the one exception to "images render as alt text only" -- a `resource:{id}`
  // href becomes a resourceImage node instead, resolved to a real URL at render time
  // (MarkdownViewer.tsx), never a raw storage URL baked into the Markdown.
  it('parses a `resource:` image href into a resourceImage node carrying the resourceId and alt text', () => {
    expect(parseInline('![Diagram](resource:res_abc123)')).toEqual([
      { type: 'resourceImage', resourceId: 'res_abc123', alt: 'Diagram' },
    ]);
  });

  it('still renders a non-resource image as plain alt text alongside a resourceImage sibling', () => {
    const nodes = parseInline('![Remote](https://example.com/x.png) and ![Local](resource:res_1)');
    expect(nodes).toEqual([
      { type: 'text', value: 'Remote and ' },
      { type: 'resourceImage', resourceId: 'res_1', alt: 'Local' },
    ]);
  });

  it('leaves surrounding text intact around inline markup', () => {
    expect(parseInline('use **this** now')).toEqual([
      { type: 'text', value: 'use ' },
      { type: 'strong', children: [{ type: 'text', value: 'this' }] },
      { type: 'text', value: ' now' },
    ]);
  });

  it('does not mistake a bullet marker for italics', () => {
    const [list] = parseMarkdown('- item one\n- item two');
    if (list.type !== 'list') throw new Error('expected a list');
    expect(list.items[0].content).toEqual([{ type: 'text', value: 'item one' }]);
  });
});

// Story 9.2, Task 1/6.
describe('parseMarkdown -- Math, Callout, Resource card (Story 9.2)', () => {
  it('parses a block-level `$$…$$` fence into a math block', () => {
    const [block] = parseMarkdown('$$\nE = mc^2\n$$');
    expect(block).toEqual({ type: 'math', value: 'E = mc^2' });
  });

  it('parses a multi-line math block, trimming leading/trailing blank lines', () => {
    const [block] = parseMarkdown('$$\n\\frac{a}{b}\n= c\n$$');
    expect(block).toEqual({ type: 'math', value: '\\frac{a}{b}\n= c' });
  });

  it('ends a paragraph when a math fence starts on the very next line, with no blank line between', () => {
    const blocks = parseMarkdown('Some lead-in text.\n$$\nE = mc^2\n$$');
    expect(types(blocks)).toEqual(['paragraph', 'math']);
  });

  it('parses a `[!note]`-marked blockquote as a callout, stripping the marker from the first line', () => {
    const [block] = parseMarkdown('> [!note] Remember to check units.');
    expect(block.type).toBe('callout');
    if (block.type !== 'callout') return;
    expect(block.children).toEqual([{ type: 'paragraph', content: [{ type: 'text', value: 'Remember to check units.' }] }]);
  });

  it('degrades an un-marked blockquote to a plain blockquote, unchanged from before this story', () => {
    const [block] = parseMarkdown('> just a quote, no marker');
    expect(block.type).toBe('blockquote');
  });

  it('handles a multi-line callout, the marker stripped only from the first quoted line', () => {
    const [block] = parseMarkdown('> [!note] First line.\n> Second line.');
    expect(block.type).toBe('callout');
    if (block.type !== 'callout') return;
    const [paragraph] = block.children;
    expect(paragraph).toEqual({ type: 'paragraph', content: [{ type: 'text', value: 'First line. Second line.' }] });
  });

  it('promotes a paragraph whose SOLE content is one `[label](resource:{id})` link into a resourceCard', () => {
    const [block] = parseMarkdown('[Syllabus PDF](resource:res_abc123)');
    expect(block).toEqual({ type: 'resourceCard', resourceId: 'res_abc123', label: 'Syllabus PDF' });
  });

  it('does NOT promote a `resource:` link that shares its paragraph with other text -- stays an ordinary inline link', () => {
    const [block] = parseMarkdown('See the [Syllabus PDF](resource:res_abc123) for details.');
    expect(block.type).toBe('paragraph');
    if (block.type !== 'paragraph') return;
    expect(block.content).toEqual([
      { type: 'text', value: 'See the ' },
      { type: 'link', href: 'resource:res_abc123', children: [{ type: 'text', value: 'Syllabus PDF' }] },
      { type: 'text', value: ' for details.' },
    ]);
  });

  it('does not promote a paragraph with two links, even if both are resource: links', () => {
    const [block] = parseMarkdown('[A](resource:res_a) and [B](resource:res_b)');
    expect(block.type).toBe('paragraph');
  });

  // AD-12's own named boundary case: a Math block immediately followed by a Callout, and the
  // reverse -- both directions must parse as two distinct, correctly-typed blocks, not one
  // merged/mis-tokenized block.
  it('adjacency: a Math block immediately followed by a Callout, no blank line between, parses as two distinct blocks', () => {
    const blocks = parseMarkdown('$$\nE = mc^2\n$$\n> [!note] Energy-mass equivalence.');
    expect(types(blocks)).toEqual(['math', 'callout']);
    expect(blocks[0]).toEqual({ type: 'math', value: 'E = mc^2' });
  });

  it('adjacency: a Callout immediately followed by a Math block, no blank line between, parses as two distinct blocks', () => {
    const blocks = parseMarkdown('> [!note] Energy-mass equivalence.\n$$\nE = mc^2\n$$');
    expect(types(blocks)).toEqual(['callout', 'math']);
    expect(blocks[1]).toEqual({ type: 'math', value: 'E = mc^2' });
  });
});

describe('SAFE_LINK -- `resource:` scheme (Story 9.2)', () => {
  it('renders a `resource:` link as a real link node, not plain text', () => {
    expect(parseInline('[Syllabus](resource:res_1)')).toEqual([
      { type: 'link', href: 'resource:res_1', children: [{ type: 'text', value: 'Syllabus' }] },
    ]);
  });
});

describe('resource image display width', () => {
  it('parses a `?w=` query on a resource image into a width', () => {
    const [block] = parseMarkdown('![A diagram](resource:res-1?w=50)');
    expect(block).toEqual({
      type: 'paragraph',
      content: [{ type: 'resourceImage', resourceId: 'res-1', alt: 'A diagram', width: 50 }],
    });
  });

  it('omits width entirely for an image with no query -- every pre-resize image is unaffected', () => {
    const [block] = parseMarkdown('![A diagram](resource:res-1)');
    expect(block).toEqual({
      type: 'paragraph',
      content: [{ type: 'resourceImage', resourceId: 'res-1', alt: 'A diagram' }],
    });
  });

  it('keeps the resource id clean of the query string', () => {
    const [block] = parseMarkdown('![x](resource:abc-123?w=25)');
    const image = (block as { content: { resourceId: string }[] }).content[0];
    expect(image.resourceId).toBe('abc-123');
  });

  it.each(['0', '101', '999', 'abc'])('degrades an out-of-range or malformed width (%s) to no width', (bad) => {
    const [block] = parseMarkdown(`![x](resource:res-1?w=${bad})`);
    const nodes = (block as { content: { type: string; width?: number }[] }).content;
    // Either it parsed as an image with no width, or the whole href failed the resource pattern
    // and degraded to alt text -- both are acceptable degradations; what must never happen is a
    // width outside 1-100 reaching the renderer as a style.
    const image = nodes.find((n) => n.type === 'resourceImage');
    expect(image?.width).toBeUndefined();
  });
});

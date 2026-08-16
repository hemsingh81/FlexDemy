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

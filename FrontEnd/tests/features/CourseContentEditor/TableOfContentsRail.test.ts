// Unit tests for the outline rail's two pure derivations -- buildTree (flat heading list ->
// nested structure) and flattenVisible (nested structure + collapse set -> the rows actually
// rendered). Tested at this layer rather than through a full editor render because these two
// functions are where every collapse/expand and keyboard-navigation behaviour actually lives:
// the component's arrow-key handler indexes into flattenVisible's output, so a bug here is a bug
// in navigation, and the DOM-level assertions already live in CourseContentEditor.test.tsx.
import { describe, it, expect } from 'vitest';
import { buildTree, flattenVisible } from '@/src/features/CourseContentEditor/TableOfContentsRail';

const entry = (level: number, text: string, entityId: string | null = null, pos = 0) => ({ level, text, pos, entityId });

describe('buildTree', () => {
  it('nests Topic under Chapter, Sub-Topic under Topic, and Page under Sub-Topic', () => {
    const tree = buildTree([
      entry(1, 'Chemical Reactions', 'chapter-1'),
      entry(2, 'Types of Reactions', 'topic-1'),
      entry(3, 'Combination Reactions', 'subtopic-1'),
      entry(4, 'What is a combination reaction?', 'page-1'),
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].text).toBe('Chemical Reactions');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].text).toBe('Types of Reactions');
    expect(tree[0].children[0].children[0].text).toBe('Combination Reactions');
    expect(tree[0].children[0].children[0].children[0].text).toBe('What is a combination reaction?');
  });

  it('keeps sibling Topics as siblings rather than nesting each one inside the last', () => {
    const tree = buildTree([
      entry(1, 'Chapter', 'chapter-1'),
      entry(2, 'Chemical Equations', 'topic-1'),
      entry(2, 'Types of Reactions', 'topic-2'),
      entry(2, 'Corrosion and Rancidity', 'topic-3'),
    ]);

    expect(tree[0].children.map((child) => child.text)).toEqual(['Chemical Equations', 'Types of Reactions', 'Corrosion and Rancidity']);
    expect(tree[0].children.every((child) => child.children.length === 0)).toBe(true);
  });

  it('attaches a Page directly to its Topic when the Sub-Topic level is skipped', () => {
    // FR-3: a Topic with pages and no sub-topics is a valid, supported shape -- the h2 -> h4 jump
    // it produces must not orphan the Page or invent a phantom Sub-Topic level.
    const tree = buildTree([entry(1, 'Chapter', 'chapter-1'), entry(2, 'Chemical Equations', 'topic-1'), entry(4, 'Balancing', 'page-1')]);

    expect(tree[0].children[0].children).toHaveLength(1);
    expect(tree[0].children[0].children[0].text).toBe('Balancing');
    expect(tree[0].children[0].children[0].level).toBe(4);
  });

  it('keys persisted nodes by entityId so a collapse survives the rebuild on every keystroke', () => {
    const first = buildTree([entry(1, 'Chapter', 'chapter-1'), entry(2, 'Topic', 'topic-1')]);
    // Same structure, different text (the tutor typed a character) and different positions.
    const second = buildTree([entry(1, 'Chapter!', 'chapter-1', 12), entry(2, 'Topic!', 'topic-1', 40)]);

    expect(second[0].key).toBe(first[0].key);
    expect(second[0].children[0].key).toBe(first[0].children[0].key);
  });

  it('gives a not-yet-persisted heading a parent-scoped key rather than colliding on null', () => {
    // Two sibling headings typed before either create-call resolves both have entityId null; if
    // they shared a key, collapsing one would collapse the other.
    const tree = buildTree([entry(1, 'Chapter', 'chapter-1'), entry(2, 'New Topic', null), entry(2, 'New Topic', null)]);

    const [a, b] = tree[0].children;
    expect(a.key).not.toBe(b.key);
  });

  it('treats a document with no h1 as a set of roots rather than dropping the entries', () => {
    const tree = buildTree([entry(2, 'Orphan Topic', 'topic-1'), entry(2, 'Another', 'topic-2')]);
    expect(tree.map((node) => node.text)).toEqual(['Orphan Topic', 'Another']);
  });
});

describe('flattenVisible', () => {
  const tree = buildTree([
    entry(1, 'Chapter', 'chapter-1'),
    entry(2, 'Topic A', 'topic-1'),
    entry(3, 'Sub A1', 'subtopic-1'),
    entry(2, 'Topic B', 'topic-2'),
  ]);

  it('returns every row, in document order, when nothing is collapsed', () => {
    expect(flattenVisible(tree, new Set()).map((row) => row.node.text)).toEqual(['Chapter', 'Topic A', 'Sub A1', 'Topic B']);
  });

  it('hides a collapsed branch\'s descendants but keeps the branch itself and its siblings', () => {
    const rows = flattenVisible(tree, new Set(['topic-1']));
    expect(rows.map((row) => row.node.text)).toEqual(['Chapter', 'Topic A', 'Topic B']);
  });

  it('hides an entire subtree when the root is collapsed', () => {
    expect(flattenVisible(tree, new Set(['chapter-1'])).map((row) => row.node.text)).toEqual(['Chapter']);
  });

  it('reports depth, sibling position and set size for ARIA', () => {
    const rows = flattenVisible(tree, new Set());
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 2, 1]);
    // Topic A and Topic B are siblings 1 and 2 of a 2-item group; Sub A1 is alone in its own group.
    expect(rows[1]).toMatchObject({ posInSet: 1, setSize: 2, isLast: false });
    expect(rows[3]).toMatchObject({ posInSet: 2, setSize: 2, isLast: true });
    expect(rows[2]).toMatchObject({ posInSet: 1, setSize: 1, isLast: true });
  });
});

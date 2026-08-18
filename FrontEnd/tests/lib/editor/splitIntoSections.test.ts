// Story 10.1, Task 4: unit tests using REAL sample strings pulled from Task 0's own validation
// pass against the dev database's real Docling output (see this story's Completion Notes), not
// synthetic strings invented independently of that validation.
//
// Sample provenance:
// - `KEMH_SAMPLE` -- first ~20 lines of the real `kemh1a1.pdf` ParsedContent (course_files table,
//   dev Postgres). Chosen because it real-world exercises three consecutive ## headings, one of
//   which ("## INFINITE SERIES") has NO body content before the next heading -- a genuine edge
//   case, not a contrived one.
// - `VERIFY_SAMPLE` -- the complete real `verify.pdf` ParsedContent (179 chars, the smallest real
//   sample in the dev database) -- a single-heading, single-body-paragraph file.
import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '@/src/lib/markdown';
import { splitIntoSections } from '@/src/lib/editor/splitIntoSections';

const KEMH_SAMPLE = `<!-- image -->

## INFINITE SERIES

## A.1.1  Introduction

As discussed in the Chapter 9 on Sequences and Series, a sequence a 1 , a 2 , ..., a n , ... having infinite number of terms is called infinite sequence and its indicated sum, i.e., a 1 + a 2 + a 3 + ... + a n + ... is called an infinte series associated with infinite sequence. This series can also be expressed in abbreviated form using the sigma notation, i.e.,

In this Chapter, we shall study about some special types of series which may be required in different problem situations.

## A.1.2  Binomial Theorem for any Index

In Chapter 8, we discussed the Binomial Theorem in which the index was a positive integer. In this Section, we state a more general form of the theorem in which the index is not necessarily a whole number.`;

const VERIFY_SAMPLE = `## Chapter 1: Introduction to Photosynthesis

Photosynthesis is the process by which plants convert light energy into chemical energy.

Topic 1.1: Chlorophyll and Light Absorption`;

describe('splitIntoSections', () => {
  it('returns no sections for content with no headings', () => {
    const blocks = parseMarkdown('Just a paragraph, no heading at all.');
    expect(splitIntoSections(blocks)).toEqual([]);
  });

  it('drops content before the first top-level heading (real Docling preamble, e.g. an image comment)', () => {
    const blocks = parseMarkdown(KEMH_SAMPLE);
    const sections = splitIntoSections(blocks);
    // The leading `<!-- image -->` line degrades to a paragraph ahead of the first heading --
    // it belongs to no section and must not leak into the first one.
    const firstSectionText = JSON.stringify(sections[0].blocks);
    expect(firstSectionText).not.toContain('image');
  });

  it('real sample: a heading immediately followed by another heading produces its own section with no body blocks', () => {
    const blocks = parseMarkdown(KEMH_SAMPLE);
    const sections = splitIntoSections(blocks);

    expect(sections.map((s) => s.title)).toEqual([
      'INFINITE SERIES',
      'A.1.1  Introduction',
      'A.1.2  Binomial Theorem for any Index',
    ]);
    // "INFINITE SERIES" has no body content before the next heading -- section is heading-only.
    expect(sections[0].blocks).toEqual([{ type: 'heading', level: 2, content: expect.any(Array) }]);
    expect(sections[1].blocks.length).toBeGreaterThan(1);
  });

  it('real sample: every heading is uniformly level 2 (H2), so the dynamic minimum-level rule treats every one as top-level', () => {
    const blocks = parseMarkdown(KEMH_SAMPLE);
    const headingLevels = blocks.filter((b) => b.type === 'heading').map((b) => (b as { level: number }).level);
    expect(new Set(headingLevels)).toEqual(new Set([2]));

    const sections = splitIntoSections(blocks);
    expect(sections).toHaveLength(3);
  });

  it('real sample (verify.pdf): a single-heading file produces exactly one section containing all its content', () => {
    const blocks = parseMarkdown(VERIFY_SAMPLE);
    const sections = splitIntoSections(blocks);

    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Chapter 1: Introduction to Photosynthesis');
    // heading + 2 paragraphs
    expect(sections[0].blocks).toHaveLength(3);
  });

  it('a document using H1 (not real Docling output, but a hand-authored file) still splits correctly via the dynamic minimum-level rule', () => {
    const blocks = parseMarkdown('# Title\n\nIntro text.\n\n## Sub-heading\n\nSub text.\n\n# Second Title\n\nMore text.');
    const sections = splitIntoSections(blocks);

    // Minimum level present is 1, so only the two H1s are top-level; the H2 nests inside the first.
    expect(sections.map((s) => s.title)).toEqual(['Title', 'Second Title']);
    expect(sections[0].blocks.some((b) => b.type === 'heading' && (b as { level: number }).level === 2)).toBe(true);
  });
});

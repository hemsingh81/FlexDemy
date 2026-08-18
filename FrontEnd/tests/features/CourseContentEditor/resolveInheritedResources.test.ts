// Story 8.2, Task 4: pure-function unit test, no DOM -- resolveInheritedResources.ts is a plain
// utility function (AD-5's "services/hooks get pure-logic unit tests" convention applied here).
import { describe, it, expect } from 'vitest';
import { resolveInheritedResources } from '@/src/features/CourseContentEditor/resolveInheritedResources';
import type { ChapterDocumentDto, ResourceDto } from '@/src/services/courseContentService';

const makeResource = (id: string, label: string): ResourceDto => ({
  id,
  label,
  caption: null,
  role: 'Attachment',
  order: 0,
  status: 'Done',
  failureReason: null,
  fileName: `${label}.pdf`,
  contentType: 'application/pdf',
  sizeBytes: 100,
});

// A 3-level fixture (Chapter -> Topic -> Subtopic -> Page), plus a Page attached directly to the
// Chapter and one attached directly to the Topic, each level carrying its own resource.
const document: ChapterDocumentDto = {
  id: 'chapter_1',
  courseId: 'course_1',
  title: 'Chemical Reactions',
  description: '',
  isConfirmed: false,
  resources: [makeResource('r_chapter', 'Chapter Resource')],
  pages: [{ id: 'page_chapter', title: 'Chapter Page', bodyMarkdown: '', isConfirmed: false, order: 0, resources: [] }],
  topics: [
    {
      id: 'topic_1',
      title: 'Combustion',
      description: '',
      order: 0,
      isConfirmed: false,
      resources: [makeResource('r_topic', 'Topic Resource')],
      pages: [{ id: 'page_topic', title: 'Topic Page', bodyMarkdown: '', isConfirmed: false, order: 0, resources: [] }],
      subtopics: [
        {
          id: 'subtopic_1',
          title: 'Fire triangle',
          description: '',
          order: 0,
          isConfirmed: false,
          resources: [makeResource('r_subtopic', 'Subtopic Resource')],
          pages: [{ id: 'page_subtopic', title: 'Subtopic Page', bodyMarkdown: '', isConfirmed: false, order: 0, resources: [] }],
        },
      ],
    },
    {
      id: 'topic_2',
      title: 'Oxidation',
      description: '',
      order: 1,
      isConfirmed: false,
      resources: [],
      pages: [],
      subtopics: [],
    },
  ],
};

describe('resolveInheritedResources (Story 8.2, Task 3/4)', () => {
  it('a Page owned by a Subtopic inherits from its Subtopic, Topic, and Chapter, nearest ancestor first', () => {
    const inherited = resolveInheritedResources(document, 'Page', 'page_subtopic');

    expect(inherited.map((r) => r.label)).toEqual(['Subtopic Resource', 'Topic Resource', 'Chapter Resource']);
    expect(inherited.map((r) => r.ancestorOwnerType)).toEqual(['Subtopic', 'Topic', 'Chapter']);
    expect(inherited[0]).toMatchObject({ ancestorOwnerId: 'subtopic_1', ancestorTitle: 'Fire triangle' });
    expect(inherited[1]).toMatchObject({ ancestorOwnerId: 'topic_1', ancestorTitle: 'Combustion' });
    expect(inherited[2]).toMatchObject({ ancestorOwnerId: 'chapter_1', ancestorTitle: 'Chemical Reactions' });
  });

  it('a Page owned by a Topic inherits from its Topic and Chapter, skipping the Subtopic level entirely', () => {
    const inherited = resolveInheritedResources(document, 'Page', 'page_topic');

    expect(inherited.map((r) => r.label)).toEqual(['Topic Resource', 'Chapter Resource']);
  });

  it('a Page owned directly by the Chapter inherits only from the Chapter', () => {
    const inherited = resolveInheritedResources(document, 'Page', 'page_chapter');

    expect(inherited.map((r) => r.label)).toEqual(['Chapter Resource']);
  });

  it("a Sub-Topic's own block inherits from its parent Topic and Chapter (not just Pages)", () => {
    const inherited = resolveInheritedResources(document, 'Subtopic', 'subtopic_1');

    expect(inherited.map((r) => r.label)).toEqual(['Topic Resource', 'Chapter Resource']);
  });

  it("a Topic's own block inherits only from the Chapter", () => {
    const inherited = resolveInheritedResources(document, 'Topic', 'topic_1');

    expect(inherited.map((r) => r.label)).toEqual(['Chapter Resource']);
  });

  it('the Chapter itself never inherits anything -- there is nothing above it', () => {
    expect(resolveInheritedResources(document, 'Chapter', 'chapter_1')).toEqual([]);
  });

  it('a Chapter-level resource is never inherited sideways into a sibling Topic that has no page of its own', () => {
    // topic_2 has no resources and no pages -- confirms nothing leaks in from topic_1's own
    // resource or subtopic_1's, only ever the shared Chapter ancestor.
    const inherited = resolveInheritedResources(document, 'Topic', 'topic_2');

    expect(inherited.map((r) => r.label)).toEqual(['Chapter Resource']);
  });

  it("a Page's own resource never appears in its parent Topic's inherited list -- downward only (AC #3)", () => {
    const topicInherited = resolveInheritedResources(document, 'Topic', 'topic_1');

    expect(topicInherited.map((r) => r.label)).not.toContain('Topic Page Resource');
    expect(topicInherited.every((r) => r.ancestorOwnerType === 'Chapter')).toBe(true);
  });

  it('returns an empty list for an ownerId not present anywhere in the tree', () => {
    expect(resolveInheritedResources(document, 'Page', 'no_such_page')).toEqual([]);
  });
});

// Generic Chapter -> Topic -> Sub-Topic -> Page tree walker, shared by every "walk the whole
// outline" consumer. CourseContentContext.tsx's confirmation map and PreviewAsStudent.tsx's
// flatten-to-renderable-sections both independently reimplemented this same recursive shape
// before being unified here (code-quality audit finding). Works over any DTO family sharing this
// structural shape by generic type parameters, not tied to one concrete DTO -- covers both the
// body-free `OutlineDto` (Story 7.4, courseContentService.ts) and the full-body
// `ChapterDocumentDto`/`TopicDocumentDto`/`SubtopicDocumentDto` (Stories 7.1-7.3), since both
// only need the fields declared below to be walked.
//
// `startDepth` composes: walking a Chapter passes `startDepth + 1` into its own Topics, a Topic
// passes `startDepth + 1` into its own Sub-Topics, etc. -- this is what lets a caller walk a
// single Topic/Sub-Topic standalone (e.g. PreviewAsStudent.tsx's node-scope preview) and still
// get the exact same relative depth numbering a whole-Chapter walk would have produced for that
// same subtree.
export type OutlineNodeKind = 'Chapter' | 'Topic' | 'Subtopic' | 'Page';

interface PageLike {
  id: string;
}
interface SubtopicLike<TPage extends PageLike> {
  id: string;
  pages: TPage[];
}
interface TopicLike<TSubtopic extends SubtopicLike<TPage>, TPage extends PageLike> {
  id: string;
  pages: TPage[];
  subtopics: TSubtopic[];
}
interface ChapterLike<TTopic extends TopicLike<TSubtopic, TPage>, TSubtopic extends SubtopicLike<TPage>, TPage extends PageLike> {
  id: string;
  pages: TPage[];
  topics: TTopic[];
}

export interface VisitedOutlineNode<TChapter, TTopic, TSubtopic, TPage> {
  kind: OutlineNodeKind;
  depth: number;
  node: TChapter | TTopic | TSubtopic | TPage;
}

export function* walkSubtopic<TSubtopic extends SubtopicLike<TPage>, TPage extends PageLike>(
  subtopic: TSubtopic,
  startDepth = 0
): Generator<VisitedOutlineNode<never, never, TSubtopic, TPage>> {
  yield { kind: 'Subtopic', depth: startDepth, node: subtopic };
  for (const page of subtopic.pages) yield { kind: 'Page', depth: startDepth + 1, node: page };
}

export function* walkTopic<TTopic extends TopicLike<TSubtopic, TPage>, TSubtopic extends SubtopicLike<TPage>, TPage extends PageLike>(
  topic: TTopic,
  startDepth = 0
): Generator<VisitedOutlineNode<never, TTopic, TSubtopic, TPage>> {
  yield { kind: 'Topic', depth: startDepth, node: topic };
  for (const page of topic.pages) yield { kind: 'Page', depth: startDepth + 1, node: page };
  for (const subtopic of topic.subtopics) yield* walkSubtopic(subtopic, startDepth + 1);
}

export function* walkChapter<
  TChapter extends ChapterLike<TTopic, TSubtopic, TPage>,
  TTopic extends TopicLike<TSubtopic, TPage>,
  TSubtopic extends SubtopicLike<TPage>,
  TPage extends PageLike,
>(chapter: TChapter, startDepth = 0): Generator<VisitedOutlineNode<TChapter, TTopic, TSubtopic, TPage>> {
  yield { kind: 'Chapter', depth: startDepth, node: chapter };
  for (const page of chapter.pages) yield { kind: 'Page', depth: startDepth + 1, node: page };
  for (const topic of chapter.topics) yield* walkTopic<TTopic, TSubtopic, TPage>(topic, startDepth + 1);
}

export function* walkOutline<
  TChapter extends ChapterLike<TTopic, TSubtopic, TPage>,
  TTopic extends TopicLike<TSubtopic, TPage>,
  TSubtopic extends SubtopicLike<TPage>,
  TPage extends PageLike,
>(chapters: readonly TChapter[]): Generator<VisitedOutlineNode<TChapter, TTopic, TSubtopic, TPage>> {
  for (const chapter of chapters) yield* walkChapter<TChapter, TTopic, TSubtopic, TPage>(chapter, 0);
}

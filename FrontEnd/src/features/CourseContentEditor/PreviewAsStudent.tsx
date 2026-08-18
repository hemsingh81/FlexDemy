// Story 11.2 (AC #1, #2, FR-46): renders through the exact same renderer the real Course Player
// will read through (lib/markdown.ts / ui/MarkdownViewer.tsx, AD-4/AD-9's "reading never goes
// through Tiptap" resolution) -- never a second, drifting renderer. Deliberately NOT a reuse of
// CoursePlayer/ReaderCanvas.tsx: that component is still the pre-ContentAuthoring, mock-data
// sentence/drilldown reading pane (confirmed by reading it directly during this story) -- it
// hasn't been rewired to read real Page.BodyMarkdown yet (Story 11.4's job, sequenced after this
// one). This is its own lightweight preview shell around the shared renderer instead.
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { MarkdownViewer } from '../../ui/MarkdownViewer';
import {
  getPage,
  getChapterDocument,
  getChapters,
  resolveResourceUrl,
  type PageDocumentDto,
  type ChapterDocumentDto,
  type TopicDocumentDto,
  type SubtopicDocumentDto,
} from '../../services/courseContentService';
import { walkChapter, walkTopic, walkSubtopic, type VisitedOutlineNode } from '../../lib/outlineTraversal';

export type PreviewScope =
  | { kind: 'page'; pageId: string }
  // A "node" is the Chapter itself, or a Topic/Sub-Topic within it -- chapterId is always the
  // owning Chapter, needed to fetch its full document regardless of which level within it the
  // tutor actually asked to preview.
  | { kind: 'node'; chapterId: string; nodeType: 'Chapter' | 'Topic' | 'Subtopic'; nodeId: string }
  | { kind: 'course' };

interface PreviewAsStudentProps {
  courseId: string;
  scope: PreviewScope;
  onClose: () => void;
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; pages: FlatSection[] };

type FlatSection = { title: string; level: number; body: string };

// Maps one visited node (from the shared outlineTraversal.ts walker) to its renderable section --
// a Page's body is its bodyMarkdown; every other kind's "body" is its own Description. Depth from
// the walker becomes `level` directly -- verified to reproduce this function's own pre-extraction
// level numbering exactly for every call pattern below (chapter-rooted, topic-rooted, and
// subtopic-rooted walks all compose via the walker's own `startDepth` parameter).
const sectionFromVisited = (
  visited: VisitedOutlineNode<ChapterDocumentDto, TopicDocumentDto, SubtopicDocumentDto, PageDocumentDto>
): FlatSection => {
  if (visited.kind === 'Page') {
    const page = visited.node as PageDocumentDto;
    return { title: page.title, level: visited.depth, body: page.bodyMarkdown };
  }
  const node = visited.node as { title: string; description: string };
  return { title: node.title, level: visited.depth, body: node.description };
};

// Flattens a Chapter/Topic/Sub-Topic's own subtree into an ordered list of renderable sections --
// its own Description (if non-empty) counts as a "page" here too, same document-order rule AC #1's
// "every Page/child-node beneath it in document order" describes.
const flattenSubtopic = (subtopic: SubtopicDocumentDto, level: number): FlatSection[] =>
  [...walkSubtopic<SubtopicDocumentDto, PageDocumentDto>(subtopic, level)].map(sectionFromVisited);

const flattenTopic = (topic: TopicDocumentDto, level: number): FlatSection[] =>
  [...walkTopic<TopicDocumentDto, SubtopicDocumentDto, PageDocumentDto>(topic, level)].map(sectionFromVisited);

const flattenChapter = (chapter: ChapterDocumentDto): FlatSection[] =>
  [...walkChapter<ChapterDocumentDto, TopicDocumentDto, SubtopicDocumentDto, PageDocumentDto>(chapter, 1)].map(sectionFromVisited);

// Node scope: locate the target Topic/Sub-Topic within the fetched Chapter and flatten only its
// own subtree, not the whole Chapter's -- "renders only the subtree rooted at the selected node."
const findAndFlattenNode = (chapter: ChapterDocumentDto, nodeType: 'Chapter' | 'Topic' | 'Subtopic', nodeId: string): FlatSection[] => {
  if (nodeType === 'Chapter') return flattenChapter(chapter);
  for (const topic of chapter.topics) {
    if (nodeType === 'Topic' && topic.id === nodeId) return flattenTopic(topic, 1);
    if (nodeType === 'Subtopic') {
      const subtopic = topic.subtopics.find((s) => s.id === nodeId);
      if (subtopic) return flattenSubtopic(subtopic, 1);
    }
  }
  return [];
};

const pageToSection = (page: PageDocumentDto): FlatSection => ({
  title: page.title,
  level: 1,
  body: page.bodyMarkdown,
});

// Story 11.2 (AC #1): a full-viewport overlay, same fixed inset-0 z-50 takeover idiom
// CourseContentEditor's own Maximized state / SidePanel / CourseReviewModal / FlashcardsModal
// already use -- not a new stacking pattern.
export const PreviewAsStudent: React.FC<PreviewAsStudentProps> = ({ courseId, scope, onClose }) => {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    const load = async () => {
      if (scope.kind === 'page') {
        const page = await getPage(courseId, scope.pageId);
        return [pageToSection(page)];
      }
      if (scope.kind === 'node') {
        const chapter = await getChapterDocument(courseId, scope.chapterId);
        return findAndFlattenNode(chapter, scope.nodeType, scope.nodeId);
      }
      // Course scope: one getChapterDocument call per Chapter, in sequence -- matches the
      // architecture spine's explicit whole-course-walk shape (no all-chapters-at-once endpoint
      // exists, and this story doesn't add one).
      const chapters = await getChapters(courseId);
      const sections: FlatSection[] = [];
      for (const chapterSummary of chapters) {
        const chapter = await getChapterDocument(courseId, chapterSummary.id);
        sections.push(...flattenChapter(chapter));
      }
      return sections;
    };

    load()
      .then((pages) => {
        if (!cancelled) setState({ status: 'ready', pages });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, scope]);

  const resolveUrl = (resourceId: string) => resolveResourceUrl(courseId, resourceId);

  return (
    <div role="dialog" aria-label="Preview as student" className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-[#E1DED4] bg-[#F3F0E6]">
        <h2 className="text-sm font-extrabold text-[#142030]">Preview as student</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="p-1.5 rounded-lg text-[#5E6A79] hover:bg-white hover:text-[#142030] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {state.status === 'loading' && <p className="text-sm text-[#5E6A79]">Loading preview…</p>}
        {state.status === 'error' && <p className="text-sm text-destructive">Could not load this preview. Please try again.</p>}
        {state.status === 'ready' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {state.pages.map((section, index) => (
              <div key={index}>
                {React.createElement(
                  `h${Math.min(6, Math.max(1, section.level))}` as keyof React.JSX.IntrinsicElements,
                  { className: 'font-display font-extrabold text-[#142030] mb-2' },
                  section.title || 'Untitled'
                )}
                <MarkdownViewer source={section.body} resolveResourceUrl={resolveUrl} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

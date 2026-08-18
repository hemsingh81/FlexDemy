// Story 11.4 (AC #1, #2): renamed from ContentNodeReadingPane.tsx -- that name predated this PRD's
// Page concept and its old job (dump a CourseFile's raw parsedContent as preformatted text, no
// renderer at all) no longer describes what this component does. Renders a real Page's
// bodyMarkdown through the same ui/MarkdownViewer.tsx renderer every other reading/preview surface
// in this epic uses (Story 7.3's editor Preview toggle, Story 11.2's Preview as Student),
// resolving every `resource:{id}` reference through the same courseContentService.resolveResourceUrl
// Story 11.2's PreviewAsStudent.tsx calls (AC #2's explicit "same function" requirement) -- never a
// second resolution helper.
import React from 'react';
import { MarkdownViewer } from '../../ui/MarkdownViewer';
import { resolveResourceUrl, type PageDocumentDto } from '../../services/courseContentService';

interface PageReadingPaneProps {
  courseId: string;
  page: PageDocumentDto | null;
  isLoading: boolean;
  failed: boolean;
}

export const PageReadingPane: React.FC<PageReadingPaneProps> = ({ courseId, page, isLoading, failed }) => {
  const resolveUrl = (resourceId: string) => resolveResourceUrl(courseId, resourceId);

  // AC #4's own boundary note: a real student can hit a load failure a previewing tutor never
  // will (Story 11.3's deny-by-default gate, until Enrollment exists) -- a friendly state here,
  // never a blank pane, matches this app's "never a silent empty state" convention.
  if (failed) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <p className="text-sm text-slate-600">Could not load this page. Please try again.</p>
      </div>
    );
  }

  if (isLoading || !page) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      <h2 className="text-lg font-bold text-slate-900">{page.title}</h2>
      <MarkdownViewer source={page.bodyMarkdown} resolveResourceUrl={resolveUrl} />
    </div>
  );
};

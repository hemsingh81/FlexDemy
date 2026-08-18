// Story 7.3, Task 6 (AC #5): "Preview" toggles a Page between edit and rendered-as-student view;
// "Markdown" shows/permits direct editing of the raw body. Preview renders through `lib/markdown.ts`
// (AD-12's single canonical renderer -- the same one Story 11.2's "Preview as Student" and Story
// 11.4's real Course Player use), never a second, drifting renderer built just for this toggle.
import React, { useState } from 'react';
import { MarkdownViewer } from '../../ui/MarkdownViewer';

export type PagePreviewMode = 'preview' | 'markdown';

interface PagePreviewPanelProps {
  mode: PagePreviewMode;
  bodyMarkdown: string;
  onCommitMarkdown: (markdown: string) => void;
  onClose: () => void;
  // Story 8.3, FR-30: resolves a `resource:{id}` URI to a real served URL at render time.
  // Optional -- a Page with no such reference never needs it, and the raw-Markdown-only escape
  // hatch (Story 7.3/FR-32-33) is the only way one can exist before Epic 9's Image blocks land.
  resolveResourceUrl?: (resourceId: string) => Promise<string>;
}

export const PagePreviewPanel: React.FC<PagePreviewPanelProps> = ({ mode, bodyMarkdown, onCommitMarkdown, onClose, resolveResourceUrl }) => {
  const [draft, setDraft] = useState(bodyMarkdown);

  return (
    <div data-testid="page-preview-panel" className="my-2 rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border bg-muted/40">
        <span className="text-xs font-bold text-foreground">{mode === 'preview' ? 'Preview (rendered as student)' : 'Markdown'}</span>
        <div className="flex items-center gap-2">
          {mode === 'markdown' && (
            <button
              type="button"
              onClick={() => onCommitMarkdown(draft)}
              className="text-xs font-bold text-accent hover:underline"
            >
              Apply
            </button>
          )}
          <button type="button" onClick={onClose} className="text-xs font-bold text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>
      </div>

      {mode === 'preview' ? (
        <MarkdownViewer source={bodyMarkdown} className="p-4" resolveResourceUrl={resolveResourceUrl} />
      ) : (
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label="Page body Markdown source"
          className="w-full min-h-40 p-4 font-mono text-xs text-foreground bg-transparent outline-none resize-y"
        />
      )}
    </div>
  );
};

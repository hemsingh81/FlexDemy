import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { parseMarkdown, type MarkdownBlock } from '../../lib/markdown';
import { splitIntoSections, type Section } from '../../lib/editor/splitIntoSections';
import { MarkdownViewer } from '../../ui/MarkdownViewer';
import { useToast } from '../../context/ToastContext';
import { attachExistingFileAsResource, type ResourceDto } from '../../services/courseContentService';
import type { ContentOwnerType } from '../../types';
import type { FileUploadEntry } from './useFileUpload';

// Story 10.1, Task 2: derives the exact raw-Markdown substring for each of splitIntoSections's
// blocks-based sections, by re-locating each section's own top-level heading line in the original
// raw source text and slicing up to the next one (or end of document). Kept local to this
// component rather than lib/editor/splitIntoSections.ts -- Task 1's own contract for that function
// is MarkdownBlock[] in, Section[] (still MarkdownBlock-shaped) out; turning a selected section
// back into an insertable raw-Markdown string is this picker's own concern, since Task 3 inserts
// via markdownManager.parse() on a Markdown STRING, not the MarkdownBlock tree. The heading-line
// regex mirrors lib/markdown.ts's own HEADING pattern (`/^(#{1,6})\s+(.*)$/`) restricted to exactly
// the section's own top-level hash count -- an N-hash line can never match a `#{N}\s+` pattern
// meant for N+1 hashes, since the (N+1)th character would be `#`, not whitespace.
const deriveSectionRawTexts = (source: string, sections: Section[]): string[] => {
  if (sections.length === 0) return [];
  const topLevel = Math.min(...sections.map((s) => (s.blocks[0] as Extract<MarkdownBlock, { type: 'heading' }>).level));
  const headingLine = new RegExp(`^#{${topLevel}}\\s+`);
  const lines = source.split('\n');
  const headingLineIndices: number[] = [];
  lines.forEach((line, index) => {
    if (headingLine.test(line)) headingLineIndices.push(index);
  });
  return headingLineIndices.map((startLine, index) => {
    const endLine = index + 1 < headingLineIndices.length ? headingLineIndices[index + 1] : lines.length;
    return lines.slice(startLine, endLine).join('\n').trim();
  });
};

interface InsertFromFilePickerProps {
  files: FileUploadEntry[];
  courseId: string;
  // The Page this insertion targets -- always a real, already-persisted Page (DocumentCanvas.tsx
  // only opens this picker from within its own `pageOwner`-gated command).
  pageOwner: { ownerType: ContentOwnerType; ownerId: string };
  onInsert: (markdown: string) => void;
  // Story 10.2, AC #1: fired only after a successful attach -- fileId is the source file that was
  // attached (ResourceDto itself carries no back-reference to it), letting the parent reflect the
  // new Resource in the live document (its own Learning Resources block) and its file-list state.
  onResourceAttached: (fileId: string, resource: ResourceDto) => void;
  onClose: () => void;
}

// Story 10.1, Task 2 (AC #1, #2): a standalone two-pane picker -- file list, then a section list
// with checkboxes (left pane), and a live insert preview (right pane). Deliberately NOT a
// repurposing of CourseContentEditor.tsx's FileContentCard -- that component is the read-only
// "review what got extracted" view in the Uploaded Files section; this is a selection-and-insert
// flow with its own interaction model, even though both render the same underlying ParsedContent
// through the same MarkdownViewer.
//
// Story 10.2, Task 1 (AC #1): also owns the "Also attach this file as a resource" checkbox and its
// own attachExistingFileAsResource call -- independent of the text insertion above it (one
// succeeding and the other failing is a real, expected outcome): a failed attach shows its own
// toast without ever discarding or rolling back the already-inserted text.
export const InsertFromFilePicker: React.FC<InsertFromFilePickerProps> = ({
  files,
  courseId,
  pageOwner,
  onInsert,
  onResourceAttached,
  onClose,
}) => {
  const { showToast } = useToast();
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [wholeFileSelected, setWholeFileSelected] = useState(true);
  const [selectedSections, setSelectedSections] = useState<Set<number>>(new Set());
  // Story 10.2, AC #1: "defaulted on" is explicit in the AC -- this is an opt-out, not an opt-in.
  const [attachAsResource, setAttachAsResource] = useState(true);

  const selectedFile = files.find((f) => f.id === selectedFileId) ?? null;
  const source = selectedFile?.parsedContent ?? '';
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  const sections = useMemo(() => splitIntoSections(blocks), [blocks]);
  const sectionRawTexts = useMemo(() => deriveSectionRawTexts(source, sections), [source, sections]);

  // Selection granularity per AC #2: whole file, or one-or-more top-level sections -- mutually
  // exclusive rather than additive (picking any section switches off "whole file", and vice versa)
  // since "whole file AND some sections" would just insert duplicate content.
  const selectedMarkdown = useMemo(() => {
    if (!selectedFile) return '';
    if (wholeFileSelected) return source;
    return sectionRawTexts.filter((_, index) => selectedSections.has(index)).join('\n\n');
  }, [selectedFile, wholeFileSelected, source, sectionRawTexts, selectedSections]);

  const openFile = (fileId: string) => {
    setSelectedFileId(fileId);
    setWholeFileSelected(true);
    setSelectedSections(new Set());
    setAttachAsResource(true);
  };

  const toggleSection = (index: number) => {
    setWholeFileSelected(false);
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectWholeFile = () => {
    setWholeFileSelected(true);
    setSelectedSections(new Set());
  };

  const canInsert = Boolean(selectedFile) && (wholeFileSelected || selectedSections.size > 0);

  // Text insertion commits (and the picker closes) immediately -- the attach call, when checked,
  // runs independently afterward as its own fire-and-forget promise: it must never block or delay
  // the tutor's already-decided text insertion, and its own failure must never undo it.
  const handleInsert = () => {
    const fileToAttach = attachAsResource ? selectedFile : null;
    onInsert(selectedMarkdown);
    onClose();
    if (fileToAttach) {
      attachExistingFileAsResource(courseId, pageOwner.ownerType, pageOwner.ownerId, fileToAttach.id, 'Attachment')
        .then((created) => onResourceAttached(fileToAttach.id, created))
        .catch(() => {
          showToast({ message: 'Could not attach this file as a resource. You can try again from Learning Resources.', variant: 'error' });
        });
    }
  };

  return (
    <div role="dialog" aria-label="Insert from file" className="z-20 w-[640px] max-w-[90vw] rounded-lg border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-bold text-foreground">Insert from file</span>
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="max-h-96 overflow-y-auto p-2">
          {!selectedFile ? (
            files.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No parsed files available yet.</p>
            ) : (
              <ul role="listbox" aria-label="Source files">
                {files.map((file) => (
                  <li key={file.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => openFile(file.id)}
                      className="w-full text-left px-2 py-1.5 rounded text-xs font-semibold text-foreground hover:bg-muted/60"
                    >
                      {file.name}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelectedFileId(null)}
                className="mb-2 text-xs text-muted-foreground hover:text-foreground"
              >
                ← Back to files
              </button>
              <label className="flex items-center gap-2 px-2 py-1.5 rounded text-xs font-bold text-foreground hover:bg-muted/60 cursor-pointer">
                <input type="checkbox" checked={wholeFileSelected} onChange={selectWholeFile} />
                Whole file
              </label>
              {sections.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No sections found in this file — only "Whole file" is available.</p>
              ) : (
                <ul>
                  {sections.map((section, index) => (
                    <li key={index}>
                      <label className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-foreground hover:bg-muted/60 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!wholeFileSelected && selectedSections.has(index)}
                          onChange={() => toggleSection(index)}
                        />
                        {section.title}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              <label className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded border-t border-border text-xs text-foreground hover:bg-muted/60 cursor-pointer">
                <input type="checkbox" checked={attachAsResource} onChange={(e) => setAttachAsResource(e.target.checked)} />
                Also attach this file to this page as a resource
              </label>
            </>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto p-3">
          {selectedMarkdown.trim().length > 0 ? (
            <MarkdownViewer source={selectedMarkdown} />
          ) : (
            <p className="text-xs text-muted-foreground">Select a file to preview what will be inserted.</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 px-3 py-2 border-t border-border">
        <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
          Cancel
        </button>
        <button
          type="button"
          disabled={!canInsert}
          onClick={handleInsert}
          className="px-3 py-1.5 text-xs font-bold text-[#BA5012] disabled:opacity-40 disabled:cursor-not-allowed hover:text-[#BA5012]/80"
        >
          Insert
        </button>
      </div>
    </div>
  );
};

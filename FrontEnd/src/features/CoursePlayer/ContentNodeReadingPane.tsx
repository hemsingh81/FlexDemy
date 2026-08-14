import React from 'react';
import type { CourseFileDto } from '../../services/courseFileService';

interface ContentNodeReadingPaneProps {
  file: CourseFileDto;
}

// The raw text Docling parsed from this file, shown as-is -- no AI structuring step, no
// Drill-Down/Exercise/keyword machinery in between (all removed along with the Chapter/Topic/
// Subtopic/ContentBlock tree this pane used to render).
export const ContentNodeReadingPane: React.FC<ContentNodeReadingPaneProps> = ({ file }) => (
  <div className="w-full max-w-4xl mx-auto space-y-4">
    <h2 className="text-lg font-bold text-slate-900">{file.fileName}</h2>
    <pre className="whitespace-pre-wrap break-words text-sm text-slate-800 leading-relaxed font-sans">
      {file.parsedContent || 'No text was extracted from this file.'}
    </pre>
  </div>
);

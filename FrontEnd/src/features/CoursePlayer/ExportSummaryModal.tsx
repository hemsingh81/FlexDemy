import React from 'react';
import { Check, Copy, Download, FileText, X } from 'lucide-react';

interface ExportSummaryModalProps {
  isOpen: boolean;
  lessonTitle: string;
  markdownContent: string;
  isCopied: boolean;
  onClose: () => void;
  onCopy: () => void;
  onDownload: () => void;
}

// Extracted from CoursePlayer.tsx: the "Export Summary & Notes" modal, previewing the generated
// Markdown study notes and offering copy/download actions.
export const ExportSummaryModal: React.FC<ExportSummaryModalProps> = ({
  isOpen,
  lessonTitle,
  markdownContent,
  isCopied,
  onClose,
  onCopy,
  onDownload,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-indigo-100 text-indigo-700 border border-indigo-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Export Summary & Notes</h3>
              <p className="text-xs text-slate-500">{lessonTitle} · Complete Aggregated Notes</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Previews formatted text */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-slate-800 leading-relaxed bg-slate-50/80 whitespace-pre-wrap select-all border-b border-slate-200">
          {markdownContent}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Includes sentences, LaTeX equations, 5-level drilldowns, and worked examples.
          </span>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              onClick={onCopy}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center space-x-1.5 transition-all shadow-2xs"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-600">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Markdown</span>
                </>
              )}
            </button>

            <button
              onClick={onDownload}
              className="px-4 py-2 bg-[#143358] hover:bg-[#143358]/90 text-white rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download .md File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

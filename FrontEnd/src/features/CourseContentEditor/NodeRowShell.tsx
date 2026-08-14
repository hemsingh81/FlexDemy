import React from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import type { NodeConfirmation } from './useCourseContentTree';

// Extracted from ContentTreeNode.tsx -- shared node-row shell: content-tree-node visual spec
// (confirm badge/button, move up/down, delete, and native HTML5 drag-and-drop reorder) used by
// every level of the tree (Chapter/Topic/Subtopic/ContentBlock rows).
interface NodeRowShellProps {
  nodeId: string;
  confirmation: NodeConfirmation;
  onConfirm: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDelete: () => void;
  deleteLabel: string;
  moveLabelBase: string;
  // Native HTML5 drag-and-drop reorder (AC#3/Task 5's "additional input method" alongside the
  // keyboard up/down buttons above, matching AdaptiveSchedule.tsx's drag mechanics).
  onDropNode: (draggedId: string) => void;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
}

export const NodeRowShell: React.FC<NodeRowShellProps> = ({
  nodeId,
  confirmation,
  onConfirm,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onDelete,
  deleteLabel,
  moveLabelBase,
  onDropNode,
  children,
  headerExtra,
}) => {
  const isConfirmed = confirmation === 'confirmed';
  return (
    <div
      data-testid={`tree-node-${nodeId}`}
      draggable
      onDragStart={(e) => {
        // Stopped from bubbling -- without this, nested draggable rows (a Content Block inside a
        // Subtopic inside a Topic) would all fire their own dragstart on the same gesture, and
        // the outermost one's setData call would silently overwrite the actually-dragged node's id.
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', nodeId);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        // Stopped from bubbling for the same reason as dragstart -- otherwise a drop on a nested
        // row would also fire every ancestor row's own onDrop with the same dragged id.
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (draggedId && draggedId !== nodeId) onDropNode(draggedId);
      }}
      className={`bg-white border rounded-xl p-3 space-y-2 cursor-move ${
        isConfirmed ? 'border-[#E1DED4] border-l-4 border-l-[#179765]' : 'border-[#E1DED4]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-2">{children}</div>
        <div className="flex items-center gap-1 shrink-0">
          {headerExtra}
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
              isConfirmed ? 'bg-[#179765]/10 text-[#179765]' : 'bg-slate-100 text-[#5E6A79]'
            }`}
            aria-label={isConfirmed ? 'Confirmed' : 'Not confirmed'}
          >
            {isConfirmed ? 'Confirmed' : 'Unconfirmed'}
          </span>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirmed}
            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-[#143358] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            aria-label={`Move ${moveLabelBase} up`}
            className="p-1 rounded disabled:opacity-30"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            aria-label={`Move ${moveLabelBase} down`}
            className="p-1 rounded disabled:opacity-30"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onDelete} aria-label={deleteLabel} className="p-1 rounded text-red-600 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

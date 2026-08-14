import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

// Extracted from ContentTreeNode.tsx -- expand/collapse chevron used by Chapter/Topic/Subtopic
// rows only (Content Blocks are leaves).
interface ExpandToggleProps {
  isExpanded: boolean;
  onToggle: () => void;
  label: string;
}

export const ExpandToggle: React.FC<ExpandToggleProps> = ({ isExpanded, onToggle, label }) => (
  <button type="button" onClick={onToggle} aria-label={isExpanded ? `Collapse ${label}` : `Expand ${label}`} className="p-0.5 shrink-0">
    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
  </button>
);

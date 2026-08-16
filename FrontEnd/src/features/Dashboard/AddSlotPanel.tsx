import React from 'react';
import { SidePanel } from '../../ui/SidePanel';
import { Button } from '../../ui/Button';

interface AddSlotPanelProps {
  isOpen: boolean;
  slotDate: string;
  onSlotDateChange: (value: string) => void;
  slotStart: string;
  onSlotStartChange: (value: string) => void;
  slotEnd: string;
  onSlotEndChange: (value: string) => void;
  slotTopic: string;
  onSlotTopicChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

// Extracted from TutorEducatorHubView.tsx: the "Add Teaching Calendar Slot" side panel.
export const AddSlotPanel: React.FC<AddSlotPanelProps> = ({
  isOpen,
  slotDate,
  onSlotDateChange,
  slotStart,
  onSlotStartChange,
  slotEnd,
  onSlotEndChange,
  slotTopic,
  onSlotTopicChange,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  return (
    <SidePanel
      title="Add Teaching Calendar Slot"
      onClose={onClose}
      closeOnBackdropClick={false}
      footer={({ requestClose }) => (
        <>
          {/* requestClose, not onClose: it plays the panel's slide-out first, so Cancel dismisses
              the same way the header X and Escape do (see ui/SidePanel.tsx). */}
          <Button variant="ghost" size="sm" onClick={requestClose}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={onSave}>
            Save Slot
          </Button>
        </>
      )}
    >
      <div className="space-y-3 text-xs">
        <div>
          <label className="font-bold text-[#142030]">Date:</label>
          <input
            type="date"
            value={slotDate}
            onChange={(e) => onSlotDateChange(e.target.value)}
            className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs text-[#142030] mt-1 focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="font-bold text-[#142030]">Start Time:</label>
            <input
              type="text"
              value={slotStart}
              onChange={(e) => onSlotStartChange(e.target.value)}
              placeholder="02:00 PM"
              className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs text-[#142030] mt-1 focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
            />
          </div>
          <div>
            <label className="font-bold text-[#142030]">End Time:</label>
            <input
              type="text"
              value={slotEnd}
              onChange={(e) => onSlotEndChange(e.target.value)}
              placeholder="03:00 PM"
              className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs text-[#142030] mt-1 focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
            />
          </div>
        </div>

        <div>
          <label className="font-bold text-[#142030]">Topic / Agenda:</label>
          <input
            type="text"
            value={slotTopic}
            onChange={(e) => onSlotTopicChange(e.target.value)}
            placeholder="E.g., Class 12th Board Exam Physics Derivations"
            className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs text-[#142030] mt-1 focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
          />
        </div>
      </div>
    </SidePanel>
  );
};

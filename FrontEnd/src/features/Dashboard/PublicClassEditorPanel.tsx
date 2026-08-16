import React from 'react';
import { Radio, Sparkles, Users } from 'lucide-react';
import { PublicLiveClass, SubjectCategory, TutorCalendarSlot } from '../../types';
import { SidePanel } from '../../ui/SidePanel';
import { Button } from '../../ui/Button';
import { ChoiceToggle } from './ChoiceToggle';

interface PublicClassEditorPanelProps {
  isOpen: boolean;
  editingPublicClass: PublicLiveClass | null;
  selectedSlotForEdit: TutorCalendarSlot | null;
  pcTitle: string;
  onPcTitleChange: (value: string) => void;
  pcDescription: string;
  onPcDescriptionChange: (value: string) => void;
  pcSubject: SubjectCategory;
  onPcSubjectChange: (value: SubjectCategory) => void;
  pcDate: string;
  onPcDateChange: (value: string) => void;
  pcTime: string;
  onPcTimeChange: (value: string) => void;
  pcDuration: number;
  onPcDurationChange: (value: number) => void;
  pcFlatPrice: number;
  onPcFlatPriceChange: (value: number) => void;
  pcPricePerMinute: number;
  onPcPricePerMinuteChange: (value: number) => void;
  pcMeetingUrl: string;
  onPcMeetingUrlChange: (value: string) => void;
  pcSessionType: 'public_class' | 'one_on_one';
  onPcSessionTypeChange: (value: 'public_class' | 'one_on_one') => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

// Extracted from TutorEducatorHubView.tsx: the "Create & Schedule Public Live Class" / "Modify
// Public Live Class Session" side-panel form.
export const PublicClassEditorPanel: React.FC<PublicClassEditorPanelProps> = ({
  isOpen,
  editingPublicClass,
  selectedSlotForEdit,
  pcTitle,
  onPcTitleChange,
  pcDescription,
  onPcDescriptionChange,
  pcSubject,
  onPcSubjectChange,
  pcDate,
  onPcDateChange,
  pcTime,
  onPcTimeChange,
  pcDuration,
  onPcDurationChange,
  pcFlatPrice,
  onPcFlatPriceChange,
  pcPricePerMinute,
  onPcPricePerMinuteChange,
  pcMeetingUrl,
  onPcMeetingUrlChange,
  pcSessionType,
  onPcSessionTypeChange,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <SidePanel
      title={editingPublicClass ? 'Modify Public Live Class Session' : 'Create & Schedule Public Live Class'}
      subtitle={
        selectedSlotForEdit
          ? `Linked to Calendar Slot: ${selectedSlotForEdit.date} (${selectedSlotForEdit.startTime})`
          : 'Broadcasting live session to all students on FlexDemy'
      }
      onClose={onClose}
      closeOnBackdropClick={false}
      width="lg"
      footer={({ requestClose }) => (
        <>
          <Button variant="ghost" size="sm" type="button" onClick={requestClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" form="public-class-form" icon={<Sparkles className="w-4 h-4" />}>
            {editingPublicClass ? 'Save Changes' : '🚀 Save & Broadcast Public Session'}
          </Button>
        </>
      )}
    >
      <form id="public-class-form" onSubmit={onSubmit} className="space-y-4 text-xs">
        {/* Session Type Toggle */}
        <div>
          <label className="font-bold text-[#142030]">Session Mode:</label>
          <ChoiceToggle
            value={pcSessionType}
            onChange={onPcSessionTypeChange}
            options={[
              {
                value: 'public_class',
                label: 'Public Live Class',
                description: 'Open broadcast for multiple students',
                icon: Radio,
                selectedClassName: 'bg-[#143358] text-white border-[#143358]',
              },
              {
                value: 'one_on_one',
                label: '1-on-1 Tutoring',
                description: 'Private single student booking',
                icon: Users,
                selectedClassName: 'bg-[#BA5012] text-white border-[#BA5012]',
              },
            ]}
          />
        </div>

        {/* Class Title */}
        <div>
          <label className="font-bold text-[#142030]">Live Masterclass Title:</label>
          <input
            type="text"
            required
            value={pcTitle}
            onChange={(e) => onPcTitleChange(e.target.value)}
            placeholder="E.g., Class 12th Quantum Grover Algorithm & Qiskit Live Proof"
            className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-1 text-[#142030] font-medium focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
          />
        </div>

        {/* Subject & Duration */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#142030]">Subject Category:</label>
            <select
              value={pcSubject}
              onChange={(e) => onPcSubjectChange(e.target.value as SubjectCategory)}
              className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-1 text-[#142030] font-medium focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
            >
              <option value="physics">Physics</option>
              <option value="computer_science">Computer Science</option>
              <option value="stem_math">Mathematics</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-[#142030]">Duration (Minutes):</label>
            <input
              type="number"
              min="15"
              max="180"
              value={pcDuration}
              onChange={(e) => onPcDurationChange(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-1 text-[#142030] font-medium focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
            />
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#142030]">Scheduled Date:</label>
            <input
              type="date"
              required
              value={pcDate}
              onChange={(e) => onPcDateChange(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-1 text-[#142030] font-medium focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
            />
          </div>

          <div>
            <label className="font-bold text-[#142030]">Start Time:</label>
            <input
              type="text"
              required
              value={pcTime}
              onChange={(e) => onPcTimeChange(e.target.value)}
              placeholder="04:00 PM EST"
              className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-1 text-[#142030] font-medium focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
            />
          </div>
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#142030]">Flat Admission Price ($):</label>
            <input
              type="number"
              step="0.5"
              value={pcFlatPrice}
              onChange={(e) => onPcFlatPriceChange(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-1 text-[#142030] font-medium focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
            />
          </div>

          <div>
            <label className="font-bold text-[#142030]">Price Per Minute ($):</label>
            <input
              type="number"
              step="0.05"
              value={pcPricePerMinute}
              onChange={(e) => onPcPricePerMinuteChange(Number(e.target.value))}
              className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-1 text-[#142030] font-medium focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
            />
          </div>
        </div>

        {/* Meeting Link */}
        <div>
          <label className="font-bold text-[#142030]">Virtual Room / Live Meeting URL:</label>
          <input
            type="text"
            required
            value={pcMeetingUrl}
            onChange={(e) => onPcMeetingUrlChange(e.target.value)}
            placeholder="https://meet.flexdemy.edu/public-room-101"
            className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-1 text-[#142030] font-medium focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
          />
        </div>

        {/* Description / Agenda */}
        <div>
          <label className="font-bold text-[#142030]">Short Description & Learning Agenda:</label>
          <textarea
            rows={3}
            value={pcDescription}
            onChange={(e) => onPcDescriptionChange(e.target.value)}
            placeholder="Describe key derivations, problem sets, or coding walkthroughs covered..."
            className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-1 text-[#142030] font-medium focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
          />
        </div>
      </form>
    </SidePanel>
  );
};

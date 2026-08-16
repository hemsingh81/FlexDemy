import React, { FormEvent } from 'react';
import { SidePanel } from '../../ui/SidePanel';
import { Button } from '../../ui/Button';

interface RequestGroupSidePanelProps {
  reqCourseTitle: string;
  onReqCourseTitleChange: (value: string) => void;
  reqTopic: string;
  onReqTopicChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (e: FormEvent) => void;
}

// Extracted from StudentTutorBookingView.tsx: the "Request New Student Group Pool" side panel.
export const RequestGroupSidePanel: React.FC<RequestGroupSidePanelProps> = ({
  reqCourseTitle,
  onReqCourseTitleChange,
  reqTopic,
  onReqTopicChange,
  onClose,
  onSubmit,
}) => {
  return (
    <SidePanel
      title="Request New Student Group Pool"
      onClose={onClose}
      closeOnBackdropClick={false}
      footer={({ requestClose }) => (
        <>
          <Button variant="ghost" size="sm" type="button" onClick={requestClose}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" type="submit" form="request-group-form">
            Publish Group Pool
          </Button>
        </>
      )}
    >
      <form id="request-group-form" onSubmit={onSubmit} className="space-y-3 text-xs">
        <div>
          <label className="font-bold text-[#142030]">Course / Subject Title:</label>
          <input
            type="text"
            required
            value={reqCourseTitle}
            onChange={(e) => onReqCourseTitleChange(e.target.value)}
            placeholder="E.g., Class 12th Physics - Electricity & Magnetism"
            className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs text-[#142030] mt-1 focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
          />
        </div>

        <div>
          <label className="font-bold text-[#142030]">Specific Topic or Problem Set:</label>
          <input
            type="text"
            required
            value={reqTopic}
            onChange={(e) => onReqTopicChange(e.target.value)}
            placeholder="E.g., Gauss Law Vector Proofs & Capacitor Circuits"
            className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs text-[#142030] mt-1 focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
          />
        </div>
      </form>
    </SidePanel>
  );
};

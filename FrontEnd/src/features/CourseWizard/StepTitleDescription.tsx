import React from 'react';
import { COURSE_TITLE_MAX_LENGTH, type CourseDraft } from './useCourseDraft';

interface StepTitleDescriptionProps {
  draft: CourseDraft;
  updateTitle: (title: string) => void;
  updateDescription: (description: string) => void;
}

export const StepTitleDescription: React.FC<StepTitleDescriptionProps> = ({ draft, updateTitle, updateDescription }) => {
  const isEmpty = draft.title.trim().length === 0;
  const overLimit = draft.title.length > COURSE_TITLE_MAX_LENGTH;

  return (
    <div className="space-y-4 text-xs">
      <div>
        <label htmlFor="course-title" className="font-bold text-[#142030]">
          Course Title:
        </label>
        <input
          id="course-title"
          type="text"
          value={draft.title}
          onChange={(e) => updateTitle(e.target.value)}
          maxLength={COURSE_TITLE_MAX_LENGTH}
          placeholder="E.g., Class 12th Physics: Advanced Electromagnetic Waves"
          className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-1 text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
        />
        <p className={`mt-1 text-[10px] ${overLimit ? 'text-red-600 font-bold' : 'text-[#5E6A79]'}`}>
          {draft.title.length}/{COURSE_TITLE_MAX_LENGTH} characters{isEmpty && ' — title is required'}
        </p>
      </div>

      <div>
        <label htmlFor="course-description" className="font-bold text-[#142030]">
          Description (optional):
        </label>
        <textarea
          id="course-description"
          value={draft.description}
          onChange={(e) => updateDescription(e.target.value)}
          placeholder="Brief description for discovery cards..."
          rows={3}
          className="w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-1 text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012]"
        />
      </div>
    </div>
  );
};

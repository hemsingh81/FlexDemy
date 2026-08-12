import React from 'react';
import { TypeaheadMultiSelect, type TypeaheadOption } from '../../ui/TypeaheadMultiSelect';
import type { Tag } from '../../services/tagsService';
import type { CourseDraft } from './useCourseDraft';

interface StepTagsProps {
  draft: CourseDraft;
  tags: Tag[];
  lockedTags: Tag[];
  toggleTag: (tagId: string) => void;
}

export const StepTags: React.FC<StepTagsProps> = ({ draft, tags, lockedTags, toggleTag }) => {
  const options: TypeaheadOption[] = tags.map((t) => ({ value: t.id, label: t.name }));
  const selected = draft.tagIds.filter((id) => tags.some((t) => t.id === id));
  const lockedValues: TypeaheadOption[] = lockedTags.map((t) => ({ value: t.id, label: t.name }));

  const handleChange = (next: string[]) => {
    const added = next.find((id) => !selected.includes(id));
    if (added) {
      toggleTag(added);
      return;
    }
    const removed = selected.find((id) => !next.includes(id));
    if (removed) toggleTag(removed);
  };

  return (
    <div className="space-y-2 text-xs">
      <label className="font-bold text-[#142030]">Tags:</label>
      <TypeaheadMultiSelect
        options={options}
        selected={selected}
        onChange={handleChange}
        lockedValues={lockedValues}
        placeholder="Search tags..."
        emptyMessage="No tags available."
      />
      {lockedValues.length > 0 && (
        <p className="text-[10px] text-[#5E6A79]">
          Locked tags were deactivated by an admin after being attached to this course and can no longer be removed or re-selected.
        </p>
      )}
    </div>
  );
};

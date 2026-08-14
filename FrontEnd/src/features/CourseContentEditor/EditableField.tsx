import React, { useEffect, useState } from 'react';

// Extracted from ContentTreeNode.tsx -- shared editable field: local draft state, autosaves on
// blur (UX-DR8).
interface EditableFieldProps {
  value: string;
  onSave: (next: string) => void;
  placeholder?: string;
  multiline?: boolean;
  lang?: string;
  ariaLabel: string;
  className?: string;
}

export const EditableField: React.FC<EditableFieldProps> = ({ value, onSave, placeholder, multiline, lang, ariaLabel, className }) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const handleBlur = () => {
    if (draft !== value) onSave(draft);
  };

  const sharedClassName =
    className ??
    'w-full text-xs bg-transparent border-b border-transparent hover:border-[#E1DED4] focus:border-[#BA5012] outline-none px-0.5 py-0.5';

  if (multiline) {
    return (
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        lang={lang}
        aria-label={ariaLabel}
        rows={2}
        className={sharedClassName}
      />
    );
  }
  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      placeholder={placeholder}
      lang={lang}
      aria-label={ariaLabel}
      className={sharedClassName}
    />
  );
};

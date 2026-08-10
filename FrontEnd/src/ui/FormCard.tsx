import React from 'react';
import { X } from 'lucide-react';
import { Alert } from './Alert';

// Shared Add/Edit form chrome (originally built for MasterDataTable.tsx's Master Data screens,
// lifted here so any other admin screen -- e.g. AdminUserStatusList's Support-user edit modal --
// gets the exact same look/feel by construction, not by a second hand-copied implementation
// drifting out of sync over time).

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  optional?: boolean;
}

export const inputClassName =
  'w-full px-3 py-2 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012]';

export const inputErrorClassName = 'border-red-400 ring-1 ring-red-300';

// Every field without `optional: true` is implicitly required. Shared by every caller's
// create/update submit handler so the "blank required field" rule is defined exactly once and
// applies identically everywhere it's used.
export function getRequiredFieldErrors(fields: FormField[], values: Record<string, string>): Record<string, boolean> {
  const errors: Record<string, boolean> = {};
  fields.forEach((field) => {
    if (field.optional) return;
    if (!(values[field.key] ?? '').trim()) {
      errors[field.key] = true;
    }
  });
  return errors;
}

// The base-fields grid, shared byte-for-byte between every Add form and Edit panel/modal that
// renders through FormCard below, so they're visually identical by construction rather than by
// multiple copies staying in sync. Required fields (every field without `optional: true`) get a
// small red asterisk next to their label, and a red ring once `errors` flags them as blank.
export interface FieldsGridProps {
  fields: FormField[];
  values: Record<string, string>;
  errors: Record<string, boolean>;
  idPrefix: string;
  onChange: (key: string, value: string) => void;
}

export const FieldsGrid: React.FC<FieldsGridProps> = ({ fields, values, errors, idPrefix, onChange }) => (
  <div className="grid sm:grid-cols-3 gap-3 items-end">
    {fields.map((field) => {
      const fieldId = `${idPrefix}-${field.key}`;
      const hasError = Boolean(errors[field.key]);
      return (
        <div key={field.key} className="space-y-1">
          {/* The asterisk lives outside <label> (a sibling, not a child) so it never becomes
              part of the label's accessible name -- keeps getByLabelText('Name') matching
              exactly, required fields or not, rather than needing 'Name *' everywhere. */}
          <div className="flex items-center gap-1">
            <label htmlFor={fieldId} className="block text-xs font-semibold text-[#142030]">
              {field.label}
            </label>
            {!field.optional && (
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
            )}
          </div>
          {field.type === 'select' ? (
            <select
              id={fieldId}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              className={`${inputClassName} ${hasError ? inputErrorClassName : ''}`}
            >
              <option value="">{field.optional ? 'None' : 'Select...'}</option>
              {(field.options || []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={fieldId}
              type={field.type}
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className={`${inputClassName} ${hasError ? inputErrorClassName : ''}`}
            />
          )}
        </div>
      );
    })}
  </div>
);

// The shared Add/Edit card chrome: a bordered, rounded, margined container with a Header
// (title + close X), a Body (fields/extras, passed as children) and a Footer (Cancel + Save,
// separated by a top border and a light background tint). Every Add form and Edit panel/modal
// renders through this one component so they can't drift apart.
export interface FormCardProps {
  title: string;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
  // Renders as a bordered/iconed Alert at the top of the body, right above the fields -- "before
  // the control", not below the whole card where it's easy to miss.
  errorMessage?: string;
  children: React.ReactNode;
}

export const FormCard: React.FC<FormCardProps> = ({ title, onCancel, onSubmit, isSaving, errorMessage, children }) => (
  <form onSubmit={onSubmit} className="border border-[#E1DED4] rounded-2xl m-4 overflow-hidden bg-white shadow-2xs">
    <div className="flex items-center justify-between px-4 py-3 border-b border-[#E1DED4]">
      <h4 className="text-sm font-bold text-[#142030]">{title}</h4>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Close"
        className="p-1 rounded-lg text-[#5E6A79] hover:text-[#143358] hover:bg-[#F3F0E6] transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
    <div className="p-4 space-y-3">
      {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
      {children}
    </div>
    <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-[#E1DED4] bg-[#FAF7EC]">
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-[#E1DED4] text-[#142030] cursor-pointer"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isSaving}
        className="px-4 py-2 rounded-xl text-xs font-bold bg-[#143358] text-white disabled:opacity-60 cursor-pointer"
      >
        {isSaving ? 'Saving...' : 'Save'}
      </button>
    </div>
  </form>
);

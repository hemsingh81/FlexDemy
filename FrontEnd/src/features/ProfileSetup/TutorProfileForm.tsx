import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useProfileSetup } from './useProfileSetup';
import { Subject } from '../../services/masterDataService';
import { Spinner } from '../../ui/Spinner';
import { Button } from '../../ui/Button';

// See StudentProfileForm.tsx for why the whole hook result is passed as one prop.
interface TutorProfileFormProps {
  profileSetup: ReturnType<typeof useProfileSetup>;
  submitLabel?: string;
}

const selectClassName =
  'w-full px-3 py-2.5 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#EC7B38] disabled:opacity-50 disabled:cursor-not-allowed';
const textareaClassName =
  'w-full px-3 py-2.5 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] placeholder-[#5E6A79] focus:outline-none focus:ring-2 focus:ring-[#EC7B38] resize-none';
const labelClassName = 'block text-xs font-semibold text-[#142030]';

export const TutorProfileForm: React.FC<TutorProfileFormProps> = ({ profileSetup, submitLabel }) => {
  const {
    countries,
    states,
    cities,
    subjects,
    isLoadingMasterData,
    countryId,
    stateId,
    cityId,
    subjectIds,
    bio,
    qualifications,
    selectCountry,
    selectState,
    selectCity,
    toggleSubject,
    setBio,
    setQualifications,
    isSubmitting,
    error,
    submitTutorApplication,
  } = profileSetup;

  const subjectsByStream: Record<string, Subject[]> = {};
  for (const subject of subjects) {
    const key = subject.stream || 'General';
    (subjectsByStream[key] ||= []).push(subject);
  }

  if (isLoadingMasterData) {
    return (
      <div className="flex items-center justify-center py-12 text-[#5E6A79]">
        <Spinner size="lg" className="mr-2" />
        <span className="text-sm">Loading form...</span>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitTutorApplication();
      }}
      className="space-y-4"
    >
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className={labelClassName}>Country</label>
          <select value={countryId} onChange={(e) => selectCountry(e.target.value)} className={selectClassName}>
            <option value="">Select...</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClassName}>State</label>
          <select
            value={stateId}
            onChange={(e) => selectState(e.target.value)}
            disabled={!countryId}
            className={selectClassName}
          >
            <option value="">Select...</option>
            {states.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClassName}>City</label>
          <select
            value={cityId}
            onChange={(e) => selectCity(e.target.value)}
            disabled={!stateId}
            className={selectClassName}
          >
            <option value="">Select...</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className={labelClassName}>Subjects you can teach</label>
        <div className="max-h-52 overflow-y-auto border border-[#E1DED4] rounded-xl p-3 space-y-3 bg-white">
          {Object.entries(subjectsByStream).map(([stream, streamSubjects]) => (
            <div key={stream} className="space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#5E6A79]">{stream}</p>
              <div className="grid sm:grid-cols-2 gap-1.5">
                {streamSubjects.map((subject) => (
                  <label key={subject.id} className="flex items-center gap-2 text-xs text-[#142030] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={subjectIds.includes(subject.id)}
                      onChange={() => toggleSubject(subject.id)}
                      className="rounded border-[#E1DED4] text-[#EC7B38] focus:ring-[#EC7B38]"
                    />
                    <span>{subject.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <label className={labelClassName}>Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder="Tell students a bit about yourself..."
          className={textareaClassName}
        />
      </div>

      <div className="space-y-1">
        <label className={labelClassName}>Qualifications</label>
        <textarea
          value={qualifications}
          onChange={(e) => setQualifications(e.target.value)}
          rows={3}
          placeholder="Degrees, certifications, teaching experience..."
          className={textareaClassName}
        />
      </div>

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

      <Button
        type="submit"
        fullWidth
        isLoading={isSubmitting}
        loadingText="Submitting..."
        trailingIcon={<ArrowRight className="w-4 h-4" />}
      >
        {submitLabel || 'Submit Application'}
      </Button>
    </form>
  );
};

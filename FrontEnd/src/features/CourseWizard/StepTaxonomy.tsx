import React from 'react';
import type { Board, City, ClassLevel, Country, State, Subject } from '../../services/masterDataService';
import { NATIONAL_STATE_VALUE, NOT_APPLICABLE_CITY_VALUE, type CourseDraft, type TaxonomyField } from './useCourseDraft';

const selectClassName =
  'w-full p-2.5 rounded-xl bg-white border border-[#E1DED4] text-xs mt-1 text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012] disabled:opacity-50 disabled:cursor-not-allowed';

interface StepTaxonomyProps {
  draft: CourseDraft;
  countries: Country[];
  states: State[];
  cities: City[];
  boards: Board[];
  classLevels: ClassLevel[];
  subjects: Subject[];
  updateTaxonomy: (field: TaxonomyField, value: string) => void;
}

// Cascade order (Country -> State -> City -> Board -> Class Level -> Subject) matches
// EXPERIENCE.md's Taxonomy step, but the required-ness of State/City is board-dependent (FR-8) --
// the OPPOSITE order of information. State and City each carry an explicit "National / Not
// Applicable" option so a tutor can satisfy the "parent chosen" cascade gate and reach Board
// without forcing a specific State/City pick; whether that choice is actually valid is enforced
// only at the Next-button gate (isTaxonomyStepValid), never by disabling Board itself.
export const StepTaxonomy: React.FC<StepTaxonomyProps> = ({
  draft,
  countries,
  states,
  cities,
  boards,
  classLevels,
  subjects,
  updateTaxonomy,
}) => {
  const statesForCountry = states.filter((s) => s.countryId === draft.countryId);
  const citiesForState = draft.stateId && draft.stateId !== NATIONAL_STATE_VALUE ? cities.filter((c) => c.stateId === draft.stateId) : [];
  const boardsAvailable = boards.filter((b) => b.stateId === null || b.stateId === draft.stateId);
  const selectedBoard = boards.find((b) => b.id === draft.boardId);
  // Mirrors isTaxonomyStepValid's state-scoped-board check -- only show the warning while it's
  // still true, not for the board's entire lifetime once selected (a state-scoped board with a
  // valid real State/City chosen doesn't need to keep warning the tutor about a requirement
  // they've already satisfied).
  const hasRealState = Boolean(draft.stateId) && draft.stateId !== NATIONAL_STATE_VALUE;
  const hasRealCity = Boolean(draft.cityId) && draft.cityId !== NOT_APPLICABLE_CITY_VALUE;
  const showBoardLocationWarning = Boolean(selectedBoard?.stateId) && !(hasRealState && hasRealCity);
  const selectedClassLevel = classLevels.find((c) => c.id === draft.classLevelId);
  const subjectsForClassLevel = selectedClassLevel ? subjects.filter((s) => selectedClassLevel.subjectIds.includes(s.id)) : [];

  return (
    <div className="space-y-4 text-xs">
      <div>
        <label htmlFor="taxonomy-country" className="font-bold text-[#142030]">
          Country:
        </label>
        <select
          id="taxonomy-country"
          value={draft.countryId}
          onChange={(e) => updateTaxonomy('countryId', e.target.value)}
          className={selectClassName}
        >
          <option value="">Select a country...</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="taxonomy-state" className="font-bold text-[#142030]">
            State:
          </label>
          <select
            id="taxonomy-state"
            value={draft.stateId}
            onChange={(e) => updateTaxonomy('stateId', e.target.value)}
            disabled={!draft.countryId}
            className={selectClassName}
          >
            <option value="">Select a state...</option>
            <option value={NATIONAL_STATE_VALUE}>National / Not Applicable</option>
            {statesForCountry.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="taxonomy-city" className="font-bold text-[#142030]">
            City:
          </label>
          <select
            id="taxonomy-city"
            value={draft.cityId}
            onChange={(e) => updateTaxonomy('cityId', e.target.value)}
            disabled={!draft.stateId}
            className={selectClassName}
          >
            <option value="">Select a city...</option>
            <option value={NOT_APPLICABLE_CITY_VALUE}>Not Applicable</option>
            {citiesForState.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="taxonomy-board" className="font-bold text-[#142030]">
          Board:
        </label>
        <select
          id="taxonomy-board"
          value={draft.boardId}
          onChange={(e) => updateTaxonomy('boardId', e.target.value)}
          disabled={!draft.cityId}
          className={selectClassName}
        >
          <option value="">Select a board...</option>
          {boardsAvailable.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {showBoardLocationWarning && (
          <p className="mt-1 text-[10px] text-[#5E6A79]">
            This board requires a specific State and City — "National / Not Applicable" won't be accepted.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="taxonomy-class-level" className="font-bold text-[#142030]">
            Class Level:
          </label>
          <select
            id="taxonomy-class-level"
            value={draft.classLevelId}
            onChange={(e) => updateTaxonomy('classLevelId', e.target.value)}
            disabled={!draft.boardId}
            className={selectClassName}
          >
            <option value="">Select a class level...</option>
            {classLevels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="taxonomy-subject" className="font-bold text-[#142030]">
            Subject:
          </label>
          <select
            id="taxonomy-subject"
            value={draft.subjectId}
            onChange={(e) => updateTaxonomy('subjectId', e.target.value)}
            disabled={!draft.classLevelId}
            className={selectClassName}
          >
            <option value="">Select a subject...</option>
            {subjectsForClassLevel.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

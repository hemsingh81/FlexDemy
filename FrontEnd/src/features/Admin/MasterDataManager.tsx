import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as masterDataService from '../../services/masterDataService';
import type { Board, City, ClassLevel, Country, State, Subject } from '../../services/masterDataService';
import { MasterDataTable, type MasterDataExtraField } from './MasterDataTable';
import { MASTER_DATA_ENTITIES, MASTER_DATA_ENTITY_META, type MasterDataEntity } from './masterDataEntities';
import { TypeaheadMultiSelect } from '../../ui/TypeaheadMultiSelect';

// Hosts one MasterDataTable per entity (plan §5 item 5). Country/ClassLevel/Subject have no
// parent; State/City/Board are scoped by the "Location scope" selector below (reusing the
// Country->State cascading pattern already proven in features/ProfileSetup/useProfileSetup.ts),
// and every table's fetchAll always passes includeInactive=true -- this is the admin screen,
// so Master/Support need to see (and reactivate) deactivated rows, not just active ones.
const selectClassName =
  'px-3 py-2 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#EC7B38]';

export const MasterDataManager: React.FC = () => {
  const [activeEntity, setActiveEntity] = useState<MasterDataEntity>('country');
  const [countries, setCountries] = useState<Country[]>([]);
  const [statesInScope, setStatesInScope] = useState<State[]>([]);
  const [scopeCountryId, setScopeCountryId] = useState('');
  const [scopeStateId, setScopeStateId] = useState('');
  // Fetched once for the ClassLevel table's Subject multi-select (Part B) -- includeInactive
  // so Master/Support can still see (and unassign) a subject that's since been deactivated.
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    masterDataService.getCountries(true).then((list) => {
      setCountries(list);
      setScopeCountryId((prev) => (prev || list[0]?.id || ''));
    });
    masterDataService.getSubjects(true).then(setAllSubjects);
  }, []);

  useEffect(() => {
    if (!scopeCountryId) {
      setStatesInScope([]);
      setScopeStateId('');
      return;
    }
    let cancelled = false;
    masterDataService.getStates(scopeCountryId, true).then((list) => {
      if (cancelled) return;
      setStatesInScope(list);
      setScopeStateId((prev) => (list.some((s) => s.id === prev) ? prev : list[0]?.id || ''));
    });
    return () => {
      cancelled = true;
    };
  }, [scopeCountryId]);

  const countryOptions = countries.map((c) => ({ value: c.id, label: c.name }));
  const stateOptions = statesInScope.map((s) => ({ value: s.id, label: s.name }));

  const fetchCountries = useCallback(() => masterDataService.getCountries(true), []);
  const fetchStates = useCallback(
    () => (scopeCountryId ? masterDataService.getStates(scopeCountryId, true) : Promise.resolve([])),
    [scopeCountryId]
  );
  const fetchCities = useCallback(
    () => (scopeStateId ? masterDataService.getCities(scopeStateId, true) : Promise.resolve([])),
    [scopeStateId]
  );
  const fetchBoards = useCallback(
    () => masterDataService.getBoards(scopeStateId || undefined, true),
    [scopeStateId]
  );
  const fetchClassLevels = useCallback(() => masterDataService.getClassLevels(true), []);
  const fetchSubjects = useCallback(() => masterDataService.getSubjects(true), []);

  // ClassLevel-only extra field (Part B) -- a Subject multi-select, narrowly scoped via
  // MasterDataTable's extraFields mechanism so the other 5 entities' simpler forms are
  // untouched. Reads allSubjects fetched above rather than each row/field re-fetching.
  const classLevelExtraFields: MasterDataExtraField<ClassLevel>[] = useMemo(
    () => [
      {
        key: 'subjectIds',
        label: 'Subjects',
        getRowValue: (row: ClassLevel) => row.subjectIds,
        renderInput: (value: string[], onChange: (next: string[]) => void) => (
          <TypeaheadMultiSelect
            options={allSubjects.map((s) => ({ value: s.id, label: s.name }))}
            selected={value}
            onChange={onChange}
            placeholder="Search subjects..."
            emptyMessage="No subjects available yet."
          />
        ),
      },
    ],
    [allSubjects]
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <nav className="w-full lg:w-52 shrink-0 bg-white p-2 rounded-2xl border border-[#E1DED4] shadow-2xs flex lg:flex-col flex-row flex-wrap gap-1">
        {MASTER_DATA_ENTITIES.map((entity) => {
          const meta = MASTER_DATA_ENTITY_META[entity];
          const Icon = meta.icon;
          return (
            <button
              key={entity}
              type="button"
              onClick={() => setActiveEntity(entity)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                activeEntity === entity
                  ? 'bg-[#143358] text-white shadow-md'
                  : 'text-[#5E6A79] hover:text-[#142030] hover:bg-[#F3F0E6]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex-1 min-w-0 w-full space-y-6">
      {(activeEntity === 'state' || activeEntity === 'city' || activeEntity === 'board') && (
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-[#E1DED4] shadow-2xs">
        <span className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wide">Location scope</span>
        <select
          value={scopeCountryId}
          onChange={(e) => setScopeCountryId(e.target.value)}
          className={selectClassName}
          aria-label="Scope country"
        >
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={scopeStateId}
          onChange={(e) => setScopeStateId(e.target.value)}
          className={selectClassName}
          disabled={!scopeCountryId}
          aria-label="Scope state"
        >
          <option value="">All states / National</option>
          {statesInScope.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      )}

      {activeEntity === 'country' && (
      <MasterDataTable<Country, masterDataService.CreateCountryRequest, masterDataService.UpdateCountryRequest>
        entityLabel="Country"
        fetchAll={fetchCountries}
        create={masterDataService.createCountry}
        update={masterDataService.updateCountry}
        deleteFn={masterDataService.deleteCountry}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'isoCode', label: 'ISO Code' },
        ]}
        fields={[
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'isoCode', label: 'ISO Code', type: 'text' },
        ]}
        defaultFormValues={{ name: '', isoCode: '' }}
        buildCreatePayload={(v) => ({ name: v.name, isoCode: v.isoCode })}
        buildUpdatePayload={(_row, isActive, v) => ({ name: v.name, isoCode: v.isoCode, isActive })}
      />
      )}

      {activeEntity === 'state' && (
      <MasterDataTable<State, masterDataService.CreateStateRequest, masterDataService.UpdateStateRequest>
        entityLabel="State"
        fetchAll={fetchStates}
        create={masterDataService.createState}
        update={masterDataService.updateState}
        deleteFn={masterDataService.deleteState}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'code', label: 'Code' },
        ]}
        fields={[
          { key: 'countryId', label: 'Country', type: 'select', options: countryOptions },
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'code', label: 'Code', type: 'text' },
        ]}
        defaultFormValues={{ countryId: scopeCountryId, name: '', code: '' }}
        buildCreatePayload={(v) => ({ countryId: v.countryId, name: v.name, code: v.code })}
        buildUpdatePayload={(_row, isActive, v) => ({ countryId: v.countryId, name: v.name, code: v.code, isActive })}
        disableCreate={!scopeCountryId}
      />
      )}

      {activeEntity === 'city' && (
      <MasterDataTable<City, masterDataService.CreateCityRequest, masterDataService.UpdateCityRequest>
        entityLabel="City"
        fetchAll={fetchCities}
        create={masterDataService.createCity}
        update={masterDataService.updateCity}
        deleteFn={masterDataService.deleteCity}
        columns={[{ key: 'name', label: 'Name' }]}
        fields={[
          { key: 'stateId', label: 'State', type: 'select', options: stateOptions },
          { key: 'name', label: 'Name', type: 'text' },
        ]}
        defaultFormValues={{ stateId: scopeStateId, name: '' }}
        buildCreatePayload={(v) => ({ stateId: v.stateId, name: v.name })}
        buildUpdatePayload={(_row, isActive, v) => ({ stateId: v.stateId, name: v.name, isActive })}
        disableCreate={!scopeStateId}
      />
      )}

      {activeEntity === 'board' && (
      <MasterDataTable<Board, masterDataService.CreateBoardRequest, masterDataService.UpdateBoardRequest>
        entityLabel="Board"
        fetchAll={fetchBoards}
        create={masterDataService.createBoard}
        update={masterDataService.updateBoard}
        deleteFn={masterDataService.deleteBoard}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'code', label: 'Code' },
          {
            key: 'scope',
            label: 'Scope',
            render: (row) => (row.stateId ? stateOptions.find((s) => s.value === row.stateId)?.label || 'State' : 'National'),
          },
        ]}
        fields={[
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'code', label: 'Code', type: 'text' },
          { key: 'stateId', label: 'State (optional -- national board if blank)', type: 'select', options: stateOptions, optional: true },
        ]}
        defaultFormValues={{ name: '', code: '', stateId: '' }}
        buildCreatePayload={(v) => ({ name: v.name, code: v.code, stateId: v.stateId || null })}
        buildUpdatePayload={(_row, isActive, v) => ({ name: v.name, code: v.code, stateId: v.stateId || null, isActive })}
      />
      )}

      {activeEntity === 'classlevel' && (
      <MasterDataTable<ClassLevel, masterDataService.CreateClassLevelRequest, masterDataService.UpdateClassLevelRequest>
        entityLabel="Class Level"
        fetchAll={fetchClassLevels}
        create={masterDataService.createClassLevel}
        update={masterDataService.updateClassLevel}
        deleteFn={masterDataService.deleteClassLevel}
        columns={[{ key: 'name', label: 'Name' }]}
        fields={[{ key: 'name', label: 'Name', type: 'text' }]}
        defaultFormValues={{ name: '' }}
        extraFields={classLevelExtraFields}
        defaultExtraFormValues={{ subjectIds: [] }}
        // SortOrder is no longer a user-editable field (hidden from both the grid and the
        // Add/Edit form per the admin request), but the backend's Create/UpdateClassLevelRequest
        // still requires it -- send a silent default. New rows get `rowCount` (the number of
        // ClassLevel rows already loaded, includeInactive=true) so they sort after every
        // existing class level rather than all colliding at 0; edits simply echo the row's
        // current sortOrder back unchanged since there's no field to have edited it.
        buildCreatePayload={(v, extra, rowCount) => ({
          name: v.name,
          sortOrder: rowCount,
          subjectIds: extra.subjectIds ?? [],
        })}
        buildUpdatePayload={(row, isActive, v, extra) => ({
          name: v.name,
          sortOrder: row.sortOrder,
          isActive,
          subjectIds: extra.subjectIds ?? row.subjectIds,
        })}
      />
      )}

      {activeEntity === 'subject' && (
      <MasterDataTable<Subject, masterDataService.CreateSubjectRequest, masterDataService.UpdateSubjectRequest>
        entityLabel="Subject"
        fetchAll={fetchSubjects}
        create={masterDataService.createSubject}
        update={masterDataService.updateSubject}
        deleteFn={masterDataService.deleteSubject}
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'stream', label: 'Stream', render: (row) => row.stream || '—' },
        ]}
        fields={[
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'stream', label: 'Stream (optional)', type: 'text', optional: true },
        ]}
        defaultFormValues={{ name: '', stream: '' }}
        buildCreatePayload={(v) => ({ name: v.name, stream: v.stream || null })}
        buildUpdatePayload={(_row, isActive, v) => ({ name: v.name, stream: v.stream || null, isActive })}
      />
      )}
      </div>
    </div>
  );
};

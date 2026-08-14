import React, { useCallback, useState } from 'react';
import { MasterDataTable } from '../MasterDataTable';
import * as tagsService from '../../../services/tagsService';
import type { CreateTagRequest, Tag, UpdateTagRequest } from '../../../services/tagsService';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

// Keystrokes narrower than this apart are collapsed into one fetchAll identity change --
// otherwise every character typed re-triggers MasterDataTable's load() (see below) and flashes
// the whole table to its "Loading..." row (review finding, 2026-08-11 review).
const SEARCH_DEBOUNCE_MS = 250;

const searchInputClassName =
  'w-full sm:w-72 px-3 py-2 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012]';

// Story 1.9 live-wire: reads/writes the real /api/v1/tags endpoints instead of Story 1.3's mock
// closures, behind the exact same MasterDataTable-compatible fetchAll/create/update shape --
// MasterDataTable and this component's JSX don't change (this file's own header comment named
// this as the swap point when it was still mock-backed).
//
// MasterDataTable has no built-in search -- fetchAll's identity changing (via useCallback keyed
// on debouncedSearchQuery below) is what re-triggers its internal load(), since load is itself a
// useCallback keyed on [fetchAll] with a useEffect keyed on [load]. There is still no server-side
// search endpoint (Story 1.9 Dev Notes: MasterDataTable's fetchAll takes no search parameter to
// plumb one through), so fetchAll fetches the full list on every debounced query change and
// filters it client-side, same as the mock did over its in-memory array.
//
// No more nextIdRef/tagsRef -- tag ids are server-assigned now (removing the client-side ref
// entirely, not just leaving it unused, is what actually closes the id-collision risk Story 1.3's
// review named as this story's job); MasterDataTable already owns its own `rows` state from each
// create()/update() call's own return value, so there's nothing left here to keep in sync.
export const TagManagement: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS);

  const fetchAll = useCallback(async () => {
    const all = await tagsService.getTags();
    const query = debouncedSearchQuery.trim().toLowerCase();
    return query ? all.filter((tag) => tag.name.toLowerCase().includes(query)) : all;
  }, [debouncedSearchQuery]);

  const create = useCallback((data: CreateTagRequest): Promise<Tag> => tagsService.createTag(data), []);

  const update = useCallback(
    (id: string, data: UpdateTagRequest): Promise<Tag> => tagsService.updateTag(id, data),
    []
  );

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search tags..."
        aria-label="Search tags"
        className={searchInputClassName}
      />
      <MasterDataTable<Tag, CreateTagRequest, UpdateTagRequest>
        entityLabel="Tag"
        fetchAll={fetchAll}
        create={create}
        update={update}
        columns={[{ key: 'name', label: 'Name' }]}
        fields={[{ key: 'name', label: 'Name', type: 'text' }]}
        defaultFormValues={{ name: '' }}
        buildCreatePayload={(v) => ({ name: v.name })}
        buildUpdatePayload={(_row, isActive, v) => ({ name: v.name, isActive })}
      />
    </div>
  );
};

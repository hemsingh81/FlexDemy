import React, { useCallback, useEffect, useId, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { ToggleSwitch } from '../../ui/ToggleSwitch';
import { Alert } from '../../ui/Alert';
import { SidePanel } from '../../ui/SidePanel';
import { Button } from '../../ui/Button';
import { FieldsGrid, getRequiredFieldErrors, type FormField } from '../../ui/FormCard';
import { useToast } from '../../context/ToastContext';

// Generic Master-data admin table (plan §5 item 5) -- reused once per entity from
// MasterDataManager.tsx. Safe to genuinely generalize on the frontend since, unlike the
// backend's 6 separate vertical slices, there's no per-entity validation variance here: just
// "list + add form + active/inactive toggle + delete (+ an optional entity-specific extra
// field, e.g. ClassLevel's Subject multi-select)" for every entity.
export interface MasterDataColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

// Alias for FormField (ui/FormCard.tsx) -- kept under this entity-scoped name since every
// MasterDataManager.tsx config and this file's own props already read as "MasterData...".
export type MasterDataFormField = FormField;

// Narrowly-scoped escape hatch (plan Part B) for the one entity (ClassLevel) that needs a
// field the other 5 don't -- a Subject multi-select -- without teaching this generic
// component anything about subjects. `renderInput` is supplied by the caller (so it can reach
// masterDataService.getSubjects() itself); this component only threads string[] state through
// it for the Add form and the per-row "edit this field" panel.
export interface MasterDataExtraField<T> {
  key: string;
  label: string;
  renderInput: (value: string[], onChange: (next: string[]) => void) => React.ReactNode;
  getRowValue: (row: T) => string[];
}

interface MasterDataTableProps<T extends { id: string; isActive: boolean }, TCreate, TUpdate> {
  entityLabel: string;
  fetchAll: () => Promise<T[]>;
  create: (data: TCreate) => Promise<T>;
  update: (id: string, data: TUpdate) => Promise<T>;
  // Optional: gated per-entity in MasterDataManager.tsx by the same masterdata.manage policy
  // as create/update. Omit to leave an entity without delete (none currently do, but keeps
  // the prop honest as optional rather than a lie).
  deleteFn?: (id: string) => Promise<void>;
  columns: MasterDataColumn<T>[];
  fields: MasterDataFormField[];
  defaultFormValues: Record<string, string>;
  // `rowCount` is the number of rows currently loaded in this table at the moment Add is
  // submitted -- exposed so an entity whose backend DTO still requires a field the UI no
  // longer surfaces (e.g. ClassLevel's SortOrder, see MasterDataManager.tsx) can derive a
  // sensible silent default instead of hardcoding one.
  buildCreatePayload: (
    values: Record<string, string>,
    extraValues: Record<string, string[]>,
    rowCount: number
  ) => TCreate;
  // `values` carries the edited base fields (Name/Code/SortOrder/etc, prefilled from the row
  // and editable in the Edit panel) -- NOT the stale original `row`, so an edit to e.g. a
  // Country's Name actually persists. The Active/Inactive quick-toggle passes the row's
  // current field values back in unchanged (see rowFieldValues), so toggling never clobbers
  // other fields with a stale snapshot either.
  buildUpdatePayload: (row: T, isActive: boolean, values: Record<string, string>, extraValues: Record<string, string[]>) => TUpdate;
  // ClassLevel-only today (plan Part B) -- see MasterDataExtraField above.
  extraFields?: MasterDataExtraField<T>[];
  defaultExtraFormValues?: Record<string, string[]>;
  // Rendered above the table (Country/State selectors for State/City/Board) -- purely
  // presentational here, the actual scoping lives in `fetchAll`'s closure.
  parentSelector?: React.ReactNode;
  disableCreate?: boolean;
}

// Row-exit animation duration (plan Part C: local, self-contained transition, not the shared
// fade system another task owns). Matches Navbar.tsx dropdowns' `duration-150`-ish feel while
// giving the opacity/scale collapse enough time to read as intentional.
const ROW_EXIT_MS = 200;

interface MasterDataTableRowProps<T extends { id: string; isActive: boolean }> {
  row: T;
  columns: MasterDataColumn<T>[];
  entityLabel: string;
  isExiting: boolean;
  isConfirmingDelete: boolean;
  isToggling: boolean;
  isDeleting: boolean;
  isBusy: boolean;
  canDelete: boolean;
  onToggleActive: (row: T) => void;
  onEdit: (row: T) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (row: T) => void;
  onCancelDelete: () => void;
}

// Extracted out of the `rows.map(...)` below (plan/audit item 3) and wrapped in React.memo --
// this table can hold dozens of rows (Board's 34, per the scroll-container comment above), and
// without this split, opening a single row's Edit panel or toggling one row's Active state
// re-renders the JSX for every OTHER row too (the whole `rows.map` re-runs on any state change
// in the parent). Memoizing means an unrelated row only re-renders when its own props actually
// change -- which is why every callback prop below is itself a useCallback in the parent (a
// non-memoized inline callback would defeat this by giving React.memo a "changed" prop on every
// render regardless).
//
// Generic components can't be passed directly to React.memo (memo's return type erases the type
// parameter) -- the `as typeof MasterDataTableRowInner` cast is the standard workaround, keeping
// this component's own call sites fully generic over T.
function MasterDataTableRowInner<T extends { id: string; isActive: boolean }>({
  row,
  columns,
  entityLabel,
  isExiting,
  isConfirmingDelete,
  isToggling,
  isDeleting,
  isBusy,
  canDelete,
  onToggleActive,
  onEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: MasterDataTableRowProps<T>) {
  return (
    <tr
      className={`border-t border-[#E1DED4] transition-all duration-200 ${
        isExiting ? 'opacity-0 scale-[0.98]' : 'opacity-100 scale-100'
      }`}
    >
      {columns.map((col) => (
        <td key={col.key} className="px-4 py-2.5 text-[#142030]">
          {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
        </td>
      ))}
      <td className="px-4 py-2.5">
        {isConfirmingDelete ? (
          <ConfirmDialog
            message="Really delete?"
            variant="danger"
            isConfirming={isDeleting}
            onConfirm={() => onConfirmDelete(row)}
            onCancel={onCancelDelete}
          />
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleActive(row)}
              disabled={isToggling}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50 ${
                row.isActive ? 'bg-[#179765]/15 text-[#179765]' : 'bg-red-100 text-red-600'
              }`}
            >
              {row.isActive ? 'Active' : 'Inactive'}
            </button>
            <button
              type="button"
              onClick={() => onEdit(row)}
              disabled={isBusy}
              aria-label={`Edit ${entityLabel}`}
              className="p-1.5 rounded-lg text-[#5E6A79] hover:text-[#143358] hover:bg-[#F3F0E6] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {canDelete && (
              <button
                type="button"
                onClick={() => onRequestDelete(row.id)}
                disabled={isBusy}
                aria-label={`Delete ${entityLabel}`}
                className="p-1.5 rounded-lg text-[#5E6A79] hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// The plain `as typeof MasterDataTableRowInner` cast loses `key` support (React.memo's return
// type doesn't preserve T, and a bare generic-function type isn't recognized by the JSX checker
// as something LibraryManagedAttributes should intersect with `{ key?: Key }`) -- explicitly
// including `key` in the cast target's call signature keeps `<MasterDataTableRow key={row.id} ...
// />` below type-checking correctly while still being generic over T.
const MasterDataTableRow = React.memo(MasterDataTableRowInner) as <T extends { id: string; isActive: boolean }>(
  props: MasterDataTableRowProps<T> & { key?: React.Key }
) => React.ReactElement | null;

export function MasterDataTable<T extends { id: string; isActive: boolean }, TCreate, TUpdate>({
  entityLabel,
  fetchAll,
  create,
  update,
  deleteFn,
  columns,
  fields,
  defaultFormValues,
  buildCreatePayload,
  buildUpdatePayload,
  extraFields,
  defaultExtraFormValues,
  parentSelector,
  disableCreate,
}: MasterDataTableProps<T, TCreate, TUpdate>) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>(defaultFormValues);
  const [extraFormValues, setExtraFormValues] = useState<Record<string, string[]>>(defaultExtraFormValues ?? {});
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, boolean>>({});
  // Add-form Active/Inactive choice. Every entity's CreateXRequest has no isActive field
  // (backend convention: new rows are always created Active, see masterDataService.ts) --
  // choosing Inactive here just means "create, then immediately follow up with an update that
  // flips it off" (see handleCreate) rather than teaching every create endpoint a field it
  // doesn't have.
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  // Split by context (rather than one shared `error`) so each error renders right where the
  // user is looking: formError inside the Add card, editError inside whichever row's Edit card
  // is open, rowActionError in the table-level banner for toggle/delete (no card of their own).
  const [formError, setFormError] = useState('');
  const [editError, setEditError] = useState('');
  const [rowActionError, setRowActionError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const formIdPrefix = useId();
  const editFormId = `${formIdPrefix}-edit-form`;

  // Per-row edit panel -- base fields (Name/Code/SortOrder/etc, every entity) plus any
  // entity-specific extra field (e.g. ClassLevel's Subject multi-select) plus the Active switch.
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editFieldValues, setEditFieldValues] = useState<Record<string, string>>({});
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, boolean>>({});
  const [editExtraValues, setEditExtraValues] = useState<Record<string, string[]>>({});
  const [editIsActive, setEditIsActive] = useState(true);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete goes through a confirm-then-call-then-remove step (no browser confirm()) -- see
  // ui/ConfirmDialog.tsx. The Active/Inactive quick-toggle stays a direct one-tap flip (see
  // ui/ToggleSwitch.tsx's doc comment -- that's specifically for forms, not this row control).
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());

  // While the Add form is open, a row is being edited, or a row's Delete confirm is showing,
  // every OTHER action in this table is locked out -- one window/operation open at a time, so
  // an in-flight edit (or its unsaved changes) can never be clobbered by starting a second one
  // elsewhere in the same table.
  const isBusy = isFormOpen || editingRowId !== null || confirmDeleteId !== null;

  const load = useCallback(() => {
    setIsLoading(true);
    fetchAll()
      .then((r) => {
        setRows(r);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [fetchAll]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setFormValues(defaultFormValues);
    setExtraFormValues(defaultExtraFormValues ?? {});
    setFormFieldErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(defaultFormValues)]);

  // Every extra field's current value for a row -- feeds buildUpdatePayload on the quick
  // Active/Inactive toggle so that toggle never silently wipes out e.g. a ClassLevel's
  // subjectIds (the backend's UpdateClassLevelRequest is a full replace).
  const rowExtraValues = useCallback(
    (row: T): Record<string, string[]> => {
      const result: Record<string, string[]> = {};
      (extraFields ?? []).forEach((f) => {
        result[f.key] = f.getRowValue(row);
      });
      return result;
    },
    [extraFields]
  );

  // Base-field values (Name/Code/SortOrder/etc) read straight off the row, keyed the same as
  // `fields`/`columns` -- every entity's `fields[].key` matches its row property name (see
  // MasterDataManager.tsx's 6 configs), same convention the column renderer already relies on.
  const rowFieldValues = useCallback(
    (row: T): Record<string, string> => {
      const result: Record<string, string> = {};
      fields.forEach((f) => {
        const value = (row as Record<string, unknown>)[f.key];
        result[f.key] = value === null || value === undefined ? '' : String(value);
      });
      return result;
    },
    [fields]
  );

  // Shared by the toolbar's Cancel toggle, the Add card's header X, and its footer Cancel --
  // one place resets isFormOpen/formValues/extraFormValues/formIsActive/formFieldErrors so
  // "closing the Add panel" always means the same thing no matter which control triggered it.
  const closeAddForm = useCallback(() => {
    setIsFormOpen(false);
    setFormValues(defaultFormValues);
    setExtraFormValues(defaultExtraFormValues ?? {});
    setFormIsActive(true);
    setFormFieldErrors({});
    setFormError('');
  }, [defaultFormValues, defaultExtraFormValues]);

  const openAddForm = () => {
    setFormError('');
    setIsFormOpen(true);
  };

  const handleFormFieldChange = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    // Clear this field's error the moment it's fixed, not just on the next submit attempt.
    if (value.trim()) {
      setFormFieldErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleEditFieldChange = (key: string, value: string) => {
    setEditFieldValues((prev) => ({ ...prev, [key]: value }));
    if (value.trim()) {
      setEditFieldErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const requiredErrors = getRequiredFieldErrors(fields, formValues);
    if (Object.keys(requiredErrors).length > 0) {
      setFormFieldErrors(requiredErrors);
      setFormError('Please fill in all required fields.');
      return;
    }
    setFormFieldErrors({});
    setFormError('');
    setIsSaving(true);
    try {
      const created = await create(buildCreatePayload(formValues, extraFormValues, rows.length));
      // Append locally from the API's own response rather than calling load() (a full
      // fetchAll() + isLoading flip) -- that used to swap the whole table body out to a
      // "Loading..." row and back on every single Add, reading as a flicker.
      const finalRow = formIsActive
        ? created
        : await update(created.id, buildUpdatePayload(created, false, formValues, extraFormValues));
      setRows((prev) => [...prev, finalRow]);
      closeAddForm();
      showToast({ message: `${entityLabel} created.`, variant: 'success' });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // useCallback (not a plain function) so this identity stays stable across renders that don't
  // actually touch it -- MasterDataTableRow is React.memo'd specifically so an unrelated row's
  // re-render is skippable, which only works if the callback props it receives aren't a fresh
  // closure every render.
  const handleToggleActive = useCallback(
    async (row: T) => {
      setTogglingId(row.id);
      setRowActionError('');
      try {
        const updated = await update(row.id, buildUpdatePayload(row, !row.isActive, rowFieldValues(row), rowExtraValues(row)));
        // Patch just this row locally (from the API's own response) instead of calling load() --
        // a full fetchAll()+isLoading reload on every toggle swapped the entire table body out to
        // a "Loading..." row and back, which is what read as flickering.
        setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
        showToast({ message: `${entityLabel} ${updated.isActive ? 'activated' : 'deactivated'}.`, variant: 'success' });
      } catch (err) {
        setRowActionError(err instanceof Error ? err.message : 'Unable to update status. Please try again.');
      } finally {
        setTogglingId(null);
      }
    },
    [update, buildUpdatePayload, rowFieldValues, rowExtraValues, entityLabel, showToast]
  );

  const openEdit = useCallback(
    (row: T) => {
      setEditError('');
      setEditingRowId(row.id);
      setEditFieldValues(rowFieldValues(row));
      setEditExtraValues(rowExtraValues(row));
      setEditIsActive(row.isActive);
      setEditFieldErrors({});
    },
    [rowFieldValues, rowExtraValues]
  );

  const closeEdit = () => {
    setEditingRowId(null);
    setEditFieldErrors({});
    setEditError('');
  };

  const handleSaveEdit = async (row: T) => {
    const requiredErrors = getRequiredFieldErrors(fields, editFieldValues);
    if (Object.keys(requiredErrors).length > 0) {
      setEditFieldErrors(requiredErrors);
      setEditError('Please fill in all required fields.');
      return;
    }
    setEditFieldErrors({});
    setIsSavingEdit(true);
    setEditError('');
    try {
      const updated = await update(row.id, buildUpdatePayload(row, editIsActive, editFieldValues, editExtraValues));
      // Same local patch as the toggle above -- avoids the full-table flicker on every save.
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      closeEdit();
      showToast({ message: `${entityLabel} updated.`, variant: 'success' });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to save changes. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = useCallback(
    async (row: T) => {
      if (!deleteFn) return;
      setDeletingId(row.id);
      setRowActionError('');
      try {
        await deleteFn(row.id);
        setConfirmDeleteId(null);
        setDeletingId(null);
        showToast({ message: `${entityLabel} deleted.`, variant: 'success' });
        // Collapse-and-remove: mark exiting so the row transitions out, then drop it from
        // local state once the transition has had time to play (plan Part C -- self-contained
        // CSS transition, not the shared page-fade system another task owns).
        setExitingIds((prev) => new Set(prev).add(row.id));
        setTimeout(() => {
          setRows((prev) => prev.filter((r) => r.id !== row.id));
          setExitingIds((prev) => {
            const next = new Set(prev);
            next.delete(row.id);
            return next;
          });
        }, ROW_EXIT_MS);
      } catch (err) {
        setRowActionError(err instanceof Error ? err.message : 'Unable to delete. Please try again.');
        setDeletingId(null);
      }
    },
    [deleteFn, entityLabel, showToast]
  );

  const requestDelete = useCallback((id: string) => setConfirmDeleteId(id), []);
  const cancelDelete = useCallback(() => setConfirmDeleteId(null), []);

  const editingRow = rows.find((r) => r.id === editingRowId) ?? null;

  return (
    <div className="bg-white border border-[#E1DED4] rounded-2xl shadow-2xs overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-[#E1DED4]">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-bold text-[#142030]">{entityLabel}</h3>
          {parentSelector}
        </div>
        <button
          type="button"
          onClick={() => (isFormOpen ? closeAddForm() : openAddForm())}
          disabled={disableCreate || (isBusy && !isFormOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#BA5012] text-white shadow-md shadow-[#BA5012]/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isFormOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          <span>{isFormOpen ? 'Cancel' : `Add ${entityLabel}`}</span>
        </button>
      </div>

      {isFormOpen && (
        <SidePanel
          title={`Add ${entityLabel}`}
          onClose={closeAddForm}
          closeOnBackdropClick={false}
          footer={({ requestClose }) => (
            <>
              <Button variant="ghost" size="sm" type="button" onClick={requestClose}>
                Cancel
              </Button>
              <Button variant="secondary" size="sm" type="submit" form={`${formIdPrefix}-add-form`} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        >
          <form id={`${formIdPrefix}-add-form`} onSubmit={handleCreate} className="space-y-3">
            {formError && <Alert variant="danger">{formError}</Alert>}
            <FieldsGrid
              fields={fields}
              values={formValues}
              errors={formFieldErrors}
              idPrefix={formIdPrefix}
              onChange={handleFormFieldChange}
            />

            {(extraFields ?? []).map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="block text-xs font-semibold text-[#142030]">{f.label}</label>
                {f.renderInput(extraFormValues[f.key] ?? [], (next) =>
                  setExtraFormValues((prev) => ({ ...prev, [f.key]: next }))
                )}
              </div>
            ))}

            <ToggleSwitch
              checked={formIsActive}
              onChange={setFormIsActive}
              id={`${formIdPrefix}-active`}
              ariaLabel={`${entityLabel} status`}
            />
          </form>
        </SidePanel>
      )}

      {rowActionError && (
        <div className="px-4 pt-3">
          <Alert variant="danger">{rowActionError}</Alert>
        </div>
      )}

      {/* Fills the available viewport space below the table (Navbar + page padding + this
          table's own toolbar/AdminPanel chrome above it) instead of a flat 28rem cap that left a
          large empty gap under short grids (State/Class Level/Subject etc, wherever this table is
          the last thing on the page). 100dvh (not 100vh) so mobile browser chrome collapsing
          doesn't leave a stale, too-tall value; min-h-64 is a floor so very short viewports never
          get an unusably cramped scroll box; the table still scrolls internally past that point
          rather than growing the whole page (Board's 34 rows, etc). Scales automatically with any
          viewport height/resize -- no per-breakpoint tuning needed. */}
      <div className="overflow-auto max-h-[calc(100dvh-22rem)] min-h-64">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-wide text-[#5E6A79]">
              {columns.map((col) => (
                <th key={col.key} className="sticky top-0 z-10 px-4 py-2 bg-[#F3F0E6] shadow-[0_1px_0_0_#E1DED4]">
                  {col.label}
                </th>
              ))}
              <th className="sticky top-0 z-10 px-4 py-2 bg-[#F3F0E6] shadow-[0_1px_0_0_#E1DED4]">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-[#5E6A79]">
                  <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-[#5E6A79]">
                  No {entityLabel.toLowerCase()} records yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <MasterDataTableRow
                  key={row.id}
                  row={row}
                  columns={columns}
                  entityLabel={entityLabel}
                  isExiting={exitingIds.has(row.id)}
                  isConfirmingDelete={confirmDeleteId === row.id}
                  isToggling={togglingId === row.id}
                  isDeleting={deletingId === row.id}
                  isBusy={isBusy}
                  canDelete={Boolean(deleteFn)}
                  onToggleActive={handleToggleActive}
                  onEdit={openEdit}
                  onRequestDelete={requestDelete}
                  onConfirmDelete={handleDelete}
                  onCancelDelete={cancelDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {editingRow && (
        <SidePanel
          title={`Edit ${entityLabel}`}
          onClose={closeEdit}
          closeOnBackdropClick={false}
          footer={({ requestClose }) => (
            <>
              <Button variant="ghost" size="sm" type="button" onClick={requestClose}>
                Cancel
              </Button>
              <Button variant="secondary" size="sm" type="submit" form={editFormId} disabled={isSavingEdit}>
                {isSavingEdit ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
        >
          <form
            id={editFormId}
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveEdit(editingRow);
            }}
            className="space-y-3"
          >
            {editError && <Alert variant="danger">{editError}</Alert>}
            <FieldsGrid
              fields={fields}
              values={editFieldValues}
              errors={editFieldErrors}
              idPrefix={`${formIdPrefix}-edit`}
              onChange={handleEditFieldChange}
            />

            {(extraFields ?? []).map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="block text-xs font-semibold text-[#142030]">{f.label}</label>
                {f.renderInput(editExtraValues[f.key] ?? [], (next) =>
                  setEditExtraValues((prev) => ({ ...prev, [f.key]: next }))
                )}
              </div>
            ))}

            <ToggleSwitch
              checked={editIsActive}
              onChange={setEditIsActive}
              id={`${formIdPrefix}-edit-active`}
              ariaLabel={`${entityLabel} status`}
            />
          </form>
        </SidePanel>
      )}
    </div>
  );
}

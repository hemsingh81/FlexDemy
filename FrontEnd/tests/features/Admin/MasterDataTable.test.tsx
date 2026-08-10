import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MasterDataTable, type MasterDataExtraField } from '@/src/features/Admin/MasterDataTable';
import { ToastProvider } from '@/src/context/ToastContext';

interface Country {
  id: string;
  name: string;
  isoCode: string;
  isActive: boolean;
}

interface ClassLevel {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  subjectIds: string[];
}

const countries: Country[] = [
  { id: 'ctry_1', name: 'India', isoCode: 'IN', isActive: true },
  { id: 'ctry_2', name: 'Nepal', isoCode: 'NP', isActive: false },
];

describe('MasterDataTable', () => {
  it('renders rows returned by fetchAll, with their columns and Active/Inactive status', async () => {
    const fetchAll = vi.fn().mockResolvedValue(countries);

    render(
      <MasterDataTable<Country, { name: string; isoCode: string }, { name: string; isoCode: string; isActive: boolean }>
        entityLabel="Country"
        fetchAll={fetchAll}
        create={vi.fn()}
        update={vi.fn()}
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
        buildUpdatePayload={(row, isActive) => ({ name: row.name, isoCode: row.isoCode, isActive })}
      />
    );

    expect(await screen.findByText('India')).toBeInTheDocument();
    expect(screen.getByText('Nepal')).toBeInTheDocument();
    // Scoped to the status-toggle pill buttons specifically -- the Add-form and per-row Edit
    // panel's ToggleSwitch controls (always mounted for the Collapse open/close animation --
    // see docs/FRONTEND_TRANSITIONS.md) also render "Active"/"Inactive" text, but as a <span>
    // with role="switch" on their own button, not role="button".
    expect(screen.getByRole('button', { name: 'Active' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inactive' })).toBeInTheDocument();
    expect(fetchAll).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state when fetchAll resolves with no rows', async () => {
    render(
      <MasterDataTable<Country, { name: string; isoCode: string }, { name: string; isoCode: string; isActive: boolean }>
        entityLabel="Country"
        fetchAll={vi.fn().mockResolvedValue([])}
        create={vi.fn()}
        update={vi.fn()}
        columns={[{ key: 'name', label: 'Name' }]}
        fields={[{ key: 'name', label: 'Name', type: 'text' }]}
        defaultFormValues={{ name: '' }}
        buildCreatePayload={(v) => ({ name: v.name, isoCode: '' })}
        buildUpdatePayload={(row, isActive) => ({ name: row.name, isoCode: '', isActive })}
      />
    );

    expect(await screen.findByText('No country records yet.')).toBeInTheDocument();
  });

  it('clicking the status toggle calls update with the row id and flipped isActive, and patches the row locally without a flickering full reload', async () => {
    const fetchAll = vi.fn().mockResolvedValue(countries);
    const update = vi.fn().mockResolvedValue({ ...countries[0], isActive: false });
    const uiUser = userEvent.setup();

    render(
      <MasterDataTable<Country, { name: string; isoCode: string }, { name: string; isoCode: string; isActive: boolean }>
        entityLabel="Country"
        fetchAll={fetchAll}
        create={vi.fn()}
        update={update}
        columns={[{ key: 'name', label: 'Name' }]}
        fields={[{ key: 'name', label: 'Name', type: 'text' }]}
        defaultFormValues={{ name: '' }}
        buildCreatePayload={(v) => ({ name: v.name, isoCode: '' })}
        buildUpdatePayload={(row, isActive) => ({ name: row.name, isoCode: row.isoCode, isActive })}
      />
    );

    await screen.findByText('India');
    // Scoped to India's row specifically -- Nepal starts Inactive too, so an unscoped
    // getByRole('button', { name: 'Inactive' }) would match both rows once India flips.
    const indiaRow = screen.getByText('India').closest('tr') as HTMLElement;
    const activeToggle = within(indiaRow).getByRole('button', { name: 'Active' });
    await uiUser.click(activeToggle);

    expect(update).toHaveBeenCalledWith('ctry_1', { name: 'India', isoCode: 'IN', isActive: false });
    // The row flips to Inactive from update()'s own returned entity -- no second fetchAll(), no
    // "Loading..." flash. Calling load() here used to swap the whole table body out and back on
    // every toggle, which read as flickering.
    await waitFor(() => expect(within(indiaRow).getByRole('button', { name: 'Inactive' })).toBeInTheDocument());
    expect(fetchAll).toHaveBeenCalledTimes(1);
  });

  it('opening the Add form, filling it in, and submitting calls create with the built payload', async () => {
    const fetchAll = vi.fn().mockResolvedValue([]);
    const create = vi.fn().mockResolvedValue({ id: 'ctry_3', name: 'Bhutan', isoCode: 'BT', isActive: true });
    const uiUser = userEvent.setup();

    render(
      <MasterDataTable<Country, { name: string; isoCode: string }, { name: string; isoCode: string; isActive: boolean }>
        entityLabel="Country"
        fetchAll={fetchAll}
        create={create}
        update={vi.fn()}
        columns={[{ key: 'name', label: 'Name' }]}
        fields={[
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'isoCode', label: 'ISO Code', type: 'text' },
        ]}
        defaultFormValues={{ name: '', isoCode: '' }}
        buildCreatePayload={(v) => ({ name: v.name, isoCode: v.isoCode })}
        buildUpdatePayload={(row, isActive) => ({ name: row.name, isoCode: row.isoCode, isActive })}
      />
    );

    await screen.findByText('No country records yet.');
    await uiUser.click(screen.getByRole('button', { name: 'Add Country' }));

    await uiUser.type(screen.getByLabelText('Name'), 'Bhutan');
    await uiUser.type(screen.getByLabelText('ISO Code'), 'BT');
    await uiUser.click(screen.getByText('Save'));

    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Bhutan', isoCode: 'BT' }));
  });

  it('shows a success toast (via ToastProvider) after a create succeeds', async () => {
    const fetchAll = vi.fn().mockResolvedValue([]);
    const create = vi.fn().mockResolvedValue({ id: 'ctry_3', name: 'Bhutan', isoCode: 'BT', isActive: true });
    const uiUser = userEvent.setup();

    render(
      <ToastProvider>
        <MasterDataTable<Country, { name: string; isoCode: string }, { name: string; isoCode: string; isActive: boolean }>
          entityLabel="Country"
          fetchAll={fetchAll}
          create={create}
          update={vi.fn()}
          columns={[{ key: 'name', label: 'Name' }]}
          fields={[
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'isoCode', label: 'ISO Code', type: 'text' },
          ]}
          defaultFormValues={{ name: '', isoCode: '' }}
          buildCreatePayload={(v) => ({ name: v.name, isoCode: v.isoCode })}
          buildUpdatePayload={(row, isActive) => ({ name: row.name, isoCode: row.isoCode, isActive })}
        />
      </ToastProvider>
    );

    await screen.findByText('No country records yet.');
    await uiUser.click(screen.getByRole('button', { name: 'Add Country' }));
    await uiUser.type(screen.getByLabelText('Name'), 'Bhutan');
    await uiUser.type(screen.getByLabelText('ISO Code'), 'BT');
    await uiUser.click(screen.getByText('Save'));

    expect(await screen.findByText('Country created.')).toBeInTheDocument();
  });

  describe('required-field validation', () => {
    it('marks required fields with a visible asterisk, and optional fields without one', async () => {
      const uiUser = userEvent.setup();

      render(
        <MasterDataTable<Country, { name: string; isoCode: string }, { name: string; isoCode: string; isActive: boolean }>
          entityLabel="Country"
          fetchAll={vi.fn().mockResolvedValue([])}
          create={vi.fn()}
          update={vi.fn()}
          columns={[{ key: 'name', label: 'Name' }]}
          fields={[
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'isoCode', label: 'ISO Code (optional)', type: 'text', optional: true },
          ]}
          defaultFormValues={{ name: '', isoCode: '' }}
          buildCreatePayload={(v) => ({ name: v.name, isoCode: v.isoCode })}
          buildUpdatePayload={(row, isActive) => ({ name: row.name, isoCode: row.isoCode, isActive })}
        />
      );

      await screen.findByText('No country records yet.');
      await uiUser.click(screen.getByRole('button', { name: 'Add Country' }));

      // getByLabelText, not getByText, for the inputs themselves -- the table's own column
      // header also renders the literal text "Name". Each field's asterisk lives in the same
      // '.space-y-1' wrapper as its input (see MasterDataTable's FieldsGrid).
      const nameFieldWrapper = screen.getByLabelText('Name').closest('.space-y-1') as HTMLElement;
      const isoFieldWrapper = screen.getByLabelText('ISO Code (optional)').closest('.space-y-1') as HTMLElement;
      expect(within(nameFieldWrapper).getByText('*')).toBeInTheDocument();
      expect(within(isoFieldWrapper).queryByText('*')).not.toBeInTheDocument();
    });

    it('submitting the Add form with a blank required field does not call create and shows an error; filling it in and resubmitting succeeds', async () => {
      const create = vi.fn();
      const uiUser = userEvent.setup();

      render(
        <MasterDataTable<Country, { name: string; isoCode: string }, { name: string; isoCode: string; isActive: boolean }>
          entityLabel="Country"
          fetchAll={vi.fn().mockResolvedValue([])}
          create={create}
          update={vi.fn()}
          columns={[{ key: 'name', label: 'Name' }]}
          fields={[
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'isoCode', label: 'ISO Code', type: 'text' },
          ]}
          defaultFormValues={{ name: '', isoCode: '' }}
          buildCreatePayload={(v) => ({ name: v.name, isoCode: v.isoCode })}
          buildUpdatePayload={(row, isActive) => ({ name: row.name, isoCode: row.isoCode, isActive })}
        />
      );

      await screen.findByText('No country records yet.');
      await uiUser.click(screen.getByRole('button', { name: 'Add Country' }));

      // Leave Name blank, only fill ISO Code.
      await uiUser.type(screen.getByLabelText('ISO Code'), 'BT');
      await uiUser.click(screen.getByText('Save'));

      expect(await screen.findByText('Please fill in all required fields.')).toBeInTheDocument();
      expect(create).not.toHaveBeenCalled();

      // Filling in the blank field clears its error immediately (not just on next submit), and
      // resubmitting now succeeds.
      create.mockResolvedValue({ id: 'ctry_9', name: 'Bhutan', isoCode: 'BT', isActive: true });
      await uiUser.type(screen.getByLabelText('Name'), 'Bhutan');
      await uiUser.click(screen.getByText('Save'));

      await waitFor(() => expect(create).toHaveBeenCalledWith({ name: 'Bhutan', isoCode: 'BT' }));
    });

    it('submitting the Edit panel with a blank required field does not call update and shows an error; correcting it and resubmitting succeeds', async () => {
      const update = vi.fn();
      const uiUser = userEvent.setup();

      render(
        <MasterDataTable<Country, { name: string; isoCode: string }, { name: string; isoCode: string; isActive: boolean }>
          entityLabel="Country"
          fetchAll={vi.fn().mockResolvedValue(countries)}
          create={vi.fn()}
          update={update}
          columns={[{ key: 'name', label: 'Name' }]}
          fields={[
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'isoCode', label: 'ISO Code', type: 'text' },
          ]}
          defaultFormValues={{ name: '', isoCode: '' }}
          buildCreatePayload={(v) => ({ name: v.name, isoCode: v.isoCode })}
          buildUpdatePayload={(_row, isActive, v) => ({ name: v.name, isoCode: v.isoCode, isActive })}
        />
      );

      await screen.findByText('India');
      await uiUser.click(screen.getAllByLabelText('Edit Country')[0]);

      const panel = screen.getByRole('dialog', { name: 'Edit Country' });
      const nameInput = within(panel).getByLabelText('Name') as HTMLInputElement;
      await uiUser.clear(nameInput);
      await uiUser.click(within(panel).getByText('Save'));

      expect(await within(panel).findByText('Please fill in all required fields.')).toBeInTheDocument();
      expect(update).not.toHaveBeenCalled();

      update.mockResolvedValue({ ...countries[0], name: 'Bharat' });
      await uiUser.type(nameInput, 'Bharat');
      await uiUser.click(within(panel).getByText('Save'));

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith('ctry_1', { name: 'Bharat', isoCode: 'IN', isActive: true })
      );
    });
  });

  it('disables the Add button when disableCreate is true', async () => {
    render(
      <MasterDataTable<Country, { name: string; isoCode: string }, { name: string; isoCode: string; isActive: boolean }>
        entityLabel="State"
        fetchAll={vi.fn().mockResolvedValue([])}
        create={vi.fn()}
        update={vi.fn()}
        columns={[{ key: 'name', label: 'Name' }]}
        fields={[{ key: 'name', label: 'Name', type: 'text' }]}
        defaultFormValues={{ name: '' }}
        buildCreatePayload={(v) => ({ name: v.name, isoCode: '' })}
        buildUpdatePayload={(row, isActive) => ({ name: row.name, isoCode: '', isActive })}
        disableCreate
      />
    );

    await screen.findByText('No state records yet.');
    expect(screen.getByRole('button', { name: 'Add State' })).toBeDisabled();
  });

  describe('delete (plan Part A)', () => {
    it('does not render a delete button when deleteFn is not supplied', async () => {
      render(
        <MasterDataTable<Country, { name: string; isoCode: string }, { name: string; isoCode: string; isActive: boolean }>
          entityLabel="Country"
          fetchAll={vi.fn().mockResolvedValue(countries)}
          create={vi.fn()}
          update={vi.fn()}
          columns={[{ key: 'name', label: 'Name' }]}
          fields={[{ key: 'name', label: 'Name', type: 'text' }]}
          defaultFormValues={{ name: '' }}
          buildCreatePayload={(v) => ({ name: v.name, isoCode: '' })}
          buildUpdatePayload={(row, isActive) => ({ name: row.name, isoCode: row.isoCode, isActive })}
        />
      );

      await screen.findByText('India');
      expect(screen.queryByLabelText('Delete Country')).not.toBeInTheDocument();
    });

    it('clicking delete shows an inline confirm, Cancel dismisses it without calling deleteFn', async () => {
      const deleteFn = vi.fn();
      const uiUser = userEvent.setup();

      render(
        <MasterDataTable<Country, { name: string; isoCode: string }, { name: string; isoCode: string; isActive: boolean }>
          entityLabel="Country"
          fetchAll={vi.fn().mockResolvedValue(countries)}
          create={vi.fn()}
          update={vi.fn()}
          deleteFn={deleteFn}
          columns={[{ key: 'name', label: 'Name' }]}
          fields={[{ key: 'name', label: 'Name', type: 'text' }]}
          defaultFormValues={{ name: '' }}
          buildCreatePayload={(v) => ({ name: v.name, isoCode: '' })}
          buildUpdatePayload={(row, isActive) => ({ name: row.name, isoCode: row.isoCode, isActive })}
        />
      );

      await screen.findByText('India');
      await uiUser.click(screen.getAllByLabelText('Delete Country')[0]);

      // Scoped to the confirm dialog itself -- every row's (always-mounted) Edit panel also has
      // its own "Cancel" button (see docs/FRONTEND_TRANSITIONS.md on why Edit panels stay
      // mounted-but-collapsed rather than unmounting).
      const confirmBox = screen.getByText('Really delete?').closest('div') as HTMLElement;
      expect(confirmBox).toBeInTheDocument();
      await uiUser.click(within(confirmBox).getByText('Cancel'));

      expect(screen.queryByText('Really delete?')).not.toBeInTheDocument();
      expect(deleteFn).not.toHaveBeenCalled();
    });

    it('confirming delete calls deleteFn and removes the row from the list (after the exit transition)', async () => {
      const deleteFn = vi.fn().mockResolvedValue(undefined);
      const uiUser = userEvent.setup();

      render(
        <MasterDataTable<Country, { name: string; isoCode: string }, { name: string; isoCode: string; isActive: boolean }>
          entityLabel="Country"
          fetchAll={vi.fn().mockResolvedValue(countries)}
          create={vi.fn()}
          update={vi.fn()}
          deleteFn={deleteFn}
          columns={[{ key: 'name', label: 'Name' }]}
          fields={[{ key: 'name', label: 'Name', type: 'text' }]}
          defaultFormValues={{ name: '' }}
          buildCreatePayload={(v) => ({ name: v.name, isoCode: '' })}
          buildUpdatePayload={(row, isActive) => ({ name: row.name, isoCode: row.isoCode, isActive })}
        />
      );

      await screen.findByText('India');
      await uiUser.click(screen.getAllByLabelText('Delete Country')[0]);
      await uiUser.click(screen.getByText('Yes'));

      expect(deleteFn).toHaveBeenCalledWith('ctry_1');
      await waitFor(() => expect(screen.queryByText('India')).not.toBeInTheDocument());
      expect(screen.getByText('Nepal')).toBeInTheDocument();
    });

    it('surfaces an inline error and keeps the row when deleteFn rejects (e.g. a future FK-dependent case)', async () => {
      const deleteFn = vi.fn().mockRejectedValue(new Error('Cannot delete: in use by existing records.'));
      const uiUser = userEvent.setup();

      render(
        <MasterDataTable<Country, { name: string; isoCode: string }, { name: string; isoCode: string; isActive: boolean }>
          entityLabel="Country"
          fetchAll={vi.fn().mockResolvedValue(countries)}
          create={vi.fn()}
          update={vi.fn()}
          deleteFn={deleteFn}
          columns={[{ key: 'name', label: 'Name' }]}
          fields={[{ key: 'name', label: 'Name', type: 'text' }]}
          defaultFormValues={{ name: '' }}
          buildCreatePayload={(v) => ({ name: v.name, isoCode: '' })}
          buildUpdatePayload={(row, isActive) => ({ name: row.name, isoCode: row.isoCode, isActive })}
        />
      );

      await screen.findByText('India');
      await uiUser.click(screen.getAllByLabelText('Delete Country')[0]);
      await uiUser.click(screen.getByText('Yes'));

      expect(await screen.findByText('Cannot delete: in use by existing records.')).toBeInTheDocument();
      expect(screen.getByText('India')).toBeInTheDocument();
    });
  });

  describe('ClassLevel-specific Subject multi-select extra field (plan Part B)', () => {
    const classLevels: ClassLevel[] = [
      { id: 'cl_10', name: 'Class 10', sortOrder: 10, isActive: true, subjectIds: ['sub_phy'] },
    ];

    const buildSubjectExtraField = (): MasterDataExtraField<ClassLevel> => ({
      key: 'subjectIds',
      label: 'Subjects',
      getRowValue: (row) => row.subjectIds,
      renderInput: (value, onChange) => (
        <div>
          <label>
            <input
              type="checkbox"
              checked={value.includes('sub_phy')}
              onChange={() =>
                onChange(value.includes('sub_phy') ? value.filter((id) => id !== 'sub_phy') : [...value, 'sub_phy'])
              }
            />
            Physics
          </label>
          <label>
            <input
              type="checkbox"
              checked={value.includes('sub_chem')}
              onChange={() =>
                onChange(value.includes('sub_chem') ? value.filter((id) => id !== 'sub_chem') : [...value, 'sub_chem'])
              }
            />
            Chemistry
          </label>
        </div>
      ),
    });

    it('renders the Subject multi-select in the Add form when extraFields is supplied', async () => {
      const uiUser = userEvent.setup();

      render(
        <MasterDataTable<ClassLevel, { name: string; sortOrder: number; subjectIds: string[] }, { name: string; sortOrder: number; isActive: boolean; subjectIds: string[] }>
          entityLabel="Class Level"
          fetchAll={vi.fn().mockResolvedValue([])}
          create={vi.fn()}
          update={vi.fn()}
          columns={[{ key: 'name', label: 'Name' }]}
          fields={[{ key: 'name', label: 'Name', type: 'text' }]}
          defaultFormValues={{ name: '' }}
          extraFields={[buildSubjectExtraField()]}
          defaultExtraFormValues={{ subjectIds: [] }}
          buildCreatePayload={(v, extra) => ({ name: v.name, sortOrder: 0, subjectIds: extra.subjectIds ?? [] })}
          buildUpdatePayload={(row, isActive, v, extra) => ({
            name: v.name,
            sortOrder: Number(v.sortOrder) || 0,
            isActive,
            subjectIds: extra.subjectIds ?? row.subjectIds,
          })}
        />
      );

      await screen.findByText('No class level records yet.');
      await uiUser.click(screen.getByRole('button', { name: 'Add Class Level' }));

      expect(screen.getByText('Physics')).toBeInTheDocument();
      expect(screen.getByText('Chemistry')).toBeInTheDocument();
    });

    it('submitting the Add form includes the checked subjectIds in the create payload', async () => {
      const create = vi.fn().mockResolvedValue({ id: 'cl_11', name: 'Class 11', sortOrder: 11, isActive: true, subjectIds: ['sub_phy'] });
      const uiUser = userEvent.setup();

      render(
        <MasterDataTable<ClassLevel, { name: string; sortOrder: number; subjectIds: string[] }, { name: string; sortOrder: number; isActive: boolean; subjectIds: string[] }>
          entityLabel="Class Level"
          fetchAll={vi.fn().mockResolvedValue([])}
          create={create}
          update={vi.fn()}
          columns={[{ key: 'name', label: 'Name' }]}
          fields={[{ key: 'name', label: 'Name', type: 'text' }]}
          defaultFormValues={{ name: '' }}
          extraFields={[buildSubjectExtraField()]}
          defaultExtraFormValues={{ subjectIds: [] }}
          buildCreatePayload={(v, extra) => ({ name: v.name, sortOrder: 0, subjectIds: extra.subjectIds ?? [] })}
          buildUpdatePayload={(row, isActive, v, extra) => ({
            name: v.name,
            sortOrder: Number(v.sortOrder) || 0,
            isActive,
            subjectIds: extra.subjectIds ?? row.subjectIds,
          })}
        />
      );

      await screen.findByText('No class level records yet.');
      await uiUser.click(screen.getByRole('button', { name: 'Add Class Level' }));
      await uiUser.type(screen.getByLabelText('Name'), 'Class 11');
      await uiUser.click(screen.getByText('Physics'));
      await uiUser.click(screen.getByText('Save'));

      await waitFor(() =>
        expect(create).toHaveBeenCalledWith({ name: 'Class 11', sortOrder: 0, subjectIds: ['sub_phy'] })
      );
    });

    it('the row Edit action opens the multi-select prefilled from the row, and Save calls update with the edited subjectIds', async () => {
      const update = vi.fn().mockResolvedValue(classLevels[0]);
      const uiUser = userEvent.setup();

      render(
        <MasterDataTable<ClassLevel, { name: string; sortOrder: number; subjectIds: string[] }, { name: string; sortOrder: number; isActive: boolean; subjectIds: string[] }>
          entityLabel="Class Level"
          fetchAll={vi.fn().mockResolvedValue(classLevels)}
          create={vi.fn()}
          update={update}
          columns={[{ key: 'name', label: 'Name' }]}
          fields={[
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'sortOrder', label: 'Sort Order', type: 'number' },
          ]}
          defaultFormValues={{ name: '', sortOrder: '0' }}
          extraFields={[buildSubjectExtraField()]}
          defaultExtraFormValues={{ subjectIds: [] }}
          buildCreatePayload={(v, extra) => ({ name: v.name, sortOrder: 0, subjectIds: extra.subjectIds ?? [] })}
          buildUpdatePayload={(row, isActive, v, extra) => ({
            name: v.name,
            sortOrder: Number(v.sortOrder) || 0,
            isActive,
            subjectIds: extra.subjectIds ?? row.subjectIds,
          })}
        />
      );

      await screen.findByText('Class 10');
      await uiUser.click(screen.getByLabelText('Edit Class Level'));

      // Scoped to the Edit panel specifically -- the Add-form's copy of the same Subject
      // multi-select is only mounted while that panel is open (never simultaneously with Edit,
      // ui/SidePanel.tsx renders one overlay at a time), but scoping still keeps the query
      // unambiguous and matches this suite's existing style.
      const panel = screen.getByRole('dialog', { name: 'Edit Class Level' });
      const physicsCheckbox = within(panel).getByLabelText('Physics') as HTMLInputElement;
      const chemistryCheckbox = within(panel).getByLabelText('Chemistry') as HTMLInputElement;
      expect(physicsCheckbox.checked).toBe(true);
      expect(chemistryCheckbox.checked).toBe(false);

      await uiUser.click(chemistryCheckbox);
      await uiUser.click(within(panel).getByText('Save'));

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith('cl_10', {
          name: 'Class 10',
          sortOrder: 10,
          isActive: true,
          subjectIds: ['sub_phy', 'sub_chem'],
        })
      );
    });

    it('renders a base-field Edit action even when extraFields is not supplied, and Save persists the edited values', async () => {
      const update = vi.fn().mockResolvedValue(countries[0]);
      const uiUser = userEvent.setup();

      render(
        <MasterDataTable<Country, { name: string; isoCode: string }, { name: string; isoCode: string; isActive: boolean }>
          entityLabel="Country"
          fetchAll={vi.fn().mockResolvedValue(countries)}
          create={vi.fn()}
          update={update}
          columns={[{ key: 'name', label: 'Name' }]}
          fields={[
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'isoCode', label: 'ISO Code', type: 'text' },
          ]}
          defaultFormValues={{ name: '', isoCode: '' }}
          buildCreatePayload={(v) => ({ name: v.name, isoCode: v.isoCode })}
          buildUpdatePayload={(_row, isActive, v) => ({ name: v.name, isoCode: v.isoCode, isActive })}
        />
      );

      await screen.findByText('India');
      const editButtons = screen.getAllByLabelText('Edit Country');
      expect(editButtons.length).toBeGreaterThan(0);

      await uiUser.click(editButtons[0]);

      // Scoped to the Edit panel specifically -- the Add form's own Name input would otherwise
      // be an additional match if it were open too (it isn't; only one SidePanel renders at a
      // time), but scoping keeps this unambiguous either way.
      const panel = screen.getByRole('dialog', { name: 'Edit Country' });
      const nameInput = within(panel).getByLabelText('Name') as HTMLInputElement;
      expect(nameInput.value).toBe('India');

      await uiUser.clear(nameInput);
      await uiUser.type(nameInput, 'Bharat');
      await uiUser.click(within(panel).getByText('Save'));

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith('ctry_1', { name: 'Bharat', isoCode: 'IN', isActive: true })
      );
    });
  });
});

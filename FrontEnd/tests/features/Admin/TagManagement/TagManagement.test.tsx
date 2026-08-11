import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagManagement } from '@/src/features/Admin/TagManagement/TagManagement';
import * as tagsService from '@/src/services/tagsService';
import { TagsError } from '@/src/services/tagsService';

vi.mock('@/src/services/tagsService', async () => {
  const actual = await vi.importActual<typeof import('@/src/services/tagsService')>('@/src/services/tagsService');
  return { ...actual, getTags: vi.fn(), createTag: vi.fn(), updateTag: vi.fn() };
});

const SEEDED_TAGS: tagsService.Tag[] = [
  { id: 'tag-1', name: 'Algebra', isActive: true },
  { id: 'tag-2', name: 'Photosynthesis', isActive: true },
  { id: 'tag-3', name: 'World War II', isActive: true },
  { id: 'tag-4', name: 'Grammar', isActive: true },
  { id: 'tag-5', name: 'Trigonometry', isActive: false },
  { id: 'tag-6', name: 'Cell Biology', isActive: true },
  { id: 'tag-7', name: 'Geometry', isActive: true },
];

// A small stateful fake standing in for the real backend -- mirrors Story 1.9's own TagService
// duplicate-check rule (case-insensitive, active-or-inactive) so these tests exercise the same
// contract the real server enforces, not just whatever the mock happens to do.
let tags: tagsService.Tag[];
let nextId: number;

describe('TagManagement', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    tags = SEEDED_TAGS.map((t) => ({ ...t }));
    nextId = SEEDED_TAGS.length + 1;

    vi.mocked(tagsService.getTags).mockImplementation(() => Promise.resolve(tags.map((t) => ({ ...t }))));

    vi.mocked(tagsService.createTag).mockImplementation((data) => {
      const name = data.name.trim();
      const isDuplicate = tags.some((t) => t.name.toLowerCase() === name.toLowerCase());
      if (isDuplicate) {
        return Promise.reject(new TagsError('A tag with this name already exists.'));
      }
      const created: tagsService.Tag = { id: `tag-${nextId++}`, name, isActive: true };
      tags = [...tags, created];
      return Promise.resolve(created);
    });

    vi.mocked(tagsService.updateTag).mockImplementation((id, data) => {
      const existing = tags.find((t) => t.id === id);
      if (!existing) {
        return Promise.reject(new TagsError('Tag not found.'));
      }
      const updated: tagsService.Tag = { ...existing, name: data.name.trim(), isActive: data.isActive };
      tags = tags.map((t) => (t.id === id ? updated : t));
      return Promise.resolve(updated);
    });
  });

  it('renders the seeded tags, including an inactive one', async () => {
    render(<TagManagement />);

    expect(await screen.findByText('Algebra')).toBeInTheDocument();
    expect(screen.getByText('Trigonometry')).toBeInTheDocument();
    const trigonometryRow = screen.getByText('Trigonometry').closest('tr') as HTMLElement;
    expect(within(trigonometryRow).getByRole('button', { name: 'Inactive' })).toBeInTheDocument();
  });

  it('rejects adding a tag whose name matches an existing tag case-insensitively, and does not add a row', async () => {
    const user = userEvent.setup();
    render(<TagManagement />);

    await screen.findByText('Algebra');

    await user.click(screen.getByRole('button', { name: 'Add Tag' }));
    await user.type(screen.getByLabelText('Name'), 'algebra');
    await user.click(screen.getByText('Save'));

    expect(await screen.findByText('A tag with this name already exists.')).toBeInTheDocument();
    expect(screen.getAllByText('Algebra')).toHaveLength(1);
    expect(screen.getAllByRole('row')).toHaveLength(8); // 7 seeded tags + header row, no row added
  });

  it('accepts adding a new, non-duplicate tag, active by default', async () => {
    const user = userEvent.setup();
    render(<TagManagement />);

    await screen.findByText('Algebra');

    await user.click(screen.getByRole('button', { name: 'Add Tag' }));
    await user.type(screen.getByLabelText('Name'), 'Osmosis');
    await user.click(screen.getByText('Save'));

    const osmosisRow = (await screen.findByText('Osmosis')).closest('tr') as HTMLElement;
    expect(within(osmosisRow).getByRole('button', { name: 'Active' })).toBeInTheDocument();
  });

  it('adding a tag with the Add form\'s Active toggle unchecked creates it as Inactive, with no error', async () => {
    const user = userEvent.setup();
    render(<TagManagement />);

    await screen.findByText('Algebra');

    await user.click(screen.getByRole('button', { name: 'Add Tag' }));
    await user.type(screen.getByLabelText('Name'), 'Thermodynamics');
    await user.click(screen.getByRole('switch', { name: 'Tag status' }));
    await user.click(screen.getByText('Save'));

    const newRow = (await screen.findByText('Thermodynamics')).closest('tr') as HTMLElement;
    expect(within(newRow).getByRole('button', { name: 'Inactive' })).toBeInTheDocument();
    expect(screen.queryByText('Tag not found.')).not.toBeInTheDocument();
  });

  it('deactivating a tag keeps it visible in the list, marked Inactive', async () => {
    const user = userEvent.setup();
    render(<TagManagement />);

    await screen.findByText('Algebra');
    const algebraRow = screen.getByText('Algebra').closest('tr') as HTMLElement;

    await user.click(within(algebraRow).getByRole('button', { name: 'Active' }));

    expect(await within(algebraRow).findByRole('button', { name: 'Inactive' })).toBeInTheDocument();
    expect(screen.getByText('Algebra')).toBeInTheDocument();
  });

  it('search narrows the visible tag list by name, case-insensitively', async () => {
    const user = userEvent.setup();
    render(<TagManagement />);

    await screen.findByText('Algebra');
    expect(screen.getByText('Trigonometry')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search tags'), 'trig');

    // 'Trigonometry' is present both before and after filtering, so its presence alone doesn't
    // prove the (debounced) search took effect -- wait on 'Algebra' disappearing instead.
    await waitFor(() => expect(screen.queryByText('Algebra')).not.toBeInTheDocument());
    expect(screen.getByText('Trigonometry')).toBeInTheDocument();
  });
});

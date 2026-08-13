import { vi } from 'vitest';
import type { TreeMutators } from '@/src/features/CourseContentEditor/ContentTreeNode';

// Story 3.11/Task 3: the golden-file suite mounts <ContentTree> directly with a minimal fixture
// (not the full CourseContentEditor, which would need mocking courseDraftService/toast/etc. for
// no rendering benefit) -- these mutators exist only to satisfy ContentTree's prop contract and
// are never expected to be called by a purely-visual test.
export const createNoopTreeMutators = (): TreeMutators => ({
  addNode: vi.fn(),
  editNodeTitle: vi.fn(),
  editContentBlock: vi.fn(),
  deleteNode: vi.fn(),
  reorderNode: vi.fn(),
  moveNode: vi.fn(),
  confirmNode: vi.fn(),
  requestDelete: vi.fn(),
});

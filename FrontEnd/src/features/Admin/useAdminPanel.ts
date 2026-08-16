import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { AlertTriangle, ClipboardCheck, Cpu, LayoutGrid, ShieldCheck, SlidersHorizontal, UserPlus } from 'lucide-react';
import { useDomain } from '../../context/DomainContext';

export type AdminSubTab =
  | 'masterdata'
  | 'support-users'
  | 'role-visibility'
  | 'tutor-approvals'
  | 'ai-configuration'
  | 'errors'
  | 'settings';

// 'settings' is appended at the END, after 'errors' -- ALL_SUB_TABS[0] drives Master's default
// activeSubTab (availableSubTabs[0] ?? 'tutor-approvals') and the Navbar Admin dropdown's render
// order, so inserting it earlier would silently change Master's default landing tab (Story 6.1).
const ALL_SUB_TABS: AdminSubTab[] = [
  'masterdata',
  'support-users',
  'role-visibility',
  'tutor-approvals',
  'ai-configuration',
  'errors',
  'settings',
];

// Single source of truth for admin sub-tab label/icon metadata -- shared by AdminPanel's own
// in-page dropdown AND Navbar's Admin entry-point dropdown (the two must never drift, since
// Navbar's dropdown deep-links straight into one of these sub-tabs).
export const ADMIN_SUBTAB_META: Record<AdminSubTab, { label: string; icon: ComponentType<{ className?: string }> }> = {
  // Master AND Support (FR-26) -- Support's access is narrowed to just the Tag Management
  // entity inside MasterDataManager (tag hygiene is routine vocabulary upkeep, not a cost
  // lever); the other 6 entities stay Master-only. See MasterDataManager's visibleEntities.
  masterdata: { label: 'Master Data', icon: LayoutGrid },
  'support-users': { label: 'Support Users', icon: UserPlus },
  'role-visibility': { label: 'Role Visibility', icon: ShieldCheck },
  'tutor-approvals': { label: 'Tutor Approvals', icon: ClipboardCheck },
  // Master-only (New Course Wizard PRD FR-27/FR-28/FR-29) -- not added to Support's subset below.
  'ai-configuration': { label: 'AI Configuration & Usage', icon: Cpu },
  // Master-only (ErrorObservability PRD FR-19, Story 4.5) -- not added to Support's subset below,
  // same Master-only precedent as 'ai-configuration'.
  errors: { label: 'Error Log', icon: AlertTriangle },
  // Master AND Support (AdminSettings PRD FR-4, backend AD-27) -- mirrors 'tutor-approvals'
  // access tier exactly, not 'ai-configuration'/'errors'' Master-only tier (Story 6.1).
  settings: { label: 'Settings', icon: SlidersHorizontal },
};

export interface ControlledAdminSubTab {
  activeSubTab: AdminSubTab;
  setActiveSubTab: (tab: AdminSubTab) => void;
}

// Feature-local hook (AD-2) for features/Admin/ -- sub-tab availability is role-gated
// client-side for UX (Master sees all 5 admin sections, Support sees Tutor Approvals and
// Master Data -- the latter narrowed to just Tag Management for Support inside
// MasterDataManager, matching FeatureKeys.TutorApprove's default-visible-for roles in plan
// §3's table); the real safety net is every write endpoint's own [Authorize(Policy = ...)]
// on the backend.
//
// activeSubTab can be lifted and controlled from the outside by passing `controlled` -- App.tsx
// does this so Navbar's Admin dropdown and AdminPanel's own in-page dropdown share one piece of
// state instead of two disconnected copies. Omit it to fall back to a self-contained internal
// state (e.g. AdminPanel rendered standalone in a test, with no App.tsx wiring).
export const useAdminPanel = (controlled?: ControlledAdminSubTab) => {
  const { user } = useDomain();

  const availableSubTabs = useMemo<AdminSubTab[]>(() => {
    if (user?.role === 'Master') return ALL_SUB_TABS;
    if (user?.role === 'Support') return ['tutor-approvals', 'masterdata', 'settings'];
    return [];
  }, [user?.role]);

  const [internalActiveSubTab, setInternalActiveSubTab] = useState<AdminSubTab>(availableSubTabs[0] ?? 'tutor-approvals');
  const activeSubTab = controlled ? controlled.activeSubTab : internalActiveSubTab;
  const setActiveSubTab = controlled ? controlled.setActiveSubTab : setInternalActiveSubTab;

  // Keeps activeSubTab valid if availableSubTabs narrows after mount (e.g. user object
  // resolves after the initial render).
  useEffect(() => {
    if (availableSubTabs.length > 0 && !availableSubTabs.includes(activeSubTab)) {
      setActiveSubTab(availableSubTabs[0]);
    }
  }, [availableSubTabs, activeSubTab, setActiveSubTab]);

  return { activeSubTab, setActiveSubTab, availableSubTabs };
};

import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { ClipboardCheck, Cpu, LayoutGrid, ShieldCheck, Tags, UserPlus } from 'lucide-react';
import { useDomain } from '../../context/DomainContext';

export type AdminSubTab =
  | 'masterdata'
  | 'support-users'
  | 'role-visibility'
  | 'tutor-approvals'
  | 'ai-configuration'
  | 'tag-management';

const ALL_SUB_TABS: AdminSubTab[] = [
  'masterdata',
  'support-users',
  'role-visibility',
  'tutor-approvals',
  'ai-configuration',
  'tag-management',
];

// Single source of truth for admin sub-tab label/icon metadata -- shared by AdminPanel's own
// in-page dropdown AND Navbar's Admin entry-point dropdown (the two must never drift, since
// Navbar's dropdown deep-links straight into one of these sub-tabs).
export const ADMIN_SUBTAB_META: Record<AdminSubTab, { label: string; icon: ComponentType<{ className?: string }> }> = {
  masterdata: { label: 'Master Data', icon: LayoutGrid },
  'support-users': { label: 'Support Users', icon: UserPlus },
  'role-visibility': { label: 'Role Visibility', icon: ShieldCheck },
  'tutor-approvals': { label: 'Tutor Approvals', icon: ClipboardCheck },
  // Master-only (New Course Wizard PRD FR-27/FR-28/FR-29) -- not added to Support's subset below.
  'ai-configuration': { label: 'AI Configuration & Usage', icon: Cpu },
  // Master AND Support (FR-26) -- tag hygiene is routine vocabulary upkeep, not a cost lever.
  'tag-management': { label: 'Tag Management', icon: Tags },
};

export interface ControlledAdminSubTab {
  activeSubTab: AdminSubTab;
  setActiveSubTab: (tab: AdminSubTab) => void;
}

// Feature-local hook (AD-2) for features/Admin/ -- sub-tab availability is role-gated
// client-side for UX (Master sees all 6 admin sections, Support sees Tutor Approvals and Tag
// Management, matching FeatureKeys.TutorApprove's default-visible-for roles in plan §3's table); the
// real safety net is every write endpoint's own [Authorize(Policy = ...)] on the backend.
//
// activeSubTab can be lifted and controlled from the outside by passing `controlled` -- App.tsx
// does this so Navbar's Admin dropdown and AdminPanel's own in-page dropdown share one piece of
// state instead of two disconnected copies. Omit it to fall back to a self-contained internal
// state (e.g. AdminPanel rendered standalone in a test, with no App.tsx wiring).
export const useAdminPanel = (controlled?: ControlledAdminSubTab) => {
  const { user } = useDomain();

  const availableSubTabs = useMemo<AdminSubTab[]>(() => {
    if (user?.role === 'Master') return ALL_SUB_TABS;
    if (user?.role === 'Support') return ['tutor-approvals', 'tag-management'];
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

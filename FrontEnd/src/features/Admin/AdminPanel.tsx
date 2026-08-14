import React from 'react';
import { ADMIN_SUBTAB_META, AdminSubTab, useAdminPanel } from './useAdminPanel';
import { MasterDataManager } from './MasterDataManager';
import { SupportUserCreation } from './SupportUserCreation';
import { RoleVisibilityManager } from './RoleVisibilityManager';
import { TutorApprovals } from './TutorApprovals';
import { AiConfiguration } from './AiConfiguration/AiConfiguration';
import { TagManagement } from './TagManagement/TagManagement';
import { ErrorLog } from './ErrorLog/ErrorLog';
import { PageTransition } from '../../ui/PageTransition';

interface AdminPanelProps {
  // Controlled from App.tsx -- activeSubTab is lifted there so Navbar's Admin dropdown and this
  // panel's own sub-tab dropdown share a single source of truth (see useAdminPanel.ts). Both
  // props must be passed together; if either is omitted, AdminPanel falls back to its own
  // internal state (e.g. when rendered standalone in a test with no App.tsx wiring).
  activeSubTab?: AdminSubTab;
  onSubTabChange?: (tab: AdminSubTab) => void;
}

// Rendered by App.tsx when activeTab === 'admin' (gated behind visibleTabs.admin -- plan §5
// item 7). Sub-tab availability comes from useAdminPanel: Master sees all 4 sections,
// Support sees Tutor Approvals only.
export const AdminPanel: React.FC<AdminPanelProps> = ({ activeSubTab: controlledActiveSubTab, onSubTabChange }) => {
  const controlled =
    controlledActiveSubTab !== undefined && onSubTabChange
      ? { activeSubTab: controlledActiveSubTab, setActiveSubTab: onSubTabChange }
      : undefined;
  const { activeSubTab, availableSubTabs } = useAdminPanel(controlled);

  if (availableSubTabs.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-[#5E6A79]">You don't have access to any admin sections.</div>
    );
  }

  const activeMeta = ADMIN_SUBTAB_META[activeSubTab];
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="space-y-6 pb-12 w-full">
      {/* Section switching now lives solely in Navbar's Admin dropdown (desktop + mobile) --
          this used to duplicate that with its own in-page dropdown here at the top-left of the
          page, which was redundant and is now just a static heading for orientation. */}
      <div className="flex items-center gap-2.5">
        <ActiveIcon className="w-5 h-5 text-[#BA5012]" />
        <h2 className="text-sm font-bold text-[#142030]">{activeMeta.label}</h2>
      </div>

      {/* Crossfades between sub-tabs instead of an instant unmount+mount swap -- see
          PageTransition.tsx / usePageTransition.ts. */}
      <PageTransition contentKey={activeSubTab}>
        {activeSubTab === 'masterdata' && <MasterDataManager />}
        {activeSubTab === 'support-users' && <SupportUserCreation />}
        {activeSubTab === 'role-visibility' && <RoleVisibilityManager />}
        {activeSubTab === 'tutor-approvals' && <TutorApprovals />}
        {activeSubTab === 'ai-configuration' && <AiConfiguration />}
        {activeSubTab === 'tag-management' && <TagManagement />}
        {activeSubTab === 'errors' && <ErrorLog />}
      </PageTransition>
    </div>
  );
};

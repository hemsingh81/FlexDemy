import React from 'react';
import {
  BookOpen,
  Compass,
  Users,
  FileCheck2,
  Award,
  Flame,
  Moon,
  Sun,
  Sliders,
  LogOut,
  Search,
  GraduationCap,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { UserProfile } from '../types';
import { Dropdown, DropdownRenderState } from './Dropdown';
import { Logo } from './Logo';
import { ADMIN_SUBTAB_META, AdminSubTab } from '../features/Admin/useAdminPanel';

interface NavbarProps {
  user: UserProfile;
  activeTab: 'dashboard' | 'discover' | 'player' | 'groups' | 'assignments' | 'certificates' | 'tutor' | 'admin';
  setActiveTab: (
    tab: 'dashboard' | 'discover' | 'player' | 'groups' | 'assignments' | 'certificates' | 'tutor' | 'admin'
  ) => void;
  // Feature-key -> visible map for the caller's role (DomainContext.rolePermissions, plan §3).
  // Every nav button below is filtered through this -- not just the Admin one -- so a
  // restrictive permission change actually hides the tab, not just adds a new one.
  visibleTabs: Record<string, boolean>;
  // Admin dropdown wiring (App.tsx owns the underlying state -- see useAdminPanel.ts's
  // "controlled" mode -- so this dropdown's selection and AdminPanel's own in-page dropdown
  // never drift apart). availableAdminSubTabs is already role-filtered by the caller.
  availableAdminSubTabs: AdminSubTab[];
  activeAdminSubTab: AdminSubTab;
  onSelectAdminSubTab: (tab: AdminSubTab) => void;
  onSignOut: () => void;
  onOpenAccessibility: () => void;
  onToggleTheme: () => void;
  isDarkMode: boolean;
  onSearchClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  visibleTabs,
  availableAdminSubTabs,
  activeAdminSubTab,
  onSelectAdminSubTab,
  onSignOut,
  onOpenAccessibility,
  onToggleTheme,
  isDarkMode,
  onSearchClick,
}) => {
  // Identical option-list markup is shared by the desktop and mobile Admin dropdowns below
  // (only their trigger button and menu width/padding differ) -- extracted once here rather
  // than copy-pasted twice, same as it was before this file's dropdowns moved onto Dropdown.
  const renderAdminSubTabOptions = ({ close }: DropdownRenderState) =>
    availableAdminSubTabs.map((tab) => {
      const meta = ADMIN_SUBTAB_META[tab];
      const Icon = meta.icon;
      const isActive = activeTab === 'admin' && activeAdminSubTab === tab;
      return (
        <button
          key={tab}
          role="option"
          aria-selected={isActive}
          onClick={() => {
            onSelectAdminSubTab(tab);
            close();
          }}
          className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center space-x-2.5 hover:bg-white/10 ${
            isActive ? 'text-amber-300 font-bold bg-white/15' : 'text-slate-200'
          }`}
        >
          <Icon className="w-4 h-4" />
          <span>{meta.label}</span>
        </button>
      );
    });

  return (
    // Higher than any page-level sticky header (e.g. CoursePlayer's, also z-40) -- position:
    // sticky + z-index creates a stacking context, so this must outrank siblings outright or
    // its own dropdowns (however high their local z-index) still lose to a later-DOM sibling.
    <header className="sticky top-0 z-50 bg-[#143358] text-white border-b border-white/10 shadow-md">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand Name */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('discover')}>
            <div className="w-9 h-9 rounded-xl bg-[#EC7B38] flex items-center justify-center text-[#143358] shadow-md shadow-[#EC7B38]/30">
              <Logo className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold font-display tracking-tight text-white block leading-tight">
                FlexDemy
              </span>
              <span className="hidden sm:block text-[10px] font-medium text-slate-300 leading-tight">
                My time. My academy.
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1" aria-label="Main Navigation">
            {visibleTabs.discover && (
              <button
                onClick={() => setActiveTab('discover')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'discover'
                    ? 'bg-[#EC7B38] text-white shadow-md shadow-[#EC7B38]/30'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>Home</span>
              </button>
            )}

            {visibleTabs.dashboard && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-white/15 text-white font-bold border border-white/20'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <BookOpen className="w-4 h-4 opacity-90" />
                <span>Dashboard</span>
              </button>
            )}

            {visibleTabs.tutor && (
              <button
                onClick={() => setActiveTab('tutor')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'tutor'
                    ? 'bg-white/15 text-white font-bold border border-white/20'
                    : 'text-amber-300 hover:bg-white/10'
                }`}
              >
                <GraduationCap className="w-4 h-4 text-[#EC7B38]" />
                <span>Tutor Hub & Booking</span>
              </button>
            )}

            {visibleTabs.groups && (
              <button
                onClick={() => setActiveTab('groups')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'groups'
                    ? 'bg-white/15 text-white font-bold border border-white/20'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <Users className="w-4 h-4 opacity-90" />
                <span>Group Study</span>
              </button>
            )}

            {visibleTabs.assignments && (
              <button
                onClick={() => setActiveTab('assignments')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'assignments'
                    ? 'bg-white/15 text-white font-bold border border-white/20'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <FileCheck2 className="w-4 h-4 opacity-90" />
                <span>Assignments</span>
              </button>
            )}

            {visibleTabs.certificates && (
              <button
                onClick={() => setActiveTab('certificates')}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === 'certificates'
                    ? 'bg-white/15 text-white font-bold border border-white/20'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >
                <Award className="w-4 h-4 opacity-90" />
                <span>Certificates</span>
              </button>
            )}

            {visibleTabs.admin && (
              <Dropdown
                align="left"
                menuProps={{ role: 'listbox' }}
                menuClassName="w-56 bg-[#143358] rounded-2xl shadow-2xl border border-white/15 py-1.5 text-slate-100"
                trigger={({ open, toggle }) => (
                  <button
                    onClick={toggle}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      activeTab === 'admin'
                        ? 'bg-white/15 text-white font-bold border border-white/20'
                        : 'text-slate-200 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 opacity-90" />
                    <span>Admin</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                )}
                menu={renderAdminSubTabOptions}
              />
            )}
          </nav>

          {/* Right Action Tools */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {/* Quick Search */}
            <button
              onClick={onSearchClick}
              aria-label="Search courses"
              className="p-2 rounded-xl text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Streak Counter Badge */}
            <div
              className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#EC7B38]/20 text-amber-300 border border-[#EC7B38]/40 text-xs font-semibold"
              title={`${user.streakDays} Day Learning Streak`}
            >
              <Flame className="w-4 h-4 text-[#EC7B38] fill-[#EC7B38]" />
              <span>{user.streakDays}d Streak</span>
            </div>

            {/* Accessibility Modal Trigger */}
            <button
              onClick={onOpenAccessibility}
              aria-label="Accessibility settings"
              className="p-2 rounded-xl text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* User Profile Avatar / Menu */}
            <Dropdown
              align="right"
              menuClassName="w-56 bg-[#143358] rounded-2xl shadow-2xl border border-white/15 py-2 text-slate-100"
              trigger={({ toggle }) => (
                <button
                  onClick={toggle}
                  className="flex items-center space-x-2 p-0.5 rounded-full hover:ring-2 hover:ring-[#EC7B38] transition-all focus:outline-hidden"
                >
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover border border-white/30"
                  />
                </button>
              )}
              menu={({ close }) => (
                <>
                  <div className="px-4 py-2 border-b border-white/10">
                    <p className="text-sm font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-slate-300 truncate">{user.email}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-amber-300 font-medium">
                      <span>{user.totalPoints} Mastery Points</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      close();
                      onSignOut();
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20 flex items-center space-x-2"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>Sign Out</span>
                  </button>
                </>
              )}
            />

          </div>
        </div>

        {/* Mobile Navigation Sub-bar */}
        <div className="flex lg:hidden items-center justify-around py-2 border-t border-white/10 text-xs font-medium text-slate-200 overflow-x-auto">
          {visibleTabs.dashboard && (
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-2.5 py-1 rounded-lg flex items-center space-x-1 ${
                activeTab === 'dashboard' ? 'text-white font-bold bg-white/15' : ''
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
          )}
          {visibleTabs.tutor && (
            <button
              onClick={() => setActiveTab('tutor')}
              className={`px-2.5 py-1 rounded-lg flex items-center space-x-1 ${
                activeTab === 'tutor' ? 'text-amber-300 font-bold bg-white/15' : ''
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-[#EC7B38]" />
              <span>Tutor Hub</span>
            </button>
          )}
          {visibleTabs.groups && (
            <button
              onClick={() => setActiveTab('groups')}
              className={`px-2.5 py-1 rounded-lg flex items-center space-x-1 ${
                activeTab === 'groups' ? 'text-white font-bold bg-white/15' : ''
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Groups</span>
            </button>
          )}
          {visibleTabs.admin && (
            <Dropdown
              align="left"
              menuProps={{ role: 'listbox' }}
              menuClassName="w-52 bg-[#143358] rounded-2xl shadow-2xl border border-white/15 py-1.5 text-slate-100"
              trigger={({ open, toggle }) => (
                <button
                  onClick={toggle}
                  aria-haspopup="listbox"
                  aria-expanded={open}
                  className={`px-2.5 py-1 rounded-lg flex items-center space-x-1 ${
                    activeTab === 'admin' ? 'text-white font-bold bg-white/15' : ''
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
              )}
              menu={renderAdminSubTabOptions}
            />
          )}
        </div>

      </div>
    </header>
  );
};


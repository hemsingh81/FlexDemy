import React, { useState } from 'react';
import {
  BookOpen,
  Compass,
  Users,
  FileCheck2,
  Award,
  Flame,
  Moon,
  Sun,
  Globe,
  Sliders,
  LogOut,
  User as UserIcon,
  Search,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import { UserProfile } from '../types';
import { LanguageCode, LANGUAGE_NAMES, translate } from '../lib/i18n';

interface NavbarProps {
  user: UserProfile;
  activeTab: 'dashboard' | 'discover' | 'player' | 'groups' | 'assignments' | 'certificates' | 'tutor';
  setActiveTab: (tab: 'dashboard' | 'discover' | 'player' | 'groups' | 'assignments' | 'certificates' | 'tutor') => void;
  onOpenAuth: () => void;
  onOpenAccessibility: () => void;
  onLanguageChange: (lang: LanguageCode) => void;
  onToggleTheme: () => void;
  isDarkMode: boolean;
  onSearchClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onOpenAuth,
  onOpenAccessibility,
  onLanguageChange,
  onToggleTheme,
  isDarkMode,
  onSearchClick,
}) => {
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  const t = (key: string) => translate(key, user.language);

  return (
    <header className="sticky top-0 z-40 bg-[#143358] text-white border-b border-white/10 shadow-md">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand Name */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('discover')}>
            <div className="w-9 h-9 rounded-xl bg-[#EC7B38] flex items-center justify-center text-white shadow-md shadow-[#EC7B38]/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold font-display tracking-tight text-white block leading-tight">
                {t('app_title')}
              </span>
              <span className="hidden sm:block text-[10px] font-medium text-slate-300 leading-tight">
                {t('tagline')}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1" aria-label="Main Navigation">
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

            <button
              onClick={() => setActiveTab('groups')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'groups'
                  ? 'bg-white/15 text-white font-bold border border-white/20'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Users className="w-4 h-4 opacity-90" />
              <span>{t('nav_groups')}</span>
            </button>

            <button
              onClick={() => setActiveTab('assignments')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'assignments'
                  ? 'bg-white/15 text-white font-bold border border-white/20'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <FileCheck2 className="w-4 h-4 opacity-90" />
              <span>{t('nav_assignments')}</span>
            </button>

            <button
              onClick={() => setActiveTab('certificates')}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                activeTab === 'certificates'
                  ? 'bg-white/15 text-white font-bold border border-white/20'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Award className="w-4 h-4 opacity-90" />
              <span>{t('nav_certificates')}</span>
            </button>
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

            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                aria-label="Select Language"
                className="p-2 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors flex items-center space-x-1"
              >
                <Globe className="w-4 h-4" />
                <span className="text-xs uppercase font-bold hidden xl:inline">{user.language}</span>
              </button>

              {showLangDropdown && (
                <div className="absolute right-0 mt-2 w-40 bg-[#143358] rounded-2xl shadow-2xl border border-white/15 py-1.5 z-50 text-slate-100">
                  {Object.entries(LANGUAGE_NAMES).map(([code, info]) => (
                    <button
                      key={code}
                      onClick={() => {
                        onLanguageChange(code as LanguageCode);
                        setShowLangDropdown(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center space-x-2.5 hover:bg-white/10 ${
                        user.language === code ? 'text-amber-300 font-bold bg-white/15' : 'text-slate-200'
                      }`}
                    >
                      <span className="text-base">{info.flag}</span>
                      <span>{info.name}</span>
                    </button>
                  ))}
                </div>
              )}
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
            <div className="relative">
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center space-x-2 p-0.5 rounded-full hover:ring-2 hover:ring-[#EC7B38] transition-all focus:outline-hidden"
              >
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border border-white/30"
                />
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-56 bg-[#143358] rounded-2xl shadow-2xl border border-white/15 py-2 z-50 text-slate-100">
                  <div className="px-4 py-2 border-b border-white/10">
                    <p className="text-sm font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-slate-300 truncate">{user.email}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-amber-300 font-medium">
                      <span>{user.totalPoints} {t('mastery_points')}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      onOpenAuth();
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 flex items-center space-x-2"
                  >
                    <UserIcon className="w-4 h-4 text-slate-300" />
                    <span>Switch Profile / Auth</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      onOpenAuth();
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20 flex items-center space-x-2"
                  >
                    <LogOut className="w-4 h-4 text-red-400" />
                    <span>{t('sign_out')}</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Mobile Navigation Sub-bar */}
        <div className="flex lg:hidden items-center justify-around py-2 border-t border-white/10 text-xs font-medium text-slate-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-2.5 py-1 rounded-lg flex items-center space-x-1 ${
              activeTab === 'dashboard' ? 'text-white font-bold bg-white/15' : ''
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('tutor')}
            className={`px-2.5 py-1 rounded-lg flex items-center space-x-1 ${
              activeTab === 'tutor' ? 'text-amber-300 font-bold bg-white/15' : ''
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-[#EC7B38]" />
            <span>Tutor Hub</span>
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-2.5 py-1 rounded-lg flex items-center space-x-1 ${
              activeTab === 'groups' ? 'text-white font-bold bg-white/15' : ''
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Groups</span>
          </button>
        </div>

      </div>
    </header>
  );
};


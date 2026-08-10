import React, { useState } from 'react';
import { LucideIcon } from 'lucide-react';

export interface DashboardNavSection {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface DashboardSectionNavProps {
  sections: DashboardNavSection[];
}

// In-page section nav for Dashboard (Student and Tutor). Reuses the same underlying mechanism
// as CourseOverviewScreen.tsx's sticky top pill nav -- scrollIntoView + click-driven
// active-section state -- across two layouts: a vertical sidebar at `lg+` (PRD FR-2/FR-3), and
// a horizontal sticky-top pill bar below `lg` (same mechanism CourseOverviewScreen already uses
// unconditionally) so the section-jump capability is never silently lost on a narrower
// viewport -- see DESIGN.md's "pair every hidden lg:flex with a smaller-viewport equivalent"
// rule and Navbar.tsx's desktop/mobile swap discipline, which this mirrors in spirit.
export const DashboardSectionNav: React.FC<DashboardSectionNavProps> = ({ sections }) => {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '');

  const scrollToSection = (id: string) => {
    setActiveId(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav
        aria-label="Dashboard sections"
        className="hidden lg:flex flex-col w-56 shrink-0 sticky top-20 self-start space-y-1 p-2 rounded-2xl bg-white border border-[#E1DED4] shadow-2xs h-fit"
      >
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeId === section.id;

          return (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              aria-current={isActive ? 'true' : undefined}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2.5 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#143358] text-white shadow-xs'
                  : 'text-[#5E6A79] hover:bg-[#FAF7EC] hover:text-[#142030]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#EC7B38]' : 'text-[#5E6A79]'}`} />
              <span>{section.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Below lg: horizontal sticky-top pill bar -- same sections/mechanism, same capability,
          just reshaped, so this navigation never just disappears on a narrower viewport. */}
      <nav
        aria-label="Dashboard sections"
        className="flex lg:hidden sticky top-16 z-20 w-full bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-[#E1DED4] shadow-2xs items-center space-x-2 overflow-x-auto"
      >
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeId === section.id;

          return (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              aria-current={isActive ? 'true' : undefined}
              className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer border ${
                isActive
                  ? 'bg-[#143358] text-white border-[#143358] shadow-xs'
                  : 'bg-[#FAF7EC] text-[#142030] border-[#E1DED4] hover:bg-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#EC7B38]' : 'text-[#5E6A79]'}`} />
              <span>{section.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

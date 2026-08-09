import React from 'react';
import { Clock3, LogOut, Sparkles } from 'lucide-react';

interface PendingApprovalPageProps {
  onSignOut: () => void;
}

// Rendered by App.tsx's post-auth role gate whenever user.role === 'PendingTutor' -- the
// applicant waits here until Support/Master reviews the application (out of scope: that
// review screen is features/Admin/, a later phase). Same Lumen color tokens as AuthLayout
// (index.css doesn't define named OKLCH utility classes for these yet, so the raw hex
// values are repeated here exactly as Login/SignUp/AuthLayout already do).
export const PendingApprovalPage: React.FC<PendingApprovalPageProps> = ({ onSignOut }) => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#FAF7EC] px-6 py-12">
      <div className="w-full max-w-md bg-white border border-[#E1DED4] rounded-2xl shadow-md p-8 text-center space-y-5">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-9 h-9 rounded-xl bg-[#EC7B38] flex items-center justify-center shadow-md shadow-[#EC7B38]/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold font-display text-[#142030]">FlexDemy</span>
        </div>

        <div className="w-14 h-14 mx-auto rounded-full bg-[#EC7B38]/15 flex items-center justify-center">
          <Clock3 className="w-7 h-7 text-[#EC7B38]" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-bold font-display text-[#142030]">Your tutor application is under review</h1>
          <p className="text-sm text-[#5E6A79] leading-relaxed">
            Our team is reviewing your qualifications and subject expertise. We'll let you know as soon as a
            decision is made -- this usually only takes a couple of days.
          </p>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="w-full py-3 px-4 bg-[#143358] hover:bg-[#143358]/90 text-white font-bold rounded-xl text-sm shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
};

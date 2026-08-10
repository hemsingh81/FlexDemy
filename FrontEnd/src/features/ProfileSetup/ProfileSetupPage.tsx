import React from 'react';
import { ArrowLeft, BookOpen, GraduationCap, LogOut } from 'lucide-react';
import { AuthLayout } from '../Auth/AuthLayout';
import { useProfileSetup } from './useProfileSetup';
import { StudentProfileForm } from './StudentProfileForm';
import { TutorProfileForm } from './TutorProfileForm';

interface ProfileSetupPageProps {
  onSignOut: () => void;
}

// Rendered by App.tsx's post-auth role gate whenever user.role === 'Unassigned' -- first
// screen a freshly registered user sees. Role choice, then the matching form; on success
// useProfileSetup() flips user.role locally (via DomainContext.updateUser) so App.tsx's
// gate re-renders into either the full app (Student) or PendingApprovalPage (Tutor)
// without a page reload.
export const ProfileSetupPage: React.FC<ProfileSetupPageProps> = ({ onSignOut }) => {
  const profileSetup = useProfileSetup();
  const { role, chooseRole } = profileSetup;

  if (!role) {
    return (
      <AuthLayout
        title="Tell us about you"
        subtitle="Choose how you'll use FlexDemy so we can finish setting up your account"
        contentClassName="max-w-xl"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => chooseRole('Student')}
            className="text-left p-5 bg-white border border-[#E1DED4] rounded-2xl hover:border-[#BA5012] hover:shadow-md transition-all cursor-pointer space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-[#BA5012]/15 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-[#BA5012]" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#142030]">I'm a Student</p>
              <p className="text-xs text-[#5E6A79] mt-1">
                Pick your class, board, and subjects to start learning right away.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => chooseRole('Tutor')}
            className="text-left p-5 bg-white border border-[#E1DED4] rounded-2xl hover:border-[#BA5012] hover:shadow-md transition-all cursor-pointer space-y-3"
          >
            <div className="w-10 h-10 rounded-xl bg-[#143358]/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#143358]" />
            </div>
            <div>
              <p className="font-bold text-sm text-[#142030]">I'm a Tutor</p>
              <p className="text-xs text-[#5E6A79] mt-1">
                Apply to teach -- our team reviews every application before you go live.
              </p>
            </div>
          </button>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-1.5 text-xs font-semibold text-[#5E6A79] hover:text-red-600 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={role === 'Student' ? 'Complete your student profile' : 'Apply to become a tutor'}
      subtitle={
        role === 'Student'
          ? 'Tell us your class, board, and subjects so we can personalize FlexDemy for you'
          : 'Tell us about your expertise -- our team will review your application'
      }
      contentClassName="max-w-xl"
    >
      <button
        type="button"
        onClick={() => chooseRole(null)}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#5E6A79] hover:text-[#142030] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back</span>
      </button>

      {role === 'Student' ? (
        <StudentProfileForm profileSetup={profileSetup} />
      ) : (
        <TutorProfileForm profileSetup={profileSetup} />
      )}

      <button
        type="button"
        onClick={onSignOut}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#5E6A79] hover:text-red-600 transition-colors cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Sign out</span>
      </button>
    </AuthLayout>
  );
};

import React, { useEffect, useState } from 'react';
import { ArrowLeft, LogOut, RotateCcw, Sparkles, UserCog, XCircle } from 'lucide-react';
import * as profileService from '../../services/profileService';
import { useProfileSetup } from './useProfileSetup';
import { StudentProfileForm } from './StudentProfileForm';
import { TutorProfileForm } from './TutorProfileForm';

interface TutorRejectedPageProps {
  onSignOut: () => void;
}

type Action = 'reapply' | 'switch' | null;

// Rendered by App.tsx's post-auth role gate whenever user.role === 'RejectedTutor'. Owns its
// own useProfileSetup() instance (same pattern as ProfileSetupPage) since
// submitStudentProfile/submitTutorApplication don't depend on the hook's role-choice step --
// POST /api/v1/profiles/student is the same "switch to Student" route the backend dispatches
// on the caller's current role, and POST /api/v1/profiles/tutor is the same re-apply route.
export const TutorRejectedPage: React.FC<TutorRejectedPageProps> = ({ onSignOut }) => {
  const profileSetup = useProfileSetup();
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [isLoadingReason, setIsLoadingReason] = useState(true);
  const [action, setAction] = useState<Action>(null);

  useEffect(() => {
    let cancelled = false;
    profileService.getMyProfileStatus().then((status) => {
      if (cancelled) return;
      setRejectionReason(status.rejectionReason);
      setIsLoadingReason(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#FAF7EC] px-6 py-12">
      <div className="w-full max-w-xl bg-white border border-[#E1DED4] rounded-2xl shadow-md p-8 space-y-5">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-9 h-9 rounded-xl bg-[#EC7B38] flex items-center justify-center shadow-md shadow-[#EC7B38]/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold font-display text-[#142030]">FlexDemy</span>
        </div>

        {!action && (
          <div className="text-center space-y-5">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-7 h-7 text-red-500" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl font-bold font-display text-[#142030]">Your tutor application wasn't approved</h1>
              {!isLoadingReason && rejectionReason && (
                <p className="text-sm text-[#5E6A79] leading-relaxed">"{rejectionReason}"</p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAction('reapply')}
                className="p-4 bg-white border border-[#E1DED4] rounded-2xl hover:border-[#EC7B38] hover:shadow-md transition-all cursor-pointer space-y-2 text-left"
              >
                <RotateCcw className="w-5 h-5 text-[#EC7B38]" />
                <p className="font-bold text-sm text-[#142030]">Re-apply as Tutor</p>
                <p className="text-xs text-[#5E6A79]">Update your application and submit it for another review.</p>
              </button>
              <button
                type="button"
                onClick={() => setAction('switch')}
                className="p-4 bg-white border border-[#E1DED4] rounded-2xl hover:border-[#EC7B38] hover:shadow-md transition-all cursor-pointer space-y-2 text-left"
              >
                <UserCog className="w-5 h-5 text-[#143358]" />
                <p className="font-bold text-sm text-[#142030]">Continue as Student instead</p>
                <p className="text-xs text-[#5E6A79]">Set up a student profile and start learning right away.</p>
              </button>
            </div>

            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center justify-center gap-1.5 w-full text-xs font-semibold text-[#5E6A79] hover:text-red-600 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        )}

        {action && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setAction(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#5E6A79] hover:text-[#142030] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>

            {action === 'reapply' ? (
              <TutorProfileForm profileSetup={profileSetup} submitLabel="Re-submit Application" />
            ) : (
              <StudentProfileForm profileSetup={profileSetup} submitLabel="Continue as Student" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

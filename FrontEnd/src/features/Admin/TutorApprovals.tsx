import React, { useCallback, useEffect, useState } from 'react';
import { Check, GraduationCap, X } from 'lucide-react';
import * as profileService from '../../services/profileService';
import * as adminUsersService from '../../services/adminUsersService';
import { AdminUserStatusList } from './AdminUserStatusList';
import { SidePanel } from '../../ui/SidePanel';
import { Button } from '../../ui/Button';
import { Alert } from '../../ui/Alert';
import { Spinner } from '../../ui/Spinner';
import { useToast } from '../../context/ToastContext';

const viewToggleButtonClassName = (active: boolean) =>
  `px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
    active ? 'bg-white text-[#142030] shadow-2xs' : 'text-[#5E6A79] hover:text-[#142030]'
  }`;

// Master and Support both land here (plan §5's useAdminPanel role filtering); rejection asks
// for a reason via an inline textarea rather than a browser prompt(), matching this app's UI
// conventions elsewhere (e.g. TutorRejectedPage's re-apply flow reads the same reason back).
//
// This screen has two views, toggled locally: "Pending Applications" (the queue below) and
// "All Tutors" (every approved, Role=Tutor account, with an active/inactive toggle --
// AdminUserStatusList).
export const TutorApprovals: React.FC = () => {
  const { showToast } = useToast();
  const [view, setView] = useState<'pending' | 'all'>('pending');
  const [applications, setApplications] = useState<profileService.PendingTutorApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');

  // While one application is being approved/rejected (or its reject-reason panel is open),
  // every other application's actions are locked -- same "one window open at a time" rule as
  // the Master Data tables.
  const isBusy = processingUserId !== null || rejectingUserId !== null;

  const load = useCallback(() => {
    setIsLoading(true);
    profileService
      .getPendingTutorApplications()
      .then((apps) => {
        setApplications(apps);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (userId: string) => {
    setError('');
    setProcessingUserId(userId);
    try {
      await profileService.reviewTutorApplication(userId, { approve: true, rejectionReason: null });
      load();
      showToast({ message: 'Application approved.', variant: 'success' });
    } catch (err) {
      setError(
        err instanceof profileService.ProfileError ? err.message : 'Unable to approve this application. Please try again.'
      );
    } finally {
      setProcessingUserId(null);
    }
  };

  const openReject = (userId: string) => {
    setError('');
    setRejectingUserId(userId);
    setRejectionReason('');
  };

  const confirmReject = async (userId: string) => {
    if (!rejectionReason.trim()) {
      setError('Please provide a reason for rejecting this application.');
      return;
    }
    setError('');
    setProcessingUserId(userId);
    try {
      await profileService.reviewTutorApplication(userId, { approve: false, rejectionReason: rejectionReason.trim() });
      setRejectingUserId(null);
      load();
      showToast({ message: 'Application rejected.', variant: 'success' });
    } catch (err) {
      setError(
        err instanceof profileService.ProfileError ? err.message : 'Unable to reject this application. Please try again.'
      );
    } finally {
      setProcessingUserId(null);
    }
  };

  const pendingContent = isLoading ? (
    <div className="flex items-center justify-center py-12 text-[#5E6A79]">
      <Spinner size="lg" className="mr-2" />
      <span className="text-sm">Loading applications...</span>
    </div>
  ) : applications.length === 0 ? (
    <div className="py-12 text-center text-sm text-[#5E6A79] bg-white border border-[#E1DED4] rounded-2xl">
      No pending tutor applications right now.
    </div>
  ) : (
    <div className="space-y-4">
      {error && !rejectingUserId && <Alert variant="danger">{error}</Alert>}
      {applications.map((app) => (
        <div key={app.userId} className="bg-white border border-[#E1DED4] rounded-2xl shadow-2xs p-5 space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            {/* min-w-0 at both flex levels (matching CourseDiscover.tsx's avatar+text pattern)
                so a long, unbreakable email address shrinks/truncates instead of forcing this
                row wider than the viewport -- flex items default to min-width:auto, which lets
                unbreakable text (no spaces to wrap on) push its ancestors past the container. */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-[#143358]/10 flex items-center justify-center shrink-0">
                <GraduationCap className="w-5 h-5 text-[#143358]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#142030] truncate">
                  {app.firstName} {app.lastName}
                </p>
                <p className="text-xs text-[#5E6A79] truncate">{app.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleApprove(app.userId)}
                disabled={isBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#179765] text-white disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {processingUserId === app.userId ? (
                  <Spinner size="sm" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Approve</span>
              </button>
              <button
                type="button"
                onClick={() => openReject(app.userId)}
                disabled={isBusy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-red-600 text-white disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 text-xs text-[#5E6A79]">
            <p>
              <span className="font-semibold text-[#142030]">Bio: </span>
              {app.profile.bio}
            </p>
            <p>
              <span className="font-semibold text-[#142030]">Qualifications: </span>
              {app.profile.qualifications}
            </p>
          </div>
        </div>
      ))}
    </div>
  );

  const rejectingApp = applications.find((a) => a.userId === rejectingUserId) ?? null;

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1 p-1 bg-[#F3F0E6] rounded-xl">
        <button type="button" onClick={() => setView('pending')} className={viewToggleButtonClassName(view === 'pending')}>
          Pending Applications
        </button>
        <button type="button" onClick={() => setView('all')} className={viewToggleButtonClassName(view === 'all')}>
          All Tutors
        </button>
      </div>

      {view === 'all' ? (
        <AdminUserStatusList fetchUsers={adminUsersService.getTutors} emptyLabel="No approved tutors yet." />
      ) : (
        pendingContent
      )}

      {rejectingApp && (
        <SidePanel
          title={`Reject ${rejectingApp.firstName} ${rejectingApp.lastName}`}
          onClose={() => setRejectingUserId(null)}
          closeOnBackdropClick={false}
          footer={({ requestClose }) => (
            <>
              <Button variant="ghost" size="sm" type="button" onClick={requestClose}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                type="button"
                onClick={() => confirmReject(rejectingApp.userId)}
                disabled={processingUserId === rejectingApp.userId}
              >
                {processingUserId === rejectingApp.userId ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </>
          )}
        >
          <div className="space-y-2">
            {error && <Alert variant="danger">{error}</Alert>}
            <label htmlFor="tutor-rejection-reason" className="block text-xs font-semibold text-[#142030]">
              Reason for rejection
            </label>
            <textarea
              id="tutor-rejection-reason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              placeholder="Explain what's missing so the applicant can improve and re-apply..."
              className="w-full px-3 py-2 bg-white border border-[#E1DED4] rounded-xl text-sm text-[#142030] focus:outline-none focus:ring-2 focus:ring-[#BA5012] resize-none"
            />
          </div>
        </SidePanel>
      )}
    </div>
  );
};

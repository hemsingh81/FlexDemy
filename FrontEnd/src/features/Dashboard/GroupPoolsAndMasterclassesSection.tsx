import React from 'react';
import { Radio, Users } from 'lucide-react';
import { GroupClassRequest, PublicLiveClass } from '../../types';
import { useToast } from '../../context/ToastContext';

interface GroupPoolsAndMasterclassesSectionProps {
  groupRequests: GroupClassRequest[];
  publicClasses: PublicLiveClass[];
  onOpenGroupModal: () => void;
  onSubscribePublicClass: (classId: string) => void;
}

// Extracted from StudentTutorBookingView.tsx: the two-column "Student Group Class Pools" /
// "Public Live Masterclasses" section.
export const GroupPoolsAndMasterclassesSection: React.FC<GroupPoolsAndMasterclassesSectionProps> = ({
  groupRequests,
  publicClasses,
  onOpenGroupModal,
  onSubscribePublicClass,
}) => {
  const { showToast } = useToast();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6 border-t border-slate-200">

      {/* Group Class Pools */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>Student Group Class Pools</span>
          </h3>
          <button
            onClick={onOpenGroupModal}
            className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold transition-all"
          >
            + Request Group Pool
          </button>
        </div>

        <div className="space-y-3">
          {groupRequests.map((req) => (
            <div
              key={req.id}
              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase">
                    {req.courseTitle}
                  </span>
                  <span className="text-xs font-bold text-emerald-600">
                    ${req.ratePerMinute.toFixed(2)}/min per student
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">{req.topic}</h4>
                <p className="text-xs text-slate-500">Requested by: {req.requestedByStudentName}</p>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                <span className="text-slate-600 font-medium">
                  {req.studentPool.length} / {req.maxParticipants} Students Joined
                </span>
                <button
                  onClick={() => showToast({ message: `Joined group pool for ${req.topic}.`, variant: 'success' })}
                  className="px-3 py-1 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Join Pool
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Public Masterclasses */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
          <Radio className="w-5 h-5 text-indigo-600" />
          <span>Public Live Masterclasses</span>
        </h3>

        <div className="space-y-3">
          {publicClasses.map((cls) => (
            <div
              key={cls.id}
              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3"
            >
              <div className="flex items-start space-x-3">
                <img
                  src={cls.tutorAvatar}
                  alt={cls.tutorName}
                  className="w-10 h-10 rounded-xl object-cover border border-slate-200 flex-shrink-0"
                />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{cls.title}</h4>
                  <p className="text-xs text-slate-500">
                    {cls.tutorName} · {cls.scheduledDate} ({cls.scheduledTime})
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 line-clamp-2">{cls.description}</p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-900">
                  ${cls.flatPrice.toFixed(2)} flat rate
                </span>
                <button
                  onClick={() => onSubscribePublicClass(cls.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    cls.isSubscribedByMe
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-[#143358] hover:bg-[#143358]/90 text-white shadow-xs'
                  }`}
                >
                  {cls.isSubscribedByMe ? '✓ Registered' : 'Register Seat'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

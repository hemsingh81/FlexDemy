import React, { useState, useEffect } from 'react';
import { Clock, Video, X, Sparkles, AlertCircle } from 'lucide-react';
import { TutorCalendarSlot } from '../types';

interface AppointmentToastProps {
  bookedSlots: TutorCalendarSlot[];
  onJoinSession?: (slotId: string) => void;
}

export const AppointmentToast: React.FC<AppointmentToastProps> = ({
  bookedSlots,
  onJoinSession,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(2670); // Default ~44m 30s
  const [activeSlot, setActiveSlot] = useState<TutorCalendarSlot | null>(null);

  useEffect(() => {
    // Find slot that is booked
    const upcoming = bookedSlots.find((s) => s.isBooked);
    if (upcoming) {
      setActiveSlot(upcoming);
    } else if (bookedSlots.length > 0) {
      setActiveSlot(bookedSlots[0]);
    }
  }, [bookedSlots]);

  // Ticking countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (isDismissed || !activeSlot) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${minutes}m ${seconds < 10 ? '0' : ''}${seconds}s`;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-slate-900 border-2 border-indigo-500 text-white rounded-2xl shadow-2xl p-4 sm:p-5 animate-slide-up transition-all">
      <div className="flex items-start justify-between gap-3">
        
        <div className="flex items-start space-x-3">
          <div className="relative flex-shrink-0">
            <img
              src={activeSlot.tutorAvatar}
              alt={activeSlot.tutorName}
              className="w-12 h-12 rounded-xl object-cover border-2 border-indigo-400"
            />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-300 text-[10px] font-extrabold uppercase border border-indigo-400/30 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-amber-300" />
                <span>Upcoming Session Alert</span>
              </span>
            </div>

            <h4 className="text-sm font-bold text-white leading-snug">
              1-on-1 Tutoring with {activeSlot.tutorName}
            </h4>

            <p className="text-xs text-indigo-200 line-clamp-1">
              Topic: {activeSlot.topic}
            </p>

            <div className="pt-2 flex items-center space-x-3">
              <div className="bg-indigo-950 px-3 py-1 rounded-xl border border-indigo-500/40 text-amber-300 font-mono text-xs font-bold flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>Starting in {formattedTime}</span>
              </div>

              <button
                onClick={() => onJoinSession?.(activeSlot.id)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center space-x-1.5 transition-all"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Join Room</span>
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          title="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
};

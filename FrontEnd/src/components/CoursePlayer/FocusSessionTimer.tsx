import React, { useState, useEffect } from 'react';
import { Timer, Play, Pause, RotateCcw, Flame, Trophy, X, Sparkles, CheckCircle } from 'lucide-react';

interface FocusSessionTimerProps {
  moduleTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onRewardPoints?: (points: number) => void;
}

export const FocusSessionTimer: React.FC<FocusSessionTimerProps> = ({
  moduleTitle = 'Current Learning Module',
  isOpen,
  onClose,
  onRewardPoints,
}) => {
  const [targetMinutes, setTargetMinutes] = useState<number>(25); // 25 min pomodoro default
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [earnedPoints, setEarnedPoints] = useState<number>(0);
  const [rewardToast, setRewardToast] = useState<string | null>(null);

  // Sync remaining seconds when target changes while stopped
  useEffect(() => {
    if (!isActive) {
      setSecondsLeft(targetMinutes * 60);
    }
  }, [targetMinutes, isActive]);

  // Interval timer effect
  useEffect(() => {
    let interval: any = null;

    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          const next = prev - 1;
          const elapsed = targetMinutes * 60 - next;

          // Award +10 points every 5 minutes (300 seconds)
          if (elapsed > 0 && elapsed % 300 === 0) {
            setEarnedPoints((pts) => pts + 15);
            if (onRewardPoints) onRewardPoints(15);
            setRewardToast('+15 Focus Points Earned!');
            setTimeout(() => setRewardToast(null), 3000);
          }

          if (next === 0) {
            setIsActive(false);
            const bonus = 50;
            setEarnedPoints((pts) => pts + bonus);
            if (onRewardPoints) onRewardPoints(bonus);
            setRewardToast('🎉 Target Reached! +50 Bonus XP Earned!');
            setTimeout(() => setRewardToast(null), 4500);
          }

          return next;
        });
      }, 1000);
    } else if (secondsLeft === 0) {
      setIsActive(false);
    }

    return () => clearInterval(interval);
  }, [isActive, secondsLeft, targetMinutes, onRewardPoints]);

  const totalSeconds = targetMinutes * 60;
  const elapsedSeconds = totalSeconds - secondsLeft;
  const progressRatio = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;

  // SVG ring geometry
  const radius = 42;
  const circumference = 2 * Math.PI * radius; // ~263.89
  const strokeDashoffset = circumference - progressRatio * circumference;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleTogglePlay = () => {
    setIsActive(!isActive);
  };

  const handleReset = () => {
    setIsActive(false);
    setSecondsLeft(targetMinutes * 60);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E1DED4] shadow-2xl p-6 space-y-6 relative overflow-hidden">
        
        {/* Background Decorative Glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-[#EC7B38]/15 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E1DED4] pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded-2xl bg-[#143358] text-white shadow-xs">
              <Timer className="w-5 h-5 text-[#EC7B38]" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#142030]">Focus Session Timer</h3>
              <p className="text-xs text-[#5E6A79] truncate max-w-[220px]">
                {moduleTitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#5E6A79] hover:text-[#142030] rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reward Notification Toast */}
        {rewardToast && (
          <div className="p-3 bg-[#179765] text-white rounded-xl text-xs font-bold text-center flex items-center justify-center space-x-2 animate-bounce shadow-md">
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{rewardToast}</span>
          </div>
        )}

        {/* Target Session Duration Selector */}
        <div className="space-y-2 text-center">
          <span className="text-xs font-bold text-[#5E6A79]">Select Target Session Duration</span>
          <div className="flex items-center justify-center space-x-2">
            {[15, 25, 45, 60].map((mins) => (
              <button
                key={mins}
                onClick={() => {
                  if (!isActive) setTargetMinutes(mins);
                }}
                disabled={isActive}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  targetMinutes === mins
                    ? 'bg-[#143358] text-white border-[#143358] shadow-xs'
                    : 'bg-[#FAF7EC] text-[#142030] border-[#E1DED4] hover:bg-slate-100 disabled:opacity-50'
                }`}
              >
                {mins} Mins
              </button>
            ))}
          </div>
        </div>

        {/* Circular Progress Ring Container */}
        <div className="flex flex-col items-center justify-center py-2 relative">
          <div className="relative w-48 h-48 flex items-center justify-center">
            
            {/* SVG Ring */}
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              {/* Background Ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="text-[#E1DED4]"
                strokeWidth="7"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Animated Progress Ring */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="text-[#EC7B38] transition-all duration-500 ease-out"
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>

            {/* Timer Text Inside Ring */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-1">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-[#142030] tracking-tight">
                {formattedTime}
              </span>
              <span className="text-[11px] font-bold text-[#5E6A79] flex items-center space-x-1">
                <Flame className="w-3.5 h-3.5 text-[#EC7B38] fill-[#EC7B38]" />
                <span>{isActive ? 'Uninterrupted Focus' : 'Ready to Start'}</span>
              </span>
            </div>

          </div>
        </div>

        {/* Earned Points Counter */}
        <div className="flex items-center justify-between p-3.5 bg-[#FAF7EC] rounded-2xl border border-[#E1DED4]">
          <div className="flex items-center space-x-2">
            <Trophy className="w-4 h-4 text-[#EC7B38]" />
            <span className="text-xs font-bold text-[#142030]">Session Points Earned:</span>
          </div>
          <span className="text-sm font-extrabold text-[#179765]">+{earnedPoints} XP</span>
        </div>

        {/* Timer Control Buttons */}
        <div className="flex items-center justify-center space-x-3 pt-2">
          <button
            onClick={handleTogglePlay}
            className={`flex-1 py-3 px-4 rounded-2xl text-xs font-extrabold shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer ${
              isActive
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-[#143358] hover:bg-[#143358]/90 text-white'
            }`}
          >
            {isActive ? (
              <>
                <Pause className="w-4 h-4 fill-white" />
                <span>Pause Focus</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>Start Focus Session</span>
              </>
            )}
          </button>

          <button
            onClick={handleReset}
            className="p-3 bg-[#FAF7EC] hover:bg-slate-200 text-[#142030] border border-[#E1DED4] rounded-2xl cursor-pointer transition-colors"
            title="Reset Timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};

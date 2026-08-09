import React, { useState, useEffect } from 'react';
import { Target, CheckCircle2, TrendingUp, Sparkles, Edit3, Plus, Minus, Trophy, Clock } from 'lucide-react';

interface WeeklyGoalCardProps {
  currentHoursLearned: number; // Current logged hours
}

export const STORAGE_WEEKLY_GOAL_KEY = 'learnsphere_weekly_goal_v1';

export const WeeklyGoalCard: React.FC<WeeklyGoalCardProps> = ({ currentHoursLearned }) => {
  const [weeklyGoalHours, setWeeklyGoalHours] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_WEEKLY_GOAL_KEY);
      return saved ? Math.max(1, parseInt(saved, 10)) : 5;
    } catch (e) {
      return 5;
    }
  });

  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [tempGoal, setTempGoal] = useState<number>(weeklyGoalHours);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_WEEKLY_GOAL_KEY, String(weeklyGoalHours));
    } catch (e) {
      console.error('Failed to save weekly goal to localStorage', e);
    }
  }, [weeklyGoalHours]);

  const handleSaveGoal = () => {
    const validGoal = Math.max(1, Math.min(50, tempGoal));
    setWeeklyGoalHours(validGoal);
    setIsEditing(false);
  };

  const handleQuickAdjust = (delta: number) => {
    const next = Math.max(1, Math.min(50, weeklyGoalHours + delta));
    setWeeklyGoalHours(next);
  };

  const hoursFloat = Number(currentHoursLearned) || 0;
  const rawPercentage = Math.round((hoursFloat / weeklyGoalHours) * 100);
  const displayPercentage = Math.min(100, rawPercentage);
  const isGoalAchieved = rawPercentage >= 100;

  // SVG Progress Ring Parameters
  const radius = 46;
  const circumference = 2 * Math.PI * radius; // ~289.03
  const strokeDashoffset = circumference - (displayPercentage / 100) * circumference;

  return (
    <div className="p-6 rounded-3xl bg-white border border-[#E1DED4] shadow-xs space-y-5 relative overflow-hidden">
      {/* Background Decorative Glow */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-40 h-40 bg-[#EC7B38]/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E1DED4] pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-2xl bg-[#143358] text-white shadow-xs">
            <Target className="w-6 h-6 text-[#EC7B38]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-bold font-display text-[#142030]">
                Weekly Study Goal
              </h3>
              {isGoalAchieved ? (
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#179765]/10 text-[#179765] border border-[#179765]/30 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3 text-[#179765]" />
                  <span>Goal Achieved!</span>
                </span>
              ) : (
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#EC7B38]/10 text-[#EC7B38] border border-[#EC7B38]/30">
                  In Progress
                </span>
              )}
            </div>
            <p className="text-xs text-[#5E6A79] mt-0.5">
              Set custom weekly study target hours & track your learning momentum
            </p>
          </div>
        </div>

        {/* Goal Setter Action */}
        <div className="flex items-center space-x-2">
          {!isEditing ? (
            <button
              type="button"
              onClick={() => {
                setTempGoal(weeklyGoalHours);
                setIsEditing(true);
              }}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#FAF7EC] hover:bg-[#143358] text-[#143358] hover:text-white border border-[#E1DED4] flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#EC7B38]" />
              <span>Adjust Goal ({weeklyGoalHours}h)</span>
            </button>
          ) : (
            <div className="flex items-center space-x-1.5 bg-[#FAF7EC] p-1.5 rounded-xl border border-[#E1DED4]">
              <button
                type="button"
                onClick={() => setTempGoal((prev) => Math.max(1, prev - 1))}
                className="p-1 hover:bg-slate-200 rounded-lg text-[#142030] cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-extrabold px-2 text-[#142030]">{tempGoal} hrs/wk</span>
              <button
                type="button"
                onClick={() => setTempGoal((prev) => Math.min(50, prev + 1))}
                className="p-1 hover:bg-slate-200 rounded-lg text-[#142030] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleSaveGoal}
                className="ml-1 px-2.5 py-1 bg-[#179765] text-white text-[11px] font-extrabold rounded-lg shadow-2xs hover:bg-[#179765]/90 cursor-pointer"
              >
                Save
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Progress Ring + Goal Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        
        {/* Left 1 Column: Circular Progress Ring */}
        <div className="flex flex-col items-center justify-center p-2">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 110 110">
              {/* Background Ring */}
              <circle
                cx="55"
                cy="55"
                r={radius}
                className="text-[#E1DED4]"
                strokeWidth="8"
                stroke="currentColor"
                fill="transparent"
              />
              {/* Animated Progress Ring */}
              <circle
                cx="55"
                cy="55"
                r={radius}
                className={`transition-all duration-700 ease-out ${
                  isGoalAchieved ? 'text-[#179765]' : 'text-[#EC7B38]'
                }`}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
              />
            </svg>

            {/* Inner Ring Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center space-y-0.5">
              <span className="text-2xl font-extrabold font-display text-[#142030]">
                {rawPercentage}%
              </span>
              <span className="text-[10px] font-bold text-[#5E6A79] uppercase tracking-wider">
                Completed
              </span>
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Goal Metrics & Presets */}
        <div className="md:col-span-2 space-y-4">
          
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#FAF7EC] border border-[#E1DED4] space-y-1">
              <span className="text-[11px] text-[#5E6A79] font-medium flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-[#EC7B38]" />
                <span>Current Progress</span>
              </span>
              <p className="text-xl font-extrabold font-display text-[#142030]">
                {hoursFloat.toFixed(1)} <span className="text-xs text-[#5E6A79] font-normal">/ {weeklyGoalHours} hrs</span>
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#FAF7EC] border border-[#E1DED4] space-y-1">
              <span className="text-[11px] text-[#5E6A79] font-medium flex items-center space-x-1">
                <TrendingUp className="w-3.5 h-3.5 text-[#179765]" />
                <span>Hours Remaining</span>
              </span>
              <p className="text-xl font-extrabold font-display text-[#142030]">
                {Math.max(0, weeklyGoalHours - hoursFloat).toFixed(1)} <span className="text-xs text-[#5E6A79] font-normal">hrs</span>
              </p>
            </div>
          </div>

          {/* Quick Target Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#E1DED4]/60">
            <span className="text-xs text-[#5E6A79] font-bold flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-[#EC7B38]" />
              <span>Quick Target Presets:</span>
            </span>

            <div className="flex items-center space-x-1.5">
              {[3, 5, 8, 10, 15].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setWeeklyGoalHours(preset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    weeklyGoalHours === preset
                      ? 'bg-[#143358] text-white border-[#143358] shadow-2xs'
                      : 'bg-[#FAF7EC] text-[#142030] border-[#E1DED4] hover:bg-slate-200'
                  }`}
                >
                  {preset}h
                </button>
              ))}
            </div>
          </div>

          {/* Motivation Banner */}
          {isGoalAchieved ? (
            <div className="p-3 bg-[#179765]/10 border border-[#179765]/30 rounded-2xl flex items-center space-x-2 text-xs text-[#179765] font-bold">
              <Trophy className="w-4 h-4 shrink-0 text-[#179765]" />
              <span>Fantastic job! You reached your weekly target of {weeklyGoalHours} study hours! 🎉</span>
            </div>
          ) : (
            <div className="p-3 bg-[#143358]/5 border border-[#143358]/15 rounded-2xl flex items-center space-x-2 text-xs text-[#143358] font-medium">
              <Sparkles className="w-4 h-4 shrink-0 text-[#EC7B38]" />
              <span>
                Log <span className="font-bold text-[#EC7B38]">{(Math.max(0, weeklyGoalHours - hoursFloat)).toFixed(1)} more hours</span> of lesson reading this week to hit your goal!
              </span>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

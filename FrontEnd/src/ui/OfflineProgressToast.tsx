import React, { useState, useEffect } from 'react';
import { WifiOff, CheckCircle2, Wifi } from 'lucide-react';
import { NETWORK_STATUS_TOAST_DURATION_MS } from '../lib/constants';

interface OfflineProgressToastProps {
  isOfflineOverride?: boolean;
}

export const OfflineProgressToast: React.FC<OfflineProgressToastProps> = ({ isOfflineOverride }) => {
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine || Boolean(isOfflineOverride));
  const [showToast, setShowToast] = useState<boolean>(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true);
      setShowToast(true);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), NETWORK_STATUS_TOAST_DURATION_MS);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    if (!navigator.onLine || isOfflineOverride) {
      setIsOffline(true);
      setShowToast(true);
    }

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [isOfflineOverride]);

  if (!showToast && !isOffline) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-slide-up">
      <div className={`p-4 rounded-2xl border shadow-xl flex items-center space-x-3 transition-all ${
        isOffline
          ? 'bg-[#142030] text-white border-[#143358]'
          : 'bg-[#179765] text-white border-[#179765]'
      }`}>
        <div className={`p-2 rounded-xl ${isOffline ? 'bg-[#BA5012]' : 'bg-white/20'}`}>
          {isOffline ? (
            <WifiOff className="w-5 h-5 text-white" />
          ) : (
            <Wifi className="w-5 h-5 text-white" />
          )}
        </div>

        <div>
          <h4 className="text-xs font-extrabold flex items-center space-x-1.5">
            <span>{isOffline ? 'Offline Mode - Progress saved locally' : 'Back Online - Syncing Course Progress'}</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </h4>
          <p className="text-[11px] text-slate-300 mt-0.5">
            {isOffline
              ? 'You can continue reading & completing lessons smoothly. Saved to device.'
              : 'All cached progress synced with your FlexDemy profile.'}
          </p>
        </div>

        <button
          onClick={() => setShowToast(false)}
          className="ml-2 text-xs font-bold px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

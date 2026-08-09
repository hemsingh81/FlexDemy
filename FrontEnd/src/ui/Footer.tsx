import React from 'react';
import { Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#143358] text-white border-t border-white/10 mt-auto">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-[#EC7B38] flex items-center justify-center text-white shadow-md shadow-[#EC7B38]/30">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold font-display tracking-tight text-white block leading-tight">
              FlexDemy
            </span>
            <span className="text-[10px] font-medium text-slate-300 leading-tight">
              My time. My academy.
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-300">
          © {year} FlexDemy. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

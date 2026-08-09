import React from 'react';
import { Sparkles, BookOpen, Users, Mic, TrendingUp } from 'lucide-react';
import { translate, LanguageCode } from '../../lib/i18n';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  language?: LanguageCode;
  children: React.ReactNode;
}

const FEATURES = [
  { icon: BookOpen, text: '5-level concept drilldowns on every lesson' },
  { icon: Mic, text: 'Auto-scroll narration with adjustable voice & speed' },
  { icon: Users, text: 'Synchronous group study rooms with peers' },
  { icon: TrendingUp, text: 'Weekly goals, streaks, and progress tracking' },
];

// Shared two-column shell for Login / Sign Up / Forgot Password — keeps all three
// auth screens visually consistent (per explicit request) with one place to edit.
export const AuthLayout: React.FC<AuthLayoutProps> = ({ title, subtitle, language, children }) => {
  const t = (key: string) => translate(key, language || 'en');

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#FAF7EC]">
      {/* Left: brand + feature highlights */}
      <div className="relative overflow-hidden lg:w-1/2 bg-[#143358] text-white flex flex-col justify-center px-8 sm:px-12 py-12 lg:py-0">
        {/* Background graphics: soft blurred glows + a faint dot grid, low-opacity per Style Guide elevation rules */}
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#EC7B38]/20 blur-3xl" />
          <div className="absolute top-1/2 -left-32 w-80 h-80 rounded-full bg-[#179765]/10 blur-3xl" />
          <div className="absolute -bottom-32 right-1/4 w-72 h-72 rounded-full bg-[#EC7B38]/10 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(circle, #FFFFFF 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />
        </div>

        <div className="relative z-10 max-w-md mx-auto lg:mx-0 space-y-8">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#EC7B38] flex items-center justify-center shadow-md shadow-[#EC7B38]/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold font-display block leading-tight">{t('app_title')}</span>
              <span className="text-[11px] font-medium text-slate-300 leading-tight">{t('tagline')}</span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold font-display leading-tight">
              Learn on your schedule, at your pace.
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Interactive courses built around how you actually learn.
            </p>
          </div>

          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start space-x-3">
                <div className="p-2 rounded-xl bg-white/10 shrink-0">
                  <Icon className="w-4 h-4 text-[#EC7B38]" />
                </div>
                <span className="text-sm text-slate-200 pt-1.5">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right: the form */}
      <div className="lg:w-1/2 flex flex-col justify-center items-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5 text-center lg:text-left">
            <h2 className="text-2xl font-bold font-display text-[#142030]">{title}</h2>
            <p className="text-sm text-[#5E6A79]">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Award,
  Trophy,
  Flame,
  CheckCircle2,
  Download,
  Printer,
  Sparkles,
  BarChart2,
  Share2,
} from 'lucide-react';
import { UserProfile, Course, LeaderboardUser } from '../types';
import confetti from 'canvas-confetti';

interface ProgressAndCertificateProps {
  user: UserProfile;
  courses: Course[];
  leaderboard: LeaderboardUser[];
  userLanguage: string;
}

export const ProgressAndCertificate: React.FC<ProgressAndCertificateProps> = ({
  user,
  courses,
  leaderboard,
  userLanguage,
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses?.[0]?.id || '');
  const [forceUnlockedForDemo, setForceUnlockedForDemo] = useState<boolean>(false);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || courses?.[0];

  // Calculate real course completion rate
  const allLessons = selectedCourse ? selectedCourse.modules.flatMap((m) => m.lessons) : [];
  const completedLessons = allLessons.filter((l) => l.isCompleted).length;
  const totalLessons = allLessons.length;
  const realCompletionPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
  
  const is100PercentCompleted = forceUnlockedForDemo || realCompletionPercentage === 100;
  const displayPercentage = forceUnlockedForDemo ? 100 : realCompletionPercentage;

  const handleDownloadPDF = () => {
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#143358', '#EC7B38', '#179765', '#F59E0B', '#3B82F6'],
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Certificate_of_Completion_${user.name.replace(/\s+/g, '_')}</title>
          <style>
            @page { size: A4 landscape; margin: 0; }
            body {
              margin: 0;
              padding: 40px;
              font-family: 'Georgia', serif;
              background: #143358;
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              box-sizing: border-box;
            }
            .cert-container {
              border: 8px double #EC7B38;
              padding: 45px 60px;
              text-align: center;
              background: linear-gradient(180deg, #143358 0%, #0d223c 100%);
              border-radius: 20px;
              width: 90%;
              max-width: 900px;
              box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            }
            .academy-title {
              font-size: 14px;
              letter-spacing: 4px;
              text-transform: uppercase;
              color: #EC7B38;
              font-weight: bold;
              margin-bottom: 12px;
            }
            .main-title {
              font-size: 40px;
              font-weight: bold;
              color: #ffffff;
              margin: 10px 0 25px 0;
              font-family: 'Times New Roman', serif;
            }
            .recipient-label {
              font-size: 13px;
              text-transform: uppercase;
              color: #E1DED4;
              letter-spacing: 2px;
            }
            .student-name {
              font-size: 38px;
              font-weight: bold;
              color: #EC7B38;
              margin: 15px 0;
              border-bottom: 2px solid rgba(236,123,56,0.6);
              display: inline-block;
              padding-bottom: 8px;
            }
            .course-name {
              font-size: 22px;
              font-weight: bold;
              color: #ffffff;
              margin: 15px 0;
            }
            .details {
              font-size: 14px;
              color: #E1DED4;
              line-height: 1.6;
              margin: 20px auto;
              max-width: 650px;
            }
            .footer {
              margin-top: 40px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              padding-top: 20px;
              border-top: 1px solid rgba(255,255,255,0.2);
              text-align: left;
            }
            .signature-title {
              font-size: 11px;
              color: #E1DED4;
            }
            .sig-line {
              font-family: 'Brush Script MT', cursive, sans-serif;
              font-size: 24px;
              color: #EC7B38;
            }
            .verify-badge {
              font-family: monospace;
              font-size: 12px;
              background: rgba(255,255,255,0.1);
              padding: 6px 14px;
              border-radius: 20px;
              border: 1px solid rgba(255,255,255,0.2);
            }
          </style>
        </head>
        <body>
          <div class="cert-container">
            <div class="academy-title">LEARNSPHERE INTERNATIONAL ACADEMY</div>
            <div class="main-title">Certificate of Completion</div>
            <div class="recipient-label">This is to proudly certify that</div>
            <div class="student-name">${user.name}</div>
            <div class="details">
              has successfully mastered 100% of the course modules, 5-level deep explanations, and practical assessments for:
            </div>
            <div class="course-name">"${selectedCourse.title}"</div>
            <div class="footer">
              <div>
                <div class="sig-line">${selectedCourse.instructor.name}</div>
                <div class="signature-title">${selectedCourse.instructor.role}</div>
              </div>
              <div class="verify-badge">VERIFIED ID: LS-2026-${Math.floor(100000 + Math.random() * 900000)}</div>
              <div style="text-align: right;">
                <div style="font-size: 12px; font-weight: bold;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                <div class="signature-title">Date of Completion</div>
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="w-full space-y-8 pb-12">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center space-x-3">
          <Award className="w-8 h-8 text-indigo-600" />
          <span>Certificates & Global Leaderboard</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Verify course completion certificates and view weekly competitive rankings.
        </p>
      </div>

      {/* Main Grid: Certificate Generator vs Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2/3): Certificate Preview Canvas */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Course Selector for Certificate */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Certificate of Completion
            </h2>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 shadow-xs"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Course Completion Progress Bar */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700 flex items-center space-x-1.5">
                <BarChart2 className="w-4 h-4 text-indigo-600" />
                <span>Course Completion Progress:</span>
              </span>
              <span className={is100PercentCompleted ? 'text-emerald-600 font-extrabold' : 'text-indigo-600 font-extrabold'}>
                {displayPercentage}% {is100PercentCompleted ? '— Certificate Unlocked! 🎉' : `(${completedLessons}/${totalLessons} Lessons)`}
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-500 ${
                  is100PercentCompleted ? 'bg-emerald-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${displayPercentage}%` }}
              />
            </div>

            {!is100PercentCompleted && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-slate-500">
                  Reach 100% completion to unlock your official printable certificate.
                </p>
                <button
                  onClick={() => setForceUnlockedForDemo(true)}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                >
                  Unlock Certificate (Demo 100%)
                </button>
              </div>
            )}
          </div>

          {/* Framed Certificate Canvas */}
          <div className="relative p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-indigo-900 via-indigo-950 to-slate-950 text-white border-2 border-indigo-400/40 shadow-xl space-y-8 overflow-hidden text-center">
            
            {/* Background Watermark SVG */}
            <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
              <Award className="w-96 h-96 text-indigo-300" />
            </div>

            <div className="space-y-2 relative z-10">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-lg">
                LS
              </div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-300">
                LearnSphere International Academy
              </p>
              <h3 className="text-3xl sm:text-4xl font-serif font-extrabold text-indigo-100 tracking-tight">
                Certificate of Completion
              </h3>
            </div>

            <div className="space-y-2 relative z-10 max-w-lg mx-auto">
              <p className="text-xs text-indigo-200 uppercase tracking-wider">This is to certify that</p>
              <p className="text-2xl sm:text-3xl font-extrabold text-white border-b border-indigo-400/40 pb-2">
                {user.name}
              </p>
              <p className="text-xs text-indigo-200 leading-relaxed pt-2">
                has successfully mastered all modules, 5-level deep explanations, and practical assessments for
              </p>
              <p className="text-lg font-bold text-amber-300">
                "{selectedCourse.title}"
              </p>
            </div>

            <div className="pt-6 border-t border-indigo-500/30 flex items-center justify-between text-xs text-indigo-200 relative z-10">
              <div className="text-left">
                <p className="font-bold text-white">{selectedCourse.instructor.name}</p>
                <p className="text-[10px] text-indigo-200">{selectedCourse.instructor.role}</p>
              </div>
              <div>
                <span className="text-[10px] px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 font-mono">
                  VERIFIED ID: LS-2026-88219
                </span>
              </div>
            </div>

          </div>

          {/* Export Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {is100PercentCompleted
                ? 'Official Verified Certificate ready for high-resolution printing & PDF export.'
                : 'Complete 100% of the course modules to unlock your official PDF Certificate.'}
            </span>

            <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
              <button
                onClick={handleDownloadPDF}
                disabled={!is100PercentCompleted}
                className={`px-5 py-2.5 font-bold text-xs rounded-xl flex items-center space-x-2 transition-all shadow-md cursor-pointer ${
                  is100PercentCompleted
                    ? 'bg-[#143358] hover:bg-[#143358]/90 text-white shadow-[#143358]/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                <Download className="w-4 h-4 text-[#EC7B38]" />
                <span>Download PDF Certificate</span>
              </button>

              <button
                onClick={handleDownloadPDF}
                disabled={!is100PercentCompleted}
                className={`px-4 py-2.5 font-bold text-xs rounded-xl flex items-center space-x-2 transition-all border cursor-pointer ${
                  is100PercentCompleted
                    ? 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                }`}
              >
                <Printer className="w-4 h-4 text-indigo-600" />
                <span>Print</span>
              </button>
            </div>
          </div>

        </div>

        {/* Right Column (1/3): Global Competitive Leaderboard */}
        <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 border border-amber-200">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Weekly Leaderboard</h3>
              <p className="text-xs text-slate-500">Top learners this week</p>
            </div>
          </div>

          <div className="space-y-3">
            {leaderboard.map((userRow) => (
              <div
                key={userRow.rank}
                className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                  userRow.rank === 1
                    ? 'bg-amber-50/60 border-amber-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-extrabold text-[10px] ${
                    userRow.rank === 1 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    #{userRow.rank}
                  </span>
                  <img
                    src={userRow.avatar}
                    alt={userRow.name}
                    className="w-8 h-8 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <p className="font-bold text-slate-900">{userRow.name}</p>
                    <p className="text-[10px] text-slate-500">{userRow.badge}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-extrabold text-indigo-600">{userRow.points} pts</p>
                  <p className="text-[10px] text-amber-600 font-medium">🔥 {userRow.streakDays}d streak</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};

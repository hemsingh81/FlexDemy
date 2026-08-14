import React from 'react';
import { BarChart2 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

// Mock analytics data for Recharts -- extracted from TutorEducatorHubView.tsx unchanged.
const ANALYTICS_DATA = [
  { month: 'Mar', earnings: 1200, hours: 24, students: 45 },
  { month: 'Apr', earnings: 1850, hours: 32, students: 62 },
  { month: 'May', earnings: 2400, hours: 41, students: 88 },
  { month: 'Jun', earnings: 3100, hours: 50, students: 110 },
  { month: 'Jul', earnings: 3900, hours: 58, students: 142 },
  { month: 'Aug', earnings: 4650, hours: 64, students: 175 },
];

// Local chart theme for this component's own bar chart -- kept self-contained rather than
// imported from Admin/AiConfiguration/AiUsageChart.tsx (which itself was styled to match this
// chart originally); the two are independent call sites and shouldn't be coupled.
const CHART_THEME = {
  gridStroke: '#E1DED4',
  axisTick: { fontSize: 12, fill: '#5E6A79' },
  tooltipStyle: { backgroundColor: '#143358', borderRadius: '12px', color: '#fff', border: 'none' },
  earningsFill: '#143358',
  hoursFill: '#BA5012',
};

// Extracted from TutorEducatorHubView.tsx: the "Earnings & Teaching Analytics" Recharts bar
// chart section.
export const TeachingAnalyticsChart: React.FC = () => {
  return (
    <div className="p-6 rounded-3xl bg-white border border-[#E1DED4] shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold font-display text-[#142030] flex items-center space-x-2">
            <BarChart2 className="w-5 h-5 text-[#143358]" />
            <span>Earnings & Teaching Analytics</span>
          </h3>
          <p className="text-xs text-[#5E6A79]">Monthly revenue growth and student engagement index.</p>
        </div>
        <span className="text-xs font-bold text-[#142030] bg-[#FAF7EC] border border-[#E1DED4] px-3 py-1 rounded-xl">
          2026 Analytics
        </span>
      </div>

      <div className="h-72 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ANALYTICS_DATA}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_THEME.gridStroke} />
            <XAxis dataKey="month" tick={CHART_THEME.axisTick} />
            <YAxis tick={CHART_THEME.axisTick} />
            <Tooltip contentStyle={CHART_THEME.tooltipStyle} />
            <Legend />
            <Bar dataKey="earnings" name="Monthly Revenue ($)" fill={CHART_THEME.earningsFill} radius={[6, 6, 0, 0]} />
            <Bar dataKey="hours" name="Teaching Hours" fill={CHART_THEME.hoursFill} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

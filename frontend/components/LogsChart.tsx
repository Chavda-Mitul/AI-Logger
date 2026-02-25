/**
 * Bar chart showing logs per day for the last 30 days.
 * Uses Recharts.
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import type { DailyCount } from '../lib/api';

interface Props {
  data: DailyCount[];
}

export default function LogsChart({ data }: Props) {
  const formatted = data.map((d) => ({
    date:  format(parseISO(d.date), 'MMM d'),
    count: d.count,
  }));

  if (formatted.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No data yet. Start logging to see your chart.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            fontSize: '12px',
          }}
          cursor={{ fill: '#f3f4f6' }}
        />
        <Bar dataKey="count" fill="#4f6ef7" radius={[4, 4, 0, 0]} name="Logs" />
      </BarChart>
    </ResponsiveContainer>
  );
}

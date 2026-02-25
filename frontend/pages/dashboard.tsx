import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Layout from '../components/Layout';
import StatsCard from '../components/StatsCard';
import { dashboardApi, type DashboardStats, type DailyCount } from '../lib/api';
import { getUser } from '../lib/auth';

// Recharts uses browser APIs — load client-side only
const LogsChart = dynamic(() => import('../components/LogsChart'), { ssr: false });

interface User {
  api_key: string;
  email: string;
  plan: string;
}

export default function DashboardPage() {
  const [stats, setStats]       = useState<DashboardStats | null>(null);
  const [counts, setCounts]     = useState<DailyCount[]>([]);
  const [loading, setLoading]   = useState(true);
  const [copied, setCopied]     = useState(false);
  const user = getUser<User>();

  useEffect(() => {
    async function load() {
      try {
        const [s, c] = await Promise.all([
          dashboardApi.stats(),
          dashboardApi.dailyCounts(),
        ]);
        setStats(s);
        setCounts(c);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function copyApiKey() {
    if (!user?.api_key) return;
    navigator.clipboard.writeText(user.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const usagePct = stats
    ? Math.min(100, Math.round((stats.logs_used_this_month / stats.plan_limit) * 100))
    : 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Overview of your AI interaction logs
          </p>
        </div>

        {/* Stats grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse h-24 bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatsCard
              title="Total Logs"
              value={stats?.total_logs.toLocaleString() ?? '0'}
              subtitle="All time"
              accent
            />
            <StatsCard
              title="Logs This Month"
              value={stats?.logs_used_this_month.toLocaleString() ?? '0'}
              subtitle={`of ${stats?.plan_limit.toLocaleString()} limit`}
            />
            <StatsCard
              title="Plan"
              value={stats?.plan === 'pro' ? 'Pro' : 'Free'}
              subtitle={stats?.plan === 'pro' ? '$29/month · 50k logs' : '1,000 logs/month'}
            />
          </div>
        )}

        {/* Usage bar */}
        {stats && (
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Monthly Usage</p>
              <p className="text-sm text-gray-500">{usagePct}%</p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  usagePct >= 90 ? 'bg-red-500' : usagePct >= 70 ? 'bg-yellow-400' : 'bg-brand-500'
                }`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {stats.logs_used_this_month.toLocaleString()} / {stats.plan_limit.toLocaleString()} logs used
            </p>
          </div>
        )}

        {/* Chart */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Logs per Day (last 30 days)
          </h2>
          <LogsChart data={counts} />
        </div>

        {/* API Key */}
        {user?.api_key && (
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Your API Key</h2>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-700 truncate">
                {user.api_key}
              </code>
              <button className="btn-secondary text-xs shrink-0" onClick={copyApiKey}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Pass this key in the <code className="bg-gray-100 px-1 rounded">x-api-key</code> header when using the SDK.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

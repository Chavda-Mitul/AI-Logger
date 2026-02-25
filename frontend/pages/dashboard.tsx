import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Layout from '../components/Layout';
import StatsCard from '../components/StatsCard';
import { dashboardApi, projectsApi, type DashboardStats, type DailyCount, type Project } from '../lib/api';
import { getUser } from '../lib/auth';

// Recharts uses browser APIs — load client-side only
const LogsChart = dynamic(() => import('../components/LogsChart'), { ssr: false });

interface User {
  email: string;
  name?: string;
  orgId: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [counts, setCounts] = useState<DailyCount[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const user = getUser<User>();

  useEffect(() => {
    async function load() {
      try {
        const { projects: projectList } = await projectsApi.list();
        setProjects(projectList);

        if (projectList.length > 0 && !selectedProjectId) {
          setSelectedProjectId(projectList[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;

    async function loadStats() {
      try {
        const [s, c] = await Promise.all([
          dashboardApi.stats(selectedProjectId),
          dashboardApi.dailyCounts(selectedProjectId),
        ]);
        setStats(s);
        setCounts(c);
      } catch (err) {
        console.error(err);
      }
    }
    loadStats();
  }, [selectedProjectId]);

  const riskTierColors: Record<string, string> = {
    PROHIBITED: 'bg-red-600',
    HIGH: 'bg-orange-500',
    LIMITED: 'bg-yellow-500',
    MINIMAL: 'bg-green-500',
  };

  const riskTierLabels: Record<string, string> = {
    PROHIBITED: 'Prohibited',
    HIGH: 'High Risk',
    LIMITED: 'Limited Risk',
    MINIMAL: 'Minimal Risk',
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">
              EU AI Act compliance overview
            </p>
          </div>

          {/* Project selector */}
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Stats grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card animate-pulse h-24 bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatsCard
              title="Total Logs"
              value={stats?.total_logs.toLocaleString() ?? '0'}
              subtitle="All time"
              accent
            />
            <StatsCard
              title="Human Review Rate"
              value={stats ? `${(stats.human_review_rate * 100).toFixed(1)}%` : '0%'}
              subtitle={`${stats?.human_reviewed_count?.toLocaleString() ?? 0} reviewed`}
            />
            <StatsCard
              title="Risk Tier"
              value={riskTierLabels[stats?.project.risk_tier || 'MINIMAL'] || 'Unset'}
              subtitle={stats?.project.risk_tier || 'Not classified'}
              color={riskTierColors[stats?.project.risk_tier || 'MINIMAL']}
            />
            <StatsCard
              title="Compliance Score"
              value={stats?.project.compliance_score?.toString() ?? '0'}
              subtitle="out of 100"
            />
          </div>
        )}

        {/* Quick stats row */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="card text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.logs_today.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Logs today</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.logs_this_week.toLocaleString()}</p>
              <p className="text-xs text-gray-500">This week</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.avg_latency_ms ?? 0}ms</p>
              <p className="text-xs text-gray-500">Avg latency</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-gray-900">{(stats.error_rate * 100).toFixed(1)}%</p>
              <p className="text-xs text-gray-500">Error rate</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-gray-900">{stats.unread_alerts}</p>
              <p className="text-xs text-gray-500">Unread alerts</p>
            </div>
          </div>
        )}

        {/* Chart */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Logs per Day (last 30 days)
          </h2>
          <LogsChart data={counts} />
        </div>

        {/* Compliance status */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Compliance Documents</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="font-medium">{stats.documents_created}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Finalized</span>
                  <span className="font-medium">{stats.documents_finalized}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Model Changes</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">This month</span>
                  <span className="font-medium">{stats.model_changes_this_month}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

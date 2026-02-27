import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Layout from '../components/Layout';
import StatsCard from '../components/StatsCard';
import { dashboardApi, projectsApi, assessmentsApi, documentsApi, type DashboardStats, type DailyCount, type Project, type Assessment, type ComplianceDocument } from '../lib/api';

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
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [loading, setLoading] = useState(true);

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

    async function loadProjectData() {
      try {
        const [s, c, assoc, docs] = await Promise.all([
          dashboardApi.stats(selectedProjectId),
          dashboardApi.dailyCounts(selectedProjectId),
          assessmentsApi.getByProject(selectedProjectId).catch(() => ({ assessment: null })),
          documentsApi.listByProject(selectedProjectId).catch(() => ({ documents: [] })),
        ]);
        setStats(s);
        setCounts(c.daily_counts || []);
        setAssessment(assoc.assessment);
        setDocuments(docs.documents);
      } catch (err) {
        console.error(err);
      }
    }
    loadProjectData();
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

  const urgencyColors: Record<string, string> = {
    immediate: 'bg-red-500',
    '3_months': 'bg-orange-500',
    '6_months': 'bg-yellow-500',
  };

  // Calculate document completion
  const requiredDocs = assessment?.documents_required || [];
  const completedDocs = documents.filter(d => d.status === 'final').length;
  const docProgress = requiredDocs.length > 0 ? Math.round((completedDocs / requiredDocs.length) * 100) : 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">
              EU AI Act compliance overview for your AI systems
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

        {/* No project selected */}
        {!selectedProjectId && !loading && (
          <div className="card text-center py-12">
            <p className="text-gray-500">No projects found. Create a project to get started.</p>
          </div>
        )}

        {/* Compliance Score Card - Main Focus */}
        {assessment && selectedProjectId && (
          <div className="card bg-gradient-to-r from-brand-50 to-blue-50 border-brand-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-brand-600 mb-1">Compliance Score</p>
                <p className="text-4xl font-bold text-brand-700">
                  {assessment.compliance_score}
                  <span className="text-lg text-brand-500">/100</span>
                </p>
                <p className="text-sm text-brand-600 mt-2">
                  Risk Tier: <span className={`inline-block px-2 py-0.5 rounded text-white text-xs font-medium ${riskTierColors[assessment.risk_tier]}`}>
                    {riskTierLabels[assessment.risk_tier]}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-brand-600">Action Required</p>
                {assessment.urgency && (
                  <span className={`inline-block px-3 py-1 rounded text-white text-sm font-medium ${urgencyColors[assessment.urgency]}`}>
                    {assessment.urgency === 'immediate' ? 'Immediately' : `Within ${assessment.urgency.replace('_', ' ')}`}
                  </span>
                )}
                {assessment.estimated_effort && (
                  <p className="text-xs text-brand-500 mt-2">Est. effort: {assessment.estimated_effort}</p>
                )}
              </div>
            </div>
          </div>
        )}

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
            />
            <StatsCard
              title="Compliance Score"
              value={stats?.project.compliance_score?.toString() ?? '0'}
              subtitle="out of 100"
            />
          </div>
        )}

        {/* Obligations Section */}
        {assessment?.obligations && selectedProjectId && (
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Your Compliance Obligations</h2>
            <div className="space-y-3">
              {Object.entries(assessment.obligations).map(([key, value]: [string, any]) => (
                <div key={key} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-2 h-2 rounded-full mt-2 ${value.required ? 'bg-red-500' : 'bg-green-500'}`} />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{value.title || key}</p>
                    <p className="text-xs text-gray-500 mt-1">{value.description}</p>
                    {value.deadline && (
                      <p className="text-xs text-orange-600 mt-1">Deadline: {value.deadline}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${value.required ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {value.required ? 'Required' : 'Recommended'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents Progress */}
        {selectedProjectId && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Required Documents</h2>
              <span className="text-sm text-gray-500">
                {completedDocs} of {requiredDocs.length} completed
              </span>
            </div>
            
            {requiredDocs.length > 0 ? (
              <>
                <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                  <div
                    className="h-2 rounded-full bg-brand-500 transition-all"
                    style={{ width: `${docProgress}%` }}
                  />
                </div>
                <div className="space-y-2">
                  {requiredDocs.map((docType: string) => {
                    const existingDoc = documents.find(d => d.document_type === docType);
                    return (
                      <div key={docType} className="flex items-center justify-between p-2 border border-gray-100 rounded">
                        <span className="text-sm text-gray-700">{docType.replace(/_/g, ' ')}</span>
                        {existingDoc ? (
                          <span className={`text-xs px-2 py-1 rounded ${
                            existingDoc.status === 'final' ? 'bg-green-100 text-green-700' :
                            existingDoc.status === 'review' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {existingDoc.status}
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Missing</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">Complete an assessment to see required documents.</p>
            )}
            
            <div className="mt-4 pt-4 border-t border-gray-100">
              <a href={`/documents?project=${selectedProjectId}`} className="text-sm text-brand-600 hover:text-brand-700">
                Manage Documents →
              </a>
            </div>
          </div>
        )}

        {/* Quick stats row */}
        {stats && selectedProjectId && (
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
        {counts.length > 0 && selectedProjectId && (
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Logs per Day (last 30 days)
            </h2>
            <LogsChart data={counts} />
          </div>
        )}

        {/* No assessment yet */}
        {!assessment && selectedProjectId && !loading && (
          <div className="card bg-yellow-50 border-yellow-200">
            <h3 className="text-sm font-semibold text-yellow-800 mb-2">Complete Your Risk Assessment</h3>
            <p className="text-sm text-yellow-700 mb-4">
              To see your compliance score and obligations, complete the EU AI Act risk assessment.
            </p>
            <a href="/assessment" className="btn-primary text-sm">
              Start Assessment
            </a>
          </div>
        )}
      </div>
    </Layout>
  );
}

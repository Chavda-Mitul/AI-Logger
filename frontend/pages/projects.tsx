import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { projectsApi, type Project } from '../lib/api';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const { projects: list } = await projectsApi.list();
      setProjects(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');

    try {
      const { project } = await projectsApi.create(newName, newDesc);
      setProjects([...projects, project]);
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this project? All logs will be lost.')) return;

    try {
      await projectsApi.delete(id);
      setProjects(projects.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  const riskTierColors: Record<string, string> = {
    PROHIBITED: 'bg-red-100 text-red-700',
    HIGH: 'bg-orange-100 text-orange-700',
    LIMITED: 'bg-yellow-100 text-yellow-700',
    MINIMAL: 'bg-green-100 text-green-700',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-700',
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage your AI systems and compliance projects
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-primary"
          >
            + New Project
          </button>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Create New Project</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="input w-full"
                    placeholder="e.g., Customer Support Bot"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optional)
                  </label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="input w-full h-20"
                    placeholder="Brief description of the AI system"
                  />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={creating}>
                    {creating ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Projects list */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse h-20 bg-gray-100" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500">No projects yet. Create your first project to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {projects.map((project) => (
              <div key={project.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                      {project.risk_tier && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${riskTierColors[project.risk_tier] || 'bg-gray-100 text-gray-700'}`}>
                          {project.risk_tier}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[project.status] || 'bg-gray-100 text-gray-700'}`}>
                        {project.status}
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Created {new Date(project.created_at).toLocaleDateString()}
                      {project.total_logs !== undefined && ` • ${project.total_logs.toLocaleString()} logs`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a href={`/projects/${project.id}`} className="btn-secondary text-sm">
                      View
                    </a>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

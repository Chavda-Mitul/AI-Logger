import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { projectsApi, type Project } from '../lib/api';

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export default function ApiKeysPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showKey, setShowKey] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadApiKeys(selectedProjectId);
    }
  }, [selectedProjectId]);

  async function loadProjects() {
    try {
      const { projects: list } = await projectsApi.list();
      setProjects(list);
      if (list.length > 0) {
        setSelectedProjectId(list[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadApiKeys(projectId: string) {
    try {
      const { api_keys } = await projectsApi.listApiKeys(projectId);
      setApiKeys(api_keys);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProjectId) return;

    setCreating(true);
    try {
      const result = await projectsApi.createApiKey(selectedProjectId, newKeyName || undefined);
      setShowKey(result.raw_key);
      setNewKeyName('');
      loadApiKeys(selectedProjectId);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) return;

    try {
      await projectsApi.revokeApiKey(keyId);
      if (selectedProjectId) {
        loadApiKeys(selectedProjectId);
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage API keys for your projects
          </p>
        </div>

        {/* Project selector */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Project:</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white max-w-xs"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Create new key */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Create New API Key</h2>
          <form onSubmit={handleCreate} className="flex gap-3 items-end">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs text-gray-500 mb-1">Key Name (optional)</label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="input w-full"
                placeholder="e.g., Production"
              />
            </div>
            <button type="submit" className="btn-primary" disabled={creating || !selectedProjectId}>
              {creating ? 'Creating...' : 'Generate Key'}
            </button>
          </form>
        </div>

        {/* Show newly created key */}
        {showKey && (
          <div className="card bg-green-50 border-green-200">
            <h3 className="text-sm font-semibold text-green-800 mb-2">⚠️ New API Key Created</h3>
            <p className="text-xs text-green-700 mb-2">
              Copy this key now. You won't be able to see it again!
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white border border-green-200 rounded px-3 py-2 text-sm font-mono text-gray-700">
                {showKey}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(showKey)}
                className="btn-secondary text-xs"
              >
                Copy
              </button>
              <button
                onClick={() => setShowKey(null)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* API Keys list */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Active API Keys</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-16 bg-gray-100 rounded" />
              ))}
            </div>
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              No API keys for this project. Create one to get started.
            </p>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">
                      {key.name || 'Unnamed Key'}
                    </p>
                    <p className="text-sm text-gray-500 font-mono">
                      {key.key_prefix}...
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Created {new Date(key.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      key.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {key.is_active ? 'Active' : 'Revoked'}
                    </span>
                    {key.is_active && (
                      <button
                        onClick={() => handleRevoke(key.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage instructions */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-3">How to Use</h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>Include your API key in the <code className="bg-gray-100 px-1 rounded">x-api-key</code> header when making requests:</p>
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
{`// Node.js
const response = await fetch('https://api.regulateai.io/ingest/logs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key',
    'x-project-id': 'your-project-id'
  },
  body: JSON.stringify({ logs: [...] })
});

// Python
import requests
requests.post(
    'https://api.regulateai.io/ingest/logs',
    headers={
        'x-api-key': 'your-api-key',
        'x-project-id': 'your-project-id'
    },
    json={'logs': [...]}
)`}
            </pre>
          </div>
        </div>
      </div>
    </Layout>
  );
}

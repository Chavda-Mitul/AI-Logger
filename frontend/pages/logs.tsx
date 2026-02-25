import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import LogsTable from '../components/LogsTable';
import { projectsApi, type Project } from '../lib/api';

export default function LogsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  useEffect(() => {
    async function load() {
      try {
        const { projects: list } = await projectsApi.list();
        setProjects(list);
        if (list.length > 0) {
          setSelectedProjectId(list[0].id);
        }
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, []);

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
            <p className="text-gray-500 text-sm mt-1">
              Browse, filter, and export your AI interaction logs
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

        {selectedProjectId ? (
          <LogsTable projectId={selectedProjectId} />
        ) : (
          <div className="card text-center py-12">
            <p className="text-gray-500">No projects found. Create a project first.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}

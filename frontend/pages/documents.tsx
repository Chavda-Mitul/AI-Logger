import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { projectsApi, documentsApi, type Project, type ComplianceDocument } from '../lib/api';

export default function DocumentsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [newDoc, setNewDoc] = useState({
    document_type: 'technical_doc',
    title: '',
    content: {},
    status: 'draft',
  });

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
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;

    async function loadDocs() {
      try {
        const { documents: docs } = await documentsApi.listByProject(selectedProjectId);
        setDocuments(docs);
      } catch (err) {
        console.error(err);
      }
    }
    loadDocs();
  }, [selectedProjectId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;

    setCreating(true);
    try {
      const { document } = await documentsApi.create(selectedProjectId, newDoc);
      setDocuments([...documents, document]);
      setShowCreate(false);
      setNewDoc({ document_type: 'technical_doc', title: '', content: {}, status: 'draft' });
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (docId: string, status: string) => {
    try {
      await documentsApi.update(docId, { status });
      setDocuments(documents.map(d => d.id === docId ? { ...d, status: status as any } : d));
    } catch (err) {
      console.error(err);
    }
  };

  const documentTypeLabels: Record<string, string> = {
    technical_doc: 'Technical Documentation',
    risk_plan: 'Risk Management Plan',
    bias_assessment: 'Bias Assessment',
    human_oversight: 'Human Oversight Document',
    data_governance: 'Data Governance Policy',
    declaration_conformity: 'Declaration of Conformity',
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    review: 'bg-yellow-100 text-yellow-700',
    final: 'bg-green-100 text-green-700',
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Compliance Documents</h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage your EU AI Act compliance documentation
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

        {/* Create new document */}
        <div className="card">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            {showCreate ? '− Cancel' : '+ Create New Document'}
          </button>

          {showCreate && (
            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Document Type
                  </label>
                  <select
                    value={newDoc.document_type}
                    onChange={(e) => setNewDoc({ ...newDoc, document_type: e.target.value })}
                    className="input w-full"
                  >
                    {Object.entries(documentTypeLabels).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={newDoc.title}
                    onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
                    className="input w-full"
                    placeholder="Document title"
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create Document'}
              </button>
            </form>
          )}
        </div>

        {/* Documents list */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse h-20 bg-gray-100" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500">No documents yet. Create your first compliance document.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {documents.map((doc) => (
              <div key={doc.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900">{doc.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[doc.status]}`}>
                        {doc.status}
                      </span>
                      <span className="text-xs text-gray-500">v{doc.version}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {documentTypeLabels[doc.document_type] || doc.document_type}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Created {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={doc.status}
                      onChange={(e) => handleStatusChange(doc.id, e.target.value)}
                      className="text-sm border border-gray-200 rounded px-2 py-1"
                    >
                      <option value="draft">Draft</option>
                      <option value="review">Review</option>
                      <option value="final">Final</option>
                    </select>
                    <a
                      href={`/documents/${doc.id}`}
                      className="btn-secondary text-sm"
                    >
                      Edit
                    </a>
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

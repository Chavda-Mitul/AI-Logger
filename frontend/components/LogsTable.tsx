/**
 * Paginated logs table with filters.
 */
import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { logsApi, type Log, type LogFilters } from '../lib/api';

export default function LogsTable() {
  const [logs, setLogs]         = useState<Log[]>([]);
  const [total, setTotal]       = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [selected, setSelected] = useState<Log | null>(null);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [model, setModel]       = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]   = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const filters: LogFilters = { page, limit: 20 };
      if (search)    filters.search    = search;
      if (model)     filters.model     = model;
      if (startDate) filters.startDate = startDate;
      if (endDate)   filters.endDate   = endDate;

      const res = await logsApi.list(filters);
      setLogs(res.data);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load logs.');
    } finally {
      setLoading(false);
    }
  }, [page, search, model, startDate, endDate]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await logsApi.exportCsv({ search, model, startDate, endDate });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'ai-logs.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            className="input"
            placeholder="Search prompts…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
          <input
            className="input"
            placeholder="Filter by model…"
            value={model}
            onChange={(e) => { setModel(e.target.value); setPage(1); }}
          />
          <input
            type="date"
            className="input"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          />
          <input
            type="date"
            className="input"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-sm text-gray-500">
            {total.toLocaleString()} log{total !== 1 ? 's' : ''} found
          </p>
          <button
            className="btn-secondary text-xs"
            onClick={handleExport}
            disabled={exporting || total === 0}
          >
            {exporting ? 'Exporting…' : '⬇ Export CSV'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {error && (
          <p className="text-sm text-red-600 p-4">{error}</p>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            Loading…
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            No logs found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Model</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Prompt</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">User ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Latency</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelected(log)}
                  >
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {format(new Date(log.created_at), 'MMM d, HH:mm')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge bg-brand-50 text-brand-700">{log.model}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                      {log.prompt}
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      {log.user_identifier ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {log.latency_ms != null ? `${log.latency_ms}ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <button
              className="btn-secondary text-xs"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ← Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </span>
            <button
              className="btn-secondary text-xs"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Log detail modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Log Detail</h2>
              <button
                onClick={() => setSelected(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs text-gray-500">
                <div><span className="font-medium text-gray-700">ID:</span> {selected.id}</div>
                <div><span className="font-medium text-gray-700">Model:</span> {selected.model}</div>
                <div><span className="font-medium text-gray-700">Time:</span> {format(new Date(selected.created_at), 'PPpp')}</div>
                <div><span className="font-medium text-gray-700">Latency:</span> {selected.latency_ms != null ? `${selected.latency_ms}ms` : '—'}</div>
                {selected.user_identifier && (
                  <div className="col-span-2"><span className="font-medium text-gray-700">User ID:</span> {selected.user_identifier}</div>
                )}
              </div>

              <div>
                <p className="font-medium text-gray-700 mb-1">Prompt</p>
                <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap break-words">
                  {selected.prompt}
                </pre>
              </div>

              <div>
                <p className="font-medium text-gray-700 mb-1">Output</p>
                <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap break-words">
                  {selected.output}
                </pre>
              </div>

              {selected.metadata && (
                <div>
                  <p className="font-medium text-gray-700 mb-1">Metadata</p>
                  <pre className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700 whitespace-pre-wrap">
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

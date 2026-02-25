import Layout from '../components/Layout';
import LogsTable from '../components/LogsTable';

export default function LogsPage() {
  return (
    <Layout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Logs</h1>
          <p className="text-gray-500 text-sm mt-1">
            Browse, filter, and export your AI interaction logs
          </p>
        </div>
        <LogsTable />
      </div>
    </Layout>
  );
}

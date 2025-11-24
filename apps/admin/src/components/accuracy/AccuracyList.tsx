import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AccuracyDetail from './AccuracyDetail';
import PaginationControls from '../common/PaginationControls';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me';

interface AccuracyRecord {
  $id: string;
  sessionId: string;
  aiText: string;
  confidence: number | null;
  latencyMs: number | null;
  tokens: number | null;
  responseType: string;
  humanMark: string | null;
  evaluation: string | null;
  createdAt: string;
  metadata: string;
}

const AccuracyList: React.FC = () => {
  const [records, setRecords] = useState<AccuracyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AccuracyRecord | null>(null);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filters, setFilters] = useState({
    sessionId: '',
    from: '',
    to: '',
    mark: ''
  });

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });
      if (filters.sessionId) params.append('sessionId', filters.sessionId);
      if (filters.from) params.append('from', filters.from);
      if (filters.to) params.append('to', filters.to);
      if (filters.mark) params.append('mark', filters.mark);

      const res = await fetch(`${API_BASE}/admin/accuracy?${params}`, {
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error || 'Failed to fetch records');
      }

      const data = await res.json();
      setRecords(data.items || data.records || []);
      setTotal(data.total || 0);
      setHasMore(data.hasMore !== undefined ? data.hasMore : (offset + (data.items || data.records || []).length < data.total));
    } catch (err: any) {
      setError(err.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setOffset(0); // Reset to first page when filters change
  }, [filters]);

  useEffect(() => {
    fetchRecords();
  }, [offset, limit, filters]);

  const getConfidenceColor = (confidence: number | null) => {
    if (confidence === null) return 'bg-gray-100 text-gray-800';
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.5) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getMarkBadge = (mark: string | null) => {
    if (!mark) return null;
    const colors: Record<string, string> = {
      up: 'bg-green-100 text-green-800',
      down: 'bg-red-100 text-red-800',
      flag: 'bg-yellow-100 text-yellow-800'
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[mark] || 'bg-gray-100 text-gray-800'}`}>
        {mark}
      </span>
    );
  };

  if (loading && records.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Session ID</label>
            <input
              type="text"
              value={filters.sessionId}
              onChange={(e) => setFilters({ ...filters, sessionId: e.target.value })}
              placeholder="Filter by session"
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feedback</label>
            <select
              value={filters.mark}
              onChange={(e) => setFilters({ ...filters, mark: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">All</option>
              <option value="up">Helpful</option>
              <option value="down">Unhelpful</option>
              <option value="flag">Flagged</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Session
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                AI Text
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Confidence
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Latency
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Feedback
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {records.map((record) => (
              <tr key={record.$id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(record.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <Link
                    to={`/sessions/${record.sessionId}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {record.sessionId.substring(0, 20)}...
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                  {record.aiText.substring(0, 50)}...
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {record.confidence !== null ? (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(record.confidence)}`}>
                      {(record.confidence * 100).toFixed(0)}%
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {record.latencyMs !== null ? `${record.latencyMs}ms` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {record.responseType}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getMarkBadge(record.humanMark)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => setSelectedRecord(record)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-700">Items per page:</label>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
              }}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <PaginationControls
            total={total}
            limit={limit}
            offset={offset}
            onPageChange={(newOffset) => setOffset(newOffset)}
          />
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <AccuracyDetail
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onUpdate={fetchRecords}
        />
      )}
    </div>
  );
};

export default AccuracyList;


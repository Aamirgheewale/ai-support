import React, { useState } from 'react';
import FeedbackWidget from './FeedbackWidget';

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

interface AccuracyDetailProps {
  record: AccuracyRecord;
  onClose: () => void;
  onUpdate: () => void;
}

const AccuracyDetail: React.FC<AccuracyDetailProps> = ({ record, onClose, onUpdate }) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [evaluation, setEvaluation] = useState(record.evaluation || '');
  const [humanMark, setHumanMark] = useState(record.humanMark || '');
  const [saving, setSaving] = useState(false);

  const handleEvaluate = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/accuracy/${record.$id}/evaluate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          evaluation,
          humanMark: humanMark || null
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error || 'Failed to save evaluation');
      }

      onUpdate();
      onClose();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFeedback = async (mark: 'up' | 'down' | 'flag', note?: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/admin/accuracy/${record.$id}/feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mark, note })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errorData.error || 'Failed to save feedback');
      }

      setHumanMark(mark);
      onUpdate();
      setShowFeedback(false);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  let metadataObj: any = {};
  try {
    metadataObj = JSON.parse(record.metadata || '{}');
  } catch (e) {
    // Ignore parse errors
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-medium text-gray-900">Accuracy Record Details</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <span className="sr-only">Close</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Session ID</label>
                <p className="mt-1 text-sm text-gray-900">{record.sessionId}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Created At</label>
                <p className="mt-1 text-sm text-gray-900">{new Date(record.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Response Type</label>
                <p className="mt-1 text-sm text-gray-900">{record.responseType}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Confidence</label>
                <p className="mt-1 text-sm text-gray-900">
                  {record.confidence !== null ? `${(record.confidence * 100).toFixed(1)}%` : 'N/A'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Latency</label>
                <p className="mt-1 text-sm text-gray-900">{record.latencyMs !== null ? `${record.latencyMs}ms` : 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tokens</label>
                <p className="mt-1 text-sm text-gray-900">{record.tokens !== null ? record.tokens : 'N/A'}</p>
              </div>
            </div>

            {/* AI Text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">AI Response Text</label>
              <div className="bg-gray-50 p-4 rounded-md max-h-48 overflow-y-auto">
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{record.aiText}</p>
              </div>
            </div>

            {/* Metadata */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Metadata</label>
              <div className="bg-gray-50 p-4 rounded-md max-h-32 overflow-y-auto">
                <pre className="text-xs text-gray-700">{JSON.stringify(metadataObj, null, 2)}</pre>
              </div>
            </div>

            {/* Evaluation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Admin Evaluation</label>
              <textarea
                value={evaluation}
                onChange={(e) => setEvaluation(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400"
                placeholder="Add evaluation notes..."
              />
            </div>

            {/* Human Mark */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mark</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setHumanMark('up')}
                  className={`px-4 py-2 rounded ${humanMark === 'up' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Helpful
                </button>
                <button
                  onClick={() => setHumanMark('down')}
                  className={`px-4 py-2 rounded ${humanMark === 'down' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Unhelpful
                </button>
                <button
                  onClick={() => setHumanMark('flag')}
                  className={`px-4 py-2 rounded ${humanMark === 'flag' ? 'bg-yellow-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                >
                  Flag
                </button>
                <button
                  onClick={() => setHumanMark('')}
                  className="px-4 py-2 rounded bg-gray-200 text-gray-700"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <button
                onClick={() => setShowFeedback(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Quick Feedback
              </button>
              <button
                onClick={handleEvaluate}
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Evaluation'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {showFeedback && (
        <FeedbackWidget
          onClose={() => setShowFeedback(false)}
          onSubmit={handleFeedback}
        />
      )}
    </div>
  );
};

export default AccuracyDetail;


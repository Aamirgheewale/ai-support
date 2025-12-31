import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import AccuracyList from '../components/accuracy/AccuracyList';
import AccuracyStats from '../components/accuracy/AccuracyStats';

const AccuracyPage: React.FC = () => {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('stats');

  // Check if user has admin role
  if (!hasRole('admin')) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            You don't have permission to view accuracy logs. Admin role required.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">AI Accuracy Logging</h1>
        <p className="mt-2 text-sm text-gray-600">
          Track AI response quality, latency, and user feedback
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('stats')}
            className={`${
              activeTab === 'stats'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Statistics
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`${
              activeTab === 'list'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Records
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'stats' && <AccuracyStats />}
      {activeTab === 'list' && <AccuracyList />}
    </div>
  );
};

export default AccuracyPage;


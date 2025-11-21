import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface AgentPerformance {
  agentId: string;
  sessionsHandled: number;
  avgResponseTimeMs: number;
  avgResolutionTimeMs: number;
  messagesHandled: number;
}

interface AgentPerformanceTableProps {
  data: AgentPerformance[];
}

export default function AgentPerformanceTable({ data }: AgentPerformanceTableProps) {
  const [sortBy, setSortBy] = useState<keyof AgentPerformance>('sessionsHandled');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  const handleSort = (column: keyof AgentPerformance) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ column }: { column: keyof AgentPerformance }) => {
    if (sortBy !== column) return null;
    return <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  // Prepare chart data
  const chartData = sortedData.slice(0, 10).map(agent => ({
    agentId: agent.agentId.substring(0, 8) + '...',
    sessionsHandled: agent.sessionsHandled,
    avgResponseTime: Math.round(agent.avgResponseTimeMs / 1000), // Convert to seconds
    avgResolutionTime: Math.round(agent.avgResolutionTimeMs / 1000) // Convert to seconds
  }));

  return (
    <div className="space-y-4">
      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-medium mb-4">Top 10 Agents - Sessions Handled</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="agentId" 
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="sessionsHandled" fill="#8884d8" name="Sessions Handled" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('agentId')}
                >
                  Agent ID <SortIcon column="agentId" />
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('sessionsHandled')}
                >
                  Sessions <SortIcon column="sessionsHandled" />
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('messagesHandled')}
                >
                  Messages <SortIcon column="messagesHandled" />
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('avgResponseTimeMs')}
                >
                  Avg Response <SortIcon column="avgResponseTimeMs" />
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('avgResolutionTimeMs')}
                >
                  Avg Resolution <SortIcon column="avgResolutionTimeMs" />
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedData.map((agent, index) => (
                <tr key={agent.agentId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {agent.agentId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {agent.sessionsHandled}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {agent.messagesHandled}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {agent.avgResponseTimeMs > 0 ? `${Math.round(agent.avgResponseTimeMs / 1000)}s` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {agent.avgResolutionTimeMs > 0 ? `${Math.round(agent.avgResolutionTimeMs / 1000)}s` : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {sortedData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No agent performance data available
          </div>
        )}
      </div>
    </div>
  );
}


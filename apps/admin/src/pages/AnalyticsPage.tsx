import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import KpiCard from '../components/analytics/KpiCard';
import TimeSeriesChart from '../components/analytics/TimeSeriesChart';
import HistogramChart from '../components/analytics/HistogramChart';
import ResponseTimeChart from '../components/analytics/ResponseTimeChart';
import AgentPerformanceTable from '../components/analytics/AgentPerformanceTable';
import { Card } from '../components/ui';
import AnalyticsSkeleton from '../components/skeletons/AnalyticsSkeleton';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const ADMIN_SECRET = import.meta.env.VITE_ADMIN_SECRET || 'dev-secret-change-me';

interface OverviewMetrics {
  totalSessions: number;
  totalMessages: number;
  avgMessagesPerSession: number;
  avgBotResponseTimeMs?: number;
  avgResponseTimeMs?: number;
  humanTakeoverRate: number;
  aiFallbackCount: number;
  startDate?: string;
  endDate?: string;
  sessionStatuses?: {
    active: number;
    agent_assigned: number;
    closed: number;
    needs_human: number;
  };
  period?: { from: string; to: string };
  cached?: boolean;
}

interface TimeSeriesData {
  date: string;
  messages: number;
  sessionsStarted: number;
}

interface ConfidenceHistogram {
  histogram: Array<{ bin: string; count: number; start?: number; end?: number }>;
  totalMessages: number;
}

interface ResponseTimes {
  percentiles: Record<string, number>; // e.g., { p50: 1234, p90: 5678, p99: 12345 }
  count: number;
  min: number;
  max: number;
  avg: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  // Initially empty to show ALL data
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [interval, setInterval] = useState<'day' | 'week' | 'month'>('day');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  const [confidenceHistogram, setConfidenceHistogram] = useState<ConfidenceHistogram | null>(null);
  const [responseTimes, setResponseTimes] = useState<ResponseTimes | null>(null);
  const [agentPerformance, setAgentPerformance] = useState<Array<{ agentId: string; sessionsHandled: number; avgResponseTimeMs: number; avgResolutionTimeMs: number; messagesHandled: number }>>([]);
  const [sessionStatuses, setSessionStatuses] = useState<Array<{ name: string; value: number }>>([]);

  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);

    try {
      const headers = {
        'Authorization': `Bearer ${ADMIN_SECRET}`,
        'Content-Type': 'application/json'
      };

      // Build query params - only include dates if both are provided
      const dateParams = fromDate && toDate ? `from=${fromDate}&to=${toDate}` : '';
      const overviewUrl = `${API_BASE}/admin/metrics/overview${dateParams ? '?' + dateParams : ''}`;
      const timeSeriesUrl = `${API_BASE}/admin/metrics/messages-over-time?${dateParams ? dateParams + '&' : ''}interval=${interval}`;
      const histogramUrl = `${API_BASE}/admin/metrics/confidence-histogram${dateParams ? '?' + dateParams + '&bins=10' : '?bins=10'}`;
      const responseTimesUrl = `${API_BASE}/admin/metrics/response-times${dateParams ? '?' + dateParams + '&percentiles=50,90,99' : '?percentiles=50,90,99'}`;
      const agentPerfUrl = `${API_BASE}/admin/metrics/agent-performance${dateParams ? '?' + dateParams : ''}`;

      // Fetch all metrics in parallel
      const [overviewRes, timeSeriesRes, histogramRes, responseTimesRes, agentPerfRes] = await Promise.all([
        fetch(overviewUrl, { headers }),
        fetch(timeSeriesUrl, { headers }),
        fetch(histogramUrl, { headers }),
        fetch(responseTimesUrl, { headers }),
        fetch(agentPerfUrl, { headers })
      ]);

      if (!overviewRes.ok || !timeSeriesRes.ok || !histogramRes.ok || !responseTimesRes.ok || !agentPerfRes.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const [overviewData, timeSeriesData, histogramData, responseTimesData, agentPerfData] = await Promise.all([
        overviewRes.json(),
        timeSeriesRes.json(),
        histogramRes.json(),
        responseTimesRes.json(),
        agentPerfRes.json()
      ]);

      setOverview(overviewData);
      setTimeSeries(Array.isArray(timeSeriesData) ? timeSeriesData : []);
      setConfidenceHistogram(Array.isArray(histogramData) ? { histogram: histogramData, totalMessages: histogramData.reduce((sum: number, bin: any) => sum + bin.count, 0) } : null);
      setResponseTimes(responseTimesData);
      setAgentPerformance(Array.isArray(agentPerfData) ? agentPerfData : []);

      // Use actual session statuses from backend
      if (overviewData.sessionStatuses) {
        const statuses = [
          { name: 'Active', value: overviewData.sessionStatuses.active || 0 },
          { name: 'Agent Assigned', value: overviewData.sessionStatuses.agent_assigned || 0 },
          { name: 'Closed', value: overviewData.sessionStatuses.closed || 0 },
          { name: 'Needs Human', value: overviewData.sessionStatuses.needs_human || 0 }
        ];
        // Always show all statuses, even if zero (so users can see all categories in legend)
        // Filter out zero values only for pie chart segments (Recharts won't render 0 segments anyway)
        setSessionStatuses(statuses);
        console.log('📊 Session statuses:', statuses);
      } else if (overviewData.totalSessions > 0) {
        // Fallback to old calculation if backend doesn't provide statuses
        const active = overviewData.totalSessions - overviewData.aiFallbackCount - (overviewData.totalSessions * overviewData.humanTakeoverRate / 100);
        const statuses = [
          { name: 'Active', value: Math.max(0, Math.round(active)) },
          { name: 'Needs Human', value: overviewData.aiFallbackCount },
          { name: 'Agent Assigned', value: Math.round(overviewData.totalSessions * overviewData.humanTakeoverRate / 100) }
        ];
        setSessionStatuses(statuses.filter(s => s.value > 0));
      } else {
        setSessionStatuses([]);
      }

      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Error fetching metrics:', err);
      setError(err?.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [fromDate, toDate, interval]);

  const handleExportCSV = async () => {
    try {
      const dateParams = fromDate && toDate ? `from=${fromDate}&to=${toDate}&` : '';
      const response = await fetch(
        `${API_BASE}/admin/metrics/messages-over-time?${dateParams}interval=${interval}&format=csv`,
        {
          headers: { 'Authorization': `Bearer ${ADMIN_SECRET}` }
        }
      );

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `messages-over-time-${fromDate}-to-${toDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Failed to export CSV: ' + (err?.message || 'Unknown error'));
    }
  };

  if (loading && !overview) {
    return (
      <AnalyticsSkeleton />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Analytics Dashboard</h1>

        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              From Date {!fromDate && !toDate && <span className="text-gray-500 dark:text-gray-400 text-xs">(empty = all data)</span>}
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              To Date {!fromDate && !toDate && <span className="text-gray-500 dark:text-gray-400 text-xs">(empty = all data)</span>}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setFromDate('');
                setToDate('');
                setTimeout(fetchMetrics, 100);
              }}
              className="bg-gray-500 dark:bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-600 dark:hover:bg-gray-700 text-sm transition-colors"
              title="Clear dates to show all data"
            >
              Show All
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Interval</label>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value as 'day' | 'week' | 'month')}
              className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={fetchMetrics}
              className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              className="bg-green-600 dark:bg-green-500 text-white px-4 py-2 rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
            >
              Download CSV
            </button>
          </div>

          {lastUpdated && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {lastUpdated.toLocaleTimeString()}
              {overview?.cached && ' (cached)'}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
      </div>

      {/* KPI Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KpiCard title="Total Sessions" value={overview.totalSessions} />
          <KpiCard title="Total Messages" value={overview.totalMessages} />
          <KpiCard
            title="Avg Response Time"
            value={`${overview.avgBotResponseTimeMs || overview.avgResponseTimeMs || 0}ms`}
          />
          <KpiCard
            title="Human Takeover Rate"
            value={`${overview.humanTakeoverRate}%`}
          />
          <KpiCard
            title="AI Fallback Count"
            value={overview.aiFallbackCount}
          />
          <KpiCard
            title="Avg Messages/Session"
            value={overview.avgMessagesPerSession.toFixed(2)}
          />
        </div>
      )}

      {/* Charts */}
      <div className="space-y-6">
        {/* Messages Over Time */}
        {timeSeries.length > 0 && (
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Messages Over Time</h2>
            <TimeSeriesChart data={timeSeries} />
          </Card>
        )}

        {/* Confidence Histogram */}
        {confidenceHistogram && confidenceHistogram.histogram && confidenceHistogram.histogram.length > 0 && (
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              AI Confidence Distribution ({confidenceHistogram.totalMessages} bot messages)
            </h2>
            <HistogramChart data={confidenceHistogram.histogram} />
          </Card>
        )}

        {/* Response Times */}
        {responseTimes && responseTimes.percentiles && Object.keys(responseTimes.percentiles).length > 0 && (
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Response Time Percentiles ({responseTimes.count || 0} responses)
            </h2>
            <ResponseTimeChart data={responseTimes} />
          </Card>
        )}

        {/* Agent Performance */}
        {agentPerformance.length > 0 && (
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Agent Performance</h2>
            <AgentPerformanceTable data={agentPerformance} />
          </Card>
        )}

        {/* Session Statuses */}
        {sessionStatuses.length > 0 && (
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Session Statuses</h2>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={sessionStatuses.filter(s => s.value > 0)} // Only show segments for non-zero values
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent, value }) => {
                    // Only show label if segment is significant (> 5%) or if it's the only segment
                    if (percent > 0.05 || sessionStatuses.filter(s => s.value > 0).length === 1) {
                      return `${name}: ${value} (${(percent * 100).toFixed(1)}%)`;
                    }
                    return '';
                  }}
                  outerRadius={100}
                  innerRadius={30}
                  fill="#8884d8"
                  dataKey="value"
                  paddingAngle={2}
                >
                  {sessionStatuses.filter(s => s.value > 0).map((entry, index) => {
                    const originalIndex = sessionStatuses.findIndex(s => s.name === entry.name);
                    return <Cell key={`cell-${index}`} fill={COLORS[originalIndex % COLORS.length]} />;
                  })}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} sessions`, name]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Custom Legend - Always show all statuses including zero values */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {sessionStatuses.map((status, index) => (
                <div key={status.name} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: status.value > 0 ? COLORS[index % COLORS.length] : '#e5e7eb' }}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {status.name} ({status.value})
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}


import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface ResponseTimes {
  percentiles: Record<string, number>; // e.g., { p50: 1234, p90: 5678, p99: 12345 }
  count: number;
  min: number;
  max: number;
  avg: number;
}

interface ResponseTimeChartProps {
  data: ResponseTimes;
}

export default function ResponseTimeChart({ data }: ResponseTimeChartProps) {
  // Prepare percentile data for display
  const percentileData = Object.entries(data.percentiles || {}).map(([p, value]) => ({
    percentile: p.toUpperCase(),
    value: Math.round(value)
  }));

  return (
    <div className="space-y-6">
      {/* Percentiles Bar Chart */}
      <div>
        <h3 className="text-lg font-medium mb-2">Response Time Percentiles</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={percentileData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="percentile"
            />
            <YAxis />
            <Tooltip formatter={(value: number) => `${value}ms`} />
            <Legend />
            <Bar dataKey="value" fill="#FF8042" name="Response Time (ms)" />
            <ReferenceLine 
              y={data.avg} 
              stroke="#0088FE" 
              strokeDasharray="3 3"
              label={{ value: `Avg: ${data.avg}ms`, position: 'top' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Percentiles Cards */}
      <div>
        <h3 className="text-lg font-medium mb-2">Percentile Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {percentileData.map(item => (
            <div key={item.percentile} className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">{item.percentile}</div>
              <div className="text-xl font-bold">{item.value}ms</div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <div>Min: {data.min}ms | Max: {data.max}ms | Avg: {data.avg}ms | Count: {data.count}</div>
        </div>
      </div>
    </div>
  );
}


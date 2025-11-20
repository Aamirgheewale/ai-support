import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface ResponseTimes {
  percentiles: Record<number, number>;
  distribution: Array<{ range: string; count: number }>;
  totalResponses: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
}

interface ResponseTimeChartProps {
  data: ResponseTimes;
}

export default function ResponseTimeChart({ data }: ResponseTimeChartProps) {
  // Prepare percentile data for display
  const percentileData = Object.entries(data.percentiles).map(([p, value]) => ({
    percentile: `P${p}`,
    value: Math.round(value)
  }));

  return (
    <div className="space-y-6">
      {/* Distribution Chart */}
      <div>
        <h3 className="text-lg font-medium mb-2">Response Time Distribution</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.distribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="range" 
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#FF8042" name="Response Count" />
            <ReferenceLine 
              y={0} 
              stroke="#000" 
              strokeDasharray="3 3"
              label={{ value: `Avg: ${data.avgResponseTime}ms`, position: 'top' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Percentiles */}
      <div>
        <h3 className="text-lg font-medium mb-2">Percentiles</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {percentileData.map(item => (
            <div key={item.percentile} className="bg-gray-50 p-3 rounded">
              <div className="text-sm text-gray-600">{item.percentile}</div>
              <div className="text-xl font-bold">{item.value}ms</div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <div>Min: {data.minResponseTime}ms | Max: {data.maxResponseTime}ms | Avg: {data.avgResponseTime}ms</div>
        </div>
      </div>
    </div>
  );
}


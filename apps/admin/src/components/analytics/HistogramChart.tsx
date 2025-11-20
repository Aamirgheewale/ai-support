import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface HistogramData {
  bin: number;
  min: string;
  max: string;
  count: number;
}

interface HistogramChartProps {
  data: HistogramData[];
}

export default function HistogramChart({ data }: HistogramChartProps) {
  const chartData = data.map(item => ({
    range: `${item.min}-${item.max}`,
    count: item.count
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData}>
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
        <Bar dataKey="count" fill="#8884d8" name="Message Count" />
      </BarChart>
    </ResponsiveContainer>
  );
}


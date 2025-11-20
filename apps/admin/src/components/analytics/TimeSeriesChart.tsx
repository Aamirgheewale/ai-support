import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';

interface TimeSeriesData {
  date: string;
  messages: number;
  sessionsStarted: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesData[];
}

export default function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="messages" 
          stroke="#0088FE" 
          strokeWidth={2}
          name="Messages"
        />
        <Line 
          type="monotone" 
          dataKey="sessionsStarted" 
          stroke="#00C49F" 
          strokeWidth={2}
          name="Sessions Started"
        />
        <Brush dataKey="date" height={30} />
      </LineChart>
    </ResponsiveContainer>
  );
}


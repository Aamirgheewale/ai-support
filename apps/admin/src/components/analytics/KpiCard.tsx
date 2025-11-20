import React from 'react';

interface KpiCardProps {
  title: string;
  value: string | number;
  delta?: string;
  deltaType?: 'positive' | 'negative' | 'neutral';
}

export default function KpiCard({ title, value, delta, deltaType = 'neutral' }: KpiCardProps) {
  const deltaColor = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-gray-600'
  }[deltaType];

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="text-sm text-gray-600 mb-1">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
      {delta && (
        <div className={`text-xs mt-1 ${deltaColor}`}>
          {delta}
        </div>
      )}
    </div>
  );
}


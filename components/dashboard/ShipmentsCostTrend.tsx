'use client';

import { Card, Skeleton, Empty } from 'antd';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Shipment } from '@/types/shipment';

interface ShipmentsCostTrendProps {
  shipments: Shipment[];
  loading?: boolean;
  months?: number;
}

interface MonthData {
  month: string;
  volume: number;
  avgCost: number;
}

function toDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const isoDate = new Date(value);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }
  return null;
}

function getMonthKey(date: Date): string {
  const month = date.toLocaleString('pt-BR', { month: 'short' });
  const year = date.getFullYear().toString().slice(2);
  return `${month}/${year}`;
}

export function ShipmentsCostTrend({ shipments, loading, months = 6 }: ShipmentsCostTrendProps) {
  if (loading) {
    return (
      <Card title="Volume × Custo" variant="outlined">
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  // Group shipments by month
  const now = new Date();
  const monthsAgo = new Date(now);
  monthsAgo.setMonth(now.getMonth() - months);

  const monthlyData: { [key: string]: { volume: number; totalCost: number; count: number } } = {};

  shipments.forEach(shipment => {
    const date = toDate(shipment.atualizadoEm);
    if (!date || date < monthsAgo) return;

    const monthKey = getMonthKey(date);
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { volume: 0, totalCost: 0, count: 0 };
    }

    monthlyData[monthKey].volume += 1;
    monthlyData[monthKey].totalCost += shipment.valorFrete || 0;
    monthlyData[monthKey].count += 1;
  });

  // Convert to array and calculate average
  const data: MonthData[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setMonth(now.getMonth() - i);
    const monthKey = getMonthKey(date);

    const monthData = monthlyData[monthKey] || { volume: 0, totalCost: 0, count: 0 };
    data.push({
      month: monthKey,
      volume: monthData.volume,
      avgCost: monthData.count > 0 ? monthData.totalCost / monthData.count : 0,
    });
  }

  if (data.every(d => d.volume === 0)) {
    return (
      <Card title="Volume × Custo" variant="outlined">
        <Empty description="Sem dados para exibir" />
      </Card>
    );
  }

  return (
    <Card title="Volume × Custo" variant="outlined">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" style={{ fontSize: '12px' }} />
          <YAxis
            yAxisId="left"
            label={{ value: 'Volume', angle: -90, position: 'insideLeft', style: { fontSize: '12px' } }}
            style={{ fontSize: '12px' }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            label={{ value: 'Custo Médio (R$)', angle: 90, position: 'insideRight', style: { fontSize: '12px' } }}
            style={{ fontSize: '12px' }}
          />
          <Tooltip
            contentStyle={{ fontSize: '12px' }}
            formatter={(value: number, name: string) => {
              if (name === 'avgCost') return [`R$ ${value.toFixed(2)}`, 'Custo Médio'];
              return [value, 'Volume'];
            }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="volume"
            stroke="#1890ff"
            strokeWidth={2}
            name="Volume"
            dot={{ r: 4 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgCost"
            stroke="#52c41a"
            strokeWidth={2}
            name="Custo Médio"
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}

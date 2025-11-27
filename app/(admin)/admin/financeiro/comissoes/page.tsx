'use client';

import { useState, useMemo } from 'react';
import { Select, DatePicker, Flex } from 'antd';
import dayjs from 'dayjs';
import { CommissionsTable } from '@/components/admin/finance/CommissionsTable';
import { PageShell } from '@/components/shared/PageShell';
import type { PeriodFilter } from '@/lib/admin/finance/types';

const { RangePicker } = DatePicker;

type PeriodPreset = 'today' | '7d' | '30d' | 'month' | 'custom';

export default function ComissoesPage() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('month');
  const [customRange, setCustomRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const period = useMemo<PeriodFilter>(() => {
    const now = dayjs();
    switch (periodPreset) {
      case 'today':
        return {
          dateStart: now.startOf('day').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case '7d':
        return {
          dateStart: now.subtract(7, 'days').startOf('day').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case '30d':
        return {
          dateStart: now.subtract(30, 'days').startOf('day').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case 'month':
        return {
          dateStart: now.startOf('month').toISOString(),
          dateEnd: now.endOf('day').toISOString(),
        };
      case 'custom':
        if (customRange) {
          return {
            dateStart: customRange[0].startOf('day').toISOString(),
            dateEnd: customRange[1].endOf('day').toISOString(),
          };
        }
        return {};
      default:
        return {};
    }
  }, [periodPreset, customRange]);

  return (
    <PageShell
      title="Comissões"
      gap="md"
      extra={
        <Flex gap={12} align="center">
          <Select
            value={periodPreset}
            onChange={(v) => {
              setPeriodPreset(v);
              if (v !== 'custom') {
                setCustomRange(null);
              }
            }}
            style={{ width: 150 }}
            options={[
              { label: 'Hoje', value: 'today' },
              { label: 'Últimos 7 dias', value: '7d' },
              { label: 'Últimos 30 dias', value: '30d' },
              { label: 'Mês atual', value: 'month' },
              { label: 'Personalizado', value: 'custom' },
            ]}
          />
          {periodPreset === 'custom' && (
            <RangePicker
              value={customRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setCustomRange([dates[0], dates[1]]);
                }
              }}
              format="DD/MM/YYYY"
            />
          )}
        </Flex>
      }
    >
      <CommissionsTable period={period} />
    </PageShell>
  );
}

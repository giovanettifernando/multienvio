'use client';

import { useState, useCallback } from 'react';
import { App } from 'antd';
import { LabelsTable } from '@/components/labels/LabelsTable';
import { LabelPrintModal } from '@/components/labels/LabelPrintModal';
import type { LabelItem } from '@/lib/types/label';
import { PageShell } from '@/components/shared/PageShell';
import { useQueryClient } from '@tanstack/react-query';

export default function EtiquetasClient() {
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const handlePrintStatusChange = useCallback((labelId: string, isPrinted: boolean) => {
    // Invalidar cache para atualizar a tabela
    queryClient.invalidateQueries({ queryKey: ['labels'] });
  }, [queryClient]);

  return (
    <App>
      <PageShell title="Etiquetas" gap="md">
        <LabelsTable
          onOpenLabel={(record: LabelItem) => {
            setSelectedLabelId(record.id);
            setOpen(true);
          }}
        />

        <LabelPrintModal
          open={open}
          labelId={selectedLabelId}
          onClose={() => {
            setOpen(false);
            setSelectedLabelId(null);
          }}
          onPrintStatusChange={handlePrintStatusChange}
        />
      </PageShell>
    </App>
  );
}

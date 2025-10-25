'use client';

import { useState } from 'react';
import { Breadcrumb, Flex, Typography, App } from 'antd';
import { LabelsTable } from '@/components/labels/LabelsTable';
import { LabelModal } from '@/components/labels/LabelModal';
import type { LabelItem } from '@/lib/types/label';

export default function EtiquetasPage() {
  const [selected, setSelected] = useState<LabelItem | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <App>
      <Flex vertical gap={12}>
        <Breadcrumb
          items={[
            { title: 'Envios' },
            { title: 'Etiquetas' },
          ]}
        />
        <Typography.Title level={2} style={{ marginBottom: 0 }}>
          Etiquetas
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          Visualize, imprima e baixe as etiquetas emitidas para seus envios.
        </Typography.Paragraph>

        <LabelsTable
          onOpenLabel={(record) => { setSelected(record); setOpen(true); }}
        />

        <LabelModal
          open={open}
          label={selected}
          onClose={() => { setOpen(false); setSelected(null); }}
        />
      </Flex>
    </App>
  );
}

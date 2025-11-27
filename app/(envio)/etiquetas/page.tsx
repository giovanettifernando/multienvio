'use client';

import { useState } from 'react';
import { Breadcrumb, App } from 'antd';
import { LabelsTable } from '@/components/labels/LabelsTable';
import { LabelModal } from '@/components/labels/LabelModal';
import type { LabelItem } from '@/lib/types/label';
import { PageShell } from '@/components/shared/PageShell';

export default function EtiquetasPage() {
  const [selected, setSelected] = useState<LabelItem | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <App>
      <PageShell title="Etiquetas" gap="md">
        <Breadcrumb
          items={[
            { title: 'Envios' },
            { title: 'Etiquetas' },
          ]}
        />

        <LabelsTable
          onOpenLabel={(record) => { setSelected(record); setOpen(true); }}
        />

        <LabelModal
          open={open}
          label={selected}
          onClose={() => { setOpen(false); setSelected(null); }}
        />
      </PageShell>
    </App>
  );
}

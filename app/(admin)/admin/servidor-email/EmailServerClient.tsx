'use client';

import { PageShell } from '@/shared/ui/PageShell';
import EmailConfigForm from '@/modules/admin/ui/components/EmailConfigForm';

export default function EmailServerClient() {
  return (
    <PageShell title="Configurações" gap="lg">
      <EmailConfigForm />
    </PageShell>
  );
}

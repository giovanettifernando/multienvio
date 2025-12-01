'use client';

import { PageShell } from '@/components/shared/PageShell';
import EmailConfigForm from '@/components/admin/EmailConfigForm';

export default function EmailServerClient() {
  return (
    <PageShell title="Configurações" gap="lg">
      <EmailConfigForm />
    </PageShell>
  );
}

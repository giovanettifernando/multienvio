import { ELSpin } from '@/shared/ui';
import { FormCard } from '@/shared/ui/FormCard';
const Spin = ELSpin;

export default function ConfirmacaoLoading() {
  return (
    <FormCard titulo="Carregando...">
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin size="large" />
      </div>
    </FormCard>
  );
}

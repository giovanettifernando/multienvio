"use client";

import { useEffect, useState, startTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PageShell } from '@/shared/ui/PageShell';
import { ELCard } from '@/shared/ui/ELCard';
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';
import { ELAlert } from '@/shared/ui/ELAlert';
import PersonalForm from "@/modules/auth/ui/components/PersonalForm";
import AccountTabs from "@/modules/auth/ui/components/AccountTabs";
import gridStyles from "@/shared/ui/ELGrid.module.css";
import { cn } from "@/shared/utils/cn";
import { EnvironmentOutlined } from "@ant-design/icons";
import { ELTypography, ELSpace } from "@/shared/ui";
const Typography = ELTypography;
const Space = ELSpace;

const { Text } = Typography;

export default function MinhaContaClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  // Detectar parâmetro showOnboarding na URL
  useEffect(() => {
    if (searchParams.get("showOnboarding") === "true") {
      startTransition(() => {
        setShowOnboardingModal(true);
      });
      // Limpar parâmetro da URL mantendo o hash
      const hash = window.location.hash;
      router.replace(`/minha-conta${hash}`, { scroll: false });
    }
  }, [searchParams, router]);

  const handleCloseOnboarding = () => {
    setShowOnboardingModal(false);
  };

  return (
    <>
      <PageShell title="Minha Conta" gap="lg">
        <div className={cn(gridStyles.grid, gridStyles.gridSidebar, gridStyles.gapXl)}>
          {/* Coluna Esquerda: Dados Pessoais */}
          <ELCard>
            <PersonalForm />
          </ELCard>

          {/* Coluna Direita: Abas (Endereços, Cartões, Destinatários, Segurança) */}
          <AccountTabs />
        </div>
      </PageShell>

      {/* Modal de Onboarding - Exibido quando usuário tenta acessar cotações sem endereço */}
      <ELModal
        title={
          <Space>
            <EnvironmentOutlined style={{ color: 'var(--color-primary)' }} />
            <span>Complete seu cadastro</span>
          </Space>
        }
        open={showOnboardingModal}
        onCancel={handleCloseOnboarding}
        footer={
          <ELButton variant="primary" onClick={handleCloseOnboarding} block>
            Entendi
          </ELButton>
        }
        width={480}
      >
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          <ELAlert
            variant="warning"
            title="Cadastro incompleto"
            description="Para realizar cotações e envios, você precisa completar seu cadastro."
          />
          <Text>
            Por favor, complete os campos obrigatórios em <strong>Dados Pessoais</strong> e cadastre pelo menos <strong>1 endereço</strong> na aba Endereços.
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Após salvar seu endereço, o menu de cotações será liberado automaticamente.
          </Text>
        </Space>
      </ELModal>
    </>
  );
}

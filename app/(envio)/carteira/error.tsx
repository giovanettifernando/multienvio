'use client';

import { useEffect } from 'react';
import { Button, Result } from 'antd';
import { ReloadOutlined, WalletOutlined } from '@ant-design/icons';

export default function WalletError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[WALLET_ERROR]', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <Result
        status="warning"
        title="Erro ao carregar carteira"
        subTitle="Não foi possível carregar os dados da sua carteira. Por favor, tente novamente."
        icon={<WalletOutlined style={{ color: '#faad14' }} />}
        extra={
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => reset()}
          >
            Tentar Novamente
          </Button>
        }
      />
    </div>
  );
}

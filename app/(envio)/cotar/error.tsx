'use client';

import { useEffect } from 'react';
import { Button, Result } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

export default function QuoteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[QUOTE_ERROR]', error);
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
        title="Erro ao carregar cotação"
        subTitle="Não foi possível carregar a página de cotação. Por favor, tente novamente."
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

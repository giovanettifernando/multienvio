'use client';

import { useEffect } from 'react';
import { Button, Result, Typography } from 'antd';
import { ReloadOutlined, HomeOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

export default function RastreioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[RASTREIO_ERROR]', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <Result
        status="error"
        title="Ops! Algo deu errado"
        subTitle="Não foi possível carregar as informações de rastreamento."
        extra={[
          <Button
            key="retry"
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => reset()}
          >
            Tentar Novamente
          </Button>,
          <Button
            key="home"
            icon={<HomeOutlined />}
            onClick={() => (window.location.href = '/')}
          >
            Voltar ao Início
          </Button>,
        ]}
      >
        {process.env.NODE_ENV === 'development' && (
          <div style={{ textAlign: 'left', marginTop: 16 }}>
            <Paragraph>
              <Text strong>Detalhes do erro (apenas desenvolvimento):</Text>
            </Paragraph>
            <Paragraph>
              <Text code>{error.message}</Text>
            </Paragraph>
            {error.digest && (
              <Paragraph>
                <Text type="secondary">Digest: {error.digest}</Text>
              </Paragraph>
            )}
          </div>
        )}
      </Result>
    </div>
  );
}

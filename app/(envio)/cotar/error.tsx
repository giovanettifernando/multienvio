'use client';

import { useEffect } from 'react';

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
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <div>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
        <h1 style={{ fontSize: '24px', margin: '0 0 8px 0', color: '#faad14' }}>
          Erro ao carregar cotação
        </h1>
        <p style={{ color: '#666', marginBottom: '24px' }}>
          Não foi possível carregar a página de cotação. Por favor, tente novamente.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: '8px 16px',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Tentar Novamente
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';

export default function ColetoresPublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[COLETORES_PUBLIC_ERROR]', error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <div>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <h1 style={{ fontSize: '24px', margin: '0 0 8px 0', color: '#ff4d4f' }}>
          Ops! Algo deu errado
        </h1>
        <p style={{ color: '#666', marginBottom: '24px' }}>
          Ocorreu um erro inesperado. Por favor, tente novamente.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
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
          <button
            onClick={() => (window.location.href = '/coletores')}
            style={{
              padding: '8px 16px',
              backgroundColor: 'white',
              color: '#333',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            Voltar ao Início
          </button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <div style={{ textAlign: 'left', marginTop: '24px', padding: '16px', backgroundColor: '#fff2f0', borderRadius: '8px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '8px' }}>
              Detalhes do erro (apenas desenvolvimento):
            </p>
            <code style={{ display: 'block', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '4px', wordBreak: 'break-all' }}>
              {error.message}
            </code>
            {error.digest && (
              <p style={{ marginTop: '8px', color: '#999', fontSize: '12px' }}>
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

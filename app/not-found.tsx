'use client';

import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <div>
        <h1 style={{ fontSize: '72px', margin: 0 }}>404</h1>
        <h2>Página não encontrada</h2>
        <p>A página que você está procurando não existe ou foi movida.</p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: '#1890ff',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px',
          }}
        >
          Voltar para a página inicial
        </Link>
      </div>
    </div>
  );
}

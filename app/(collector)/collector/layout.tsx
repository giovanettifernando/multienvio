'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';

const CollectorLayoutClient = dynamic(() => import('./CollectorLayoutClient'));

export default function CollectorLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #1890ff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <CollectorLayoutClient>{children}</CollectorLayoutClient>
    </Suspense>
  );
}

/**
 * Página SQL - Server Component
 *
 * A lógica interativa foi extraída para SqlClient.tsx
 */

import dynamic from 'next/dynamic';

const SqlClient = dynamic(() => import('./SqlClient'));

export default function AdminSqlPage() {
  return <SqlClient />;
}

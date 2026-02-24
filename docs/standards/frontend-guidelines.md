# Frontend/UI Guidelines - Envio Legal

## 1) Design System EL (wrappers AntD)
- Export unico em `shared/ui/index.ts`. Evidencia: `shared/ui/index.ts`.
- Tokens e tema centralizados. Evidencias: `shared/ui/theme.ts`, `app/globals.css`.
- **INCONSISTENTE**: uso direto de AntD ainda existe (mapa de migracao). Evidencia: `docs/el-components-migration-audit.md`.

## 2) Providers globais
- `AntdRegistry` + `ELConfigProvider` com tema/locale no Root Layout. Evidencia: `app/layout.tsx`.
- React Query no `AppProviders`, com tratamento de 401. Evidencia: `shared/ui/providers/app-providers.tsx`.

## 3) Layouts padrao
- Cliente usa `DashboardShell`. Evidencia: `shared/ui/layout/dashboard-shell.tsx`.
- Admin usa layout dedicado e controla permissoes/menus. Evidencia: `app/(admin)/admin/layout.tsx`.

## 4) Breakpoints e responsividade
- Breakpoints oficiais em CSS custom properties (`768/1024/...`). Evidencia: `app/globals.css`.
- `DashboardShell` diferencia mobile/tablet/desktop. Evidencia: `shared/ui/layout/dashboard-shell.tsx`.

## 5) Formularios
- FormItem wrapper (`ELFormItem`) e inputs EL. Evidencia: `shared/ui/index.ts`.
- React Hook Form presente no stack. Evidencia: `package.json`.

## 6) Estado e fetch
- React Query para fetch/cache. Evidencia: `shared/ui/providers/app-providers.tsx`.
- Zustand para auth/admin session. Evidencias: `modules/auth/ui/state/*`, `modules/admin/ui/state/useAdminSession.ts`.

## 7) Erros e empty states
- Componentes EL para feedback (`ELAlert`, `ELSkeleton`, `ELEmpty`). Evidencia: `shared/ui/index.ts`.

## 8) Regras obrigatorias (UI)
- Preferir EL components (evitar AntD direto).
- Nao importar DB/Prisma em UI (lint bloqueia). Evidencia: `eslint.config.mjs`.

## 9) Itens pendentes
- Migracao completa para EL components. Evidencia: `docs/el-components-migration-audit.md`.

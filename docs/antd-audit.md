# Contexto inicial
- Versões instaladas: `antd@6.0.0` (package.json ^6.0.0, package-lock resolved 6.0.0), `@ant-design/icons@6.1.0`, `@ant-design/nextjs-registry@1.3.0` (npm list).
- Stack: `next@16.0.10` com `react@19.2.0`/`react-dom@19.2.0`.
- Wrappers/abstrações internas envolvendo antd:
  - `app/layout.tsx` usa `AntdRegistry` + `ConfigProvider` com tema de `lib/ui/theme.ts` e envolve tudo em `AppProviders`.
  - `components/providers/app-providers.tsx` injeta `App` (contexto de message/modal/notification) e TanStack Query.
  - Camada de UI padronizada em `components/ui/*` (ex.: `ELModal`, `ELDrawer`, `ELButton`, `ELInput`, `ELSelect`, `ELTag`, `ELEmpty`, `ELSkeleton`, `DataTable`, `ELFormItem`, `FormCard`, `ActionBar`), além de wrappers específicos (`components/ui/shipments-table.tsx`, `components/ui/shipment-status-badge.tsx`).

## 3.1 Resumo
- Mensagens/notifications com API estática do antd (fora de `App.useApp`): 2 hooks de serviço.
- Tipos de Table importados via caminho interno `antd/lib/table/interface`: 4 tabelas financeiras/admin.
- Import de tipo interno de ícones (`@ant-design/icons/lib/components/AntdIcon`): 1 ocorrência.
- Importações mistas (`antd/es/*` vs `antd`) em ambiente com `experimental.optimizePackageImports`: recorrente em componentes de UI e tabelas.
- Compatibilidade a confirmar: antd 6.0.0 + React 19 + Next 16 com `@ant-design/nextjs-registry` 1.3.0 (nenhum alerta registrado em log, mas combinação ainda pouco documentada).

## 3.2 Inventário completo por categoria

### Mensagens/notification (API estática)
- Ocorrências:
  - `lib/collectors/hooks.ts`: mutações `useCreateCollector`/`useUpdateCollector`/`useDeleteCollector` chamam `message.success/error(...)` importado direto de `antd`. Contexto: CRUD de coletores no admin.
    ```ts
    import { message } from 'antd';
    ...
    onSuccess: () => { ...; message.success('Coletor criado com sucesso'); }
    ```
  - `lib/integrations/hooks.ts`: mutações de integrações (`useCreateCarrier`, `useUpdateCarrier`, etc.) usam `message.success/error(...)` global. Contexto: gestão de integrações no admin.
- Problema/risco: API estática (`message.*`) é o padrão legado; em antd 5/6 o recomendado é `App.useApp()` ou `message.useMessage()`. Em modo estrito/concurrent pode aparecer `Warning: [antd: message]` e perder prefixo/tema de `ConfigProvider`.
- O que deve ser feito: passar `message` via `App.useApp()` a partir de componentes ou injetar `messageApi` como dependência nos hooks, evitando import estático. Garantir que chamadas de modal/notification sigam o mesmo padrão.
- Como validar depois: acionar mutações (criar/editar/excluir coletor e integração) e verificar console do navegador/terminal dev para ausência de `[antd: message]` e confirmação de tema consistente nos toasts.

### Table (tipagens e imports internos)
- Ocorrências:
  - `components/admin/finance/InvoicesTable.tsx`, `ReconciliationTable.tsx`, `LedgerTable.tsx`, `components/admin/clients/ClientsTable.tsx`: importam `TableRowSelection` de `antd/lib/table/interface` junto com componentes via `antd`.
    ```ts
    import type { TableRowSelection } from 'antd/lib/table/interface';
    ```
  - Contexto: tabelas com seleção/bulk actions nas áreas financeira e clientes do admin.
- Problema/risco: caminho `antd/lib/*` é interno e não compatível com `optimizePackageImports`; pode quebrar em atualizações de antd 6 (remoção de exports `lib`) e gerar bundles duplicados ou erros de type resolution.
- O que deve ser feito: usar `TableProps['rowSelection']` ou importar de `antd/es/table/interface` (ou direto de `antd` se disponível) e alinhar tipagens de colunas para o mesmo entrypoint. Ajustar ferramentas de import automático para não gerar `antd/lib`.
- Como validar depois: rodar `tsc`/`next build` verificando ausência de erros de resolução e conferir que tabelas continuam permitindo seleção e ações em massa no admin.

### Ícones (tipos internos não públicos)
- Ocorrências:
  - `components/layout/sidebar-items.ts`: tipagem de ícones com `AntdIconProps` de `@ant-design/icons/lib/components/AntdIcon`.
    ```ts
    import type { AntdIconProps } from '@ant-design/icons/lib/components/AntdIcon';
    type IconComponent = ForwardRefExoticComponent<Omit<AntdIconProps, 'ref'> & RefAttributes<HTMLSpanElement>>;
    ```
  - Contexto: lista de itens do sidebar do dashboard de envio.
- Problema/risco: caminho interno não é API pública; mudanças no pacote de ícones podem quebrar ou gerar warnings de árvore de imports, além de fugir do `optimizePackageImports`.
- O que deve ser feito: tipar ícones como `React.ComponentType`/`ForwardRefExoticComponent` genérico ou `typeof HomeOutlined`, evitando imports internos. Manter os ícones vindos do entrypoint principal.
- Como validar depois: rodar `tsc`/`next lint` e abrir o dashboard confirmando renderização dos ícones sem warnings no console.

### Estratégia de import (antd/es vs antd com optimizePackageImports)
- Ocorrências (amostras representativas; padrão recorrente em UI):
  - `components/coletas/ColetasTable.tsx`: `import Table from "antd/es/table"; import Typography from "antd/es/typography"; ...`.
  - `components/ui/DataTable.tsx`: usa `antd/es/table`, `antd/es/empty`, `antd/es/pagination`.
  - `components/ui/ELInput.tsx`: `import Input from "antd/es/input";` e tipos de `antd/es/input`.
  - `components/labels/LabelsTable.tsx`: múltiplos imports default de `antd/es/*` combinados com tipos de `antd/es/table`.
- Problema/risco: projeto habilita `experimental.optimizePackageImports: ['antd', '@ant-design/icons']` em `next.config.ts`. Imports diretos de `antd/es/*` ficam fora da otimização e podem gerar bundles duplicados, diferenças de CSS/tokens e eventuais avisos de hidratação se módulos forem carregados duas vezes.
- O que deve ser feito: padronizar imports via `antd` (deixar o plugin cuidar da divisão) ou, se mantiver `antd/es`, desativar/ajustar `optimizePackageImports` para evitar mistura. Revisar wrappers em `components/ui/*` e tabelas para seguirem o mesmo padrão de entrypoint.
- Como validar depois: `next build`/`next dev` monitorando console por avisos de CSS duplicado/hidratação e conferindo size diff no bundle; checar se `AntdRegistry` continua emitindo estilos uma única vez.

### Compatibilidade de versões (precisa confirmar)
- Ocorrências:
  - `package.json`/`package-lock.json` e `npm list`: `antd@6.0.0` + `@ant-design/nextjs-registry@1.3.0` executando com `react@19.2.0` e `next@16.0.10`.
- Problema/risco: React 19 e Next 16 ainda estão em adoção inicial; documentação do antd 6.0.0/nextjs-registry 1.3.0 não confirma suporte oficial a React 19. Possível surgimento de warnings de concurrent features, CSS-in-JS/SSR ou `findDOMNode` em dev.
- O que deve ser feito: verificar notas de versão do antd 6.x e do registry para React 19/Next 16; considerar pin de React 18.x ou upgrade de antd/registry se já houver releases compatíveis. Cobrir telas críticas com smoke test em dev para capturar warnings.
- Como validar depois: rodar `next dev` e `next build` com React strict mode habilitado, navegar por dashboards/pagamentos/coletas e observar o console por `[antd]` ou hydration warnings.

## 3.3 Lista completa de warnings/deprecations mapeados
| ID | Mensagem/descrição | Arquivo(s) | Severidade | Tipo | Ação recomendada |
| --- | --- | --- | --- | --- | --- |
| ANT-MSG-01 | Uso de `message.*` estático (propenso a `Warning: [antd: message] ... use App`) | `lib/collectors/hooks.ts`, `lib/integrations/hooks.ts` | Alta | Deprecated | Injetar `message` via `App.useApp()`/`message.useMessage` e remover import estático |
| ANT-TBL-01 | Tipos importados de `antd/lib/table/interface` (entrypoint interno) | `components/admin/finance/InvoicesTable.tsx`, `ReconciliationTable.tsx`, `LedgerTable.tsx`, `components/admin/clients/ClientsTable.tsx` | Média | Pattern risk | Migrar para `TableProps['rowSelection']` ou `antd/es/table/interface` e alinhar imports |
| ANT-ICON-01 | `@ant-design/icons/lib/components/AntdIcon` usado para tipagem | `components/layout/sidebar-items.ts` | Média | Deprecated/private API | Tipar ícones via `typeof Icon`/`React.ComponentType` e remover import interno |
| ANT-IMP-01 | Mistura de imports `antd/es/*` com `optimizePackageImports` ativo | `components/coletas/ColetasTable.tsx`, `components/ui/DataTable.tsx`, `components/ui/ELInput.tsx`, `components/labels/LabelsTable.tsx` (e similares) | Média | Pattern risk | Padronizar entrypoint de import (preferir `antd`) ou ajustar config para evitar duplicação |
| ANT-COMP-01 | Compatibilidade não confirmada: antd 6.0.0 + React 19 + Next 16 + registry 1.3.0 | `package.json`, `package-lock.json`, `next.config.ts` | Alta (precisa confirmar) | Breaking change | Validar suporte em release notes; alinhar versões (React 18 ou upgrade de antd/registry) |

## 3.4 Problemas prováveis (sem warning literal)
- Mistura `antd/es` + `optimizePackageImports` (arquivos citados em ANT-IMP-01): pode gerar carregamento duplo de estilos e avisos de hidratação em Next 16; confirmar via build e inspeção de CSS injetado pelo `AntdRegistry`.
- Compatibilidade React 19 (ANT-COMP-01): verificar se componentes que usam `useLayoutEffect` (e.g., `Table`, `Dropdown`, `Drawer`) não disparam avisos em strict mode. Se aparecerem, considerar fallback para React 18 ou upgrade de antd/registry.

## 3.5 Recomendações de padronização do uso do antd
- Imports: adotar sempre o entrypoint `antd` (desestruturado e tipos) para permitir que `optimizePackageImports` faça tree-shake; evitar `antd/es/*` e `antd/lib/*`.
- Mensagens/notifications/modais: usar `const { message, modal, notification } = App.useApp()` em componentes e passar handlers para hooks; para cenários isolados usar `message.useMessage()` com `contextHolder`.
- Tema/ConfigProvider: manter um único `ConfigProvider` de topo (já em `app/layout.tsx`), evitar ConfigProviders locais sem necessidade; centralizar tokens em `lib/ui/theme.ts`.
- Wrappers internos: alinhar `EL*` (Modal, Drawer, Button, Input, Select, Tag, Empty, Skeleton, DataTable) para seguir o mesmo padrão de import e uso de tokens; documentar no design system para novos componentes.
- Ícones: importar apenas do entrypoint `@ant-design/icons` e tipar como `typeof Icon`/`React.ComponentType` evitando paths internos.

## 3.6 Plano de execução sugerido (dependência → risco → esforço)
1) Ajustar API de mensagens (ANT-MSG-01) – risco alto, esforço baixo/medio: injetar `message` via `App.useApp()` nos hooks de coletores e integrações e propagar via parâmetros.
2) Corrigir tipagens de Table (ANT-TBL-01) – risco médio, esforço baixo: substituir imports `antd/lib/table/interface` por tipos públicos (`TableProps['rowSelection']` ou `antd/es/table/interface`).
3) Remover import interno de ícones (ANT-ICON-01) – risco médio, esforço baixo: trocar tipagem para `typeof HomeOutlined`/`React.ComponentType`.
4) Padronizar strategy de import (ANT-IMP-01) – risco médio, esforço médio: definir convenção (`antd` somente) e refatorar `components/ui/*`, tabelas e grids para usar o entrypoint único; revisar `next.config.ts` se necessário.
5) Validar stack de versões (ANT-COMP-01) – risco alto, esforço médio: checar suporte oficial React 19 para antd/registry, rodar smoke tests; decidir por upgrade de libs ou pin de React 18 conforme resultado.

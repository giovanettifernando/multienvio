# Inventário de Telas e Formulários — Envio Legal

## Sumário
- Visão Geral
- Matriz de Rotas
- Telas do Usuário (/)
- Telas Administrativas (/admin)
- Enums & Schemas Globais
- Stores & Persistência
- Mocks & Pontos a Eliminar
- Itens de Integração Prioritários

## Visão Geral
Inventário automatizado das rotas do App Router (Next.js) com foco nos formulários Ant Design e React Hook Form. Inclui dependências de validação (Zod/Yup), stores Zustand, persistência local e mocks identificados pelo analisador estático.

## Matriz de Rotas
| Rota | Arquivo | Possui Form | FormIds | Componentes-chave |
|------|---------|-------------|---------|-------------------|
| / | app/(dashboard)/(overview)/page.tsx | sim | form-root-1, form-root-2, form-root-3 | Flex, Space, Typography.Title, Typography.Paragraph |
| /admin | app/(admin)/admin/page.tsx | não | - | Typography.Title |
| /admin/coletores | app/(admin)/admin/coletores/page.tsx | sim | form-admin-coletores-1 | Flex, Title, Button, PlusOutlined |
| /admin/config | app/(admin)/admin/config/page.tsx | não | - | Typography.Title |
| /admin/contas | app/(admin)/admin/contas/page.tsx | sim | form-admin-contas-1 | App, Flex, Typography.Title, Typography.Paragraph |
| /admin/financeiro | app/(admin)/admin/financeiro/page.tsx | sim | form-admin-financeiro-1, form-admin-financeiro-2, form-admin-financeiro-3 | LedgerTable, InvoicesTable, ReconciliationTable, ChargebacksTable |
| /admin/integracoes | app/(admin)/admin/integracoes/page.tsx | sim | form-admin-integracoes-1, form-admin-integracoes-2, form-admin-integracoes-3, form-admin-integracoes-4 | ApiOutlined, CarrierTable, CarrierDrawer, LinkOutlined |
| /admin/login | app/(admin)/admin/login/page.tsx | sim | form-admin-login-1 | Card, Form, Form.Item, Input |
| /admin/logout | app/(admin)/admin/logout/page.tsx | não | - | - |
| /admin/operacoes | app/(admin)/admin/operacoes/page.tsx | não | - | ShipmentsTable, Alert, PoCTable, EventsTable |
| /admin/pontos-de-coleta | app/(admin)/admin/pontos-de-coleta/page.tsx | sim | form-admin-pontos-de-coleta-1, form-admin-pontos-de-coleta-2, form-admin-pontos-de-coleta-3, form-admin-pontos-de-coleta-4 | Flex, Title, Button, PlusOutlined |
| /admin/suporte | app/(admin)/admin/suporte/page.tsx | não | - | Suspense, AdminSupportPageSkeleton, AdminSupportPageContent, Space |
| /admin/suporte/[id] | app/(admin)/admin/suporte/[id]/page.tsx | sim | form-admin-suporte--id-1 | Space, Breadcrumb, Link, Typography.Title |
| /admin/usuarios | app/(admin)/admin/usuarios/page.tsx | sim | form-admin-usuarios-1 | PageShell, Button, PlusOutlined, SearchFilters |
| /auth/cadastro | app/(auth)/auth/cadastro/page.tsx | sim | form-auth-cadastro-1 | FormCard, Typography.Paragraph, Link, Form |
| /auth/confirmacao | app/(auth)/auth/confirmacao/page.tsx | não | - | FormCard, Typography.Paragraph, Link, Flex |
| /auth/esqueci-senha | app/(auth)/auth/esqueci-senha/page.tsx | sim | form-auth-esqueci-senha-1 | FormCard, Typography.Paragraph, Typography.Link, Space |
| /auth/login | app/(auth)/auth/login/page.tsx | sim | form-auth-login-1 | Form, Alert, Controller, ELFormItem |
| /auth/reset/[token] | app/(auth)/auth/reset/[token]/page.tsx | sim | form-auth-reset--token-1 | FormCard, Alert, Button, Typography.Paragraph |
| /carrinho | app/(dashboard)/carrinho/page.tsx | não | - | Flex, Typography.Title, Skeleton, EmptyCart |
| /carteira | app/(dashboard)/carteira/page.tsx | sim | form-carteira-1, form-carteira-2 | Alert, Typography.Link, BalanceCard, Card |
| /carteira/extrato | app/(dashboard)/carteira/extrato/page.tsx | não | - | Card, Button, Table |
| /carteira/faturas | app/(dashboard)/carteira/faturas/page.tsx | não | - | Flex, Modal, InputNumber, Space |
| /carteira/metodos | app/(dashboard)/carteira/metodos/page.tsx | sim | form-carteira-metodos-1, form-carteira-metodos-2, form-carteira-metodos-3 | Modal, Form, Form.Item, Input |
| /coletas | app/(dashboard)/coletas/page.tsx | não | - | PageShell, SearchFilters, ColetasTable, Flex |
| /coletas/[id] | app/(dashboard)/coletas/[id]/page.tsx | sim | form-coletas--id-1, form-coletas--id-2 | Card, Typography.Text, Alert, Flex |
| /coletas/nova | app/(dashboard)/coletas/nova/page.tsx | sim | form-coletas-nova-1 | Flex, Typography.Title, Typography.Paragraph, Skeleton |
| /conta/perfil | app/(dashboard)/conta/perfil/page.tsx | não | - | - |
| /cotacoes | app/(dashboard)/cotacoes/page.tsx | sim | form-cotacoes-1, form-cotacoes-2, form-cotacoes-3 | PageShell, ELCard, ELSkeleton, ELEmpty |
| /cotacoes/finalizar | app/(dashboard)/cotacoes/finalizar/page.tsx | sim | form-cotacoes-finalizar-1 | Skeleton, FormProvider, Flex, ResultsBanner |
| /cotacoes/resultados | app/(dashboard)/cotacoes/resultados/page.tsx | não | - | Flex, ResultsBanner, ResultsTable, Modal |
| /cotar | app/(dashboard)/cotar/page.tsx | não | - | - |
| /devolucoes | app/(dashboard)/devolucoes/page.tsx | não | - | - |
| /etiquetas | app/(dashboard)/etiquetas/page.tsx | não | - | App, Flex, Breadcrumb, Typography.Title |
| /login | app/login/page.tsx | sim | form-login-1 | Card, Typography.Title, Form, Form.Item |
| /minha-conta | app/(dashboard)/minha-conta/page.tsx | sim | form-minha-conta-1, form-minha-conta-2, form-minha-conta-3, form-minha-conta-4, form-minha-conta-5 | AccountTabs, Tabs, PersonalForm, AddressesList |
| /rastreamento | app/(dashboard)/rastreamento/page.tsx | não | - | Flex, Space, Typography.Title, Typography.Paragraph |
| /rastreamento/[id] | app/(dashboard)/rastreamento/[id]/page.tsx | sim | form-rastreamento--id-1, form-rastreamento--id-2 | Flex, Space, Typography.Title, Typography.Paragraph |
| /shipments | app/(dashboard)/shipments/page.tsx | não | - | Tag, Space, Tooltip, Link |
| /shipments/[id] | app/(dashboard)/shipments/[id]/page.tsx | não | - | Flex, Space, Typography.Title, Button |
| /suporte | app/(dashboard)/suporte/page.tsx | não | - | Space, Flex, Typography.Title, Typography.Text |
| /suporte/[id] | app/(dashboard)/suporte/[id]/page.tsx | sim | form-suporte--id-1 | Space, Card, Skeleton, Flex |
| /suporte/novo | app/(dashboard)/suporte/novo/page.tsx | sim | form-suporte-novo-1 | Space, Title, Text, Card |

## Telas do Usuário (/)
### /
**Arquivo:** `app/(dashboard)/(overview)/page.tsx`
**Componentes:** Flex, Space, Typography.Title, Typography.Paragraph, Card, Alert, QuickQuote, QuickActions, KpiCards, Skeleton, OrdersRecentTable, RecentTracking, AlertsPanel, WalletCard, PerformanceCarrier, DashboardFooterLinks, Button, Form, Row, Col, Form.Item, Input, InputNumber, Select, Modal, Typography.Text, FileAddOutlined, CloudUploadOutlined, SearchOutlined, CalendarOutlined, RocketOutlined, ExperimentOutlined, Tooltip, ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, Tag, Table, Empty, List, List.Item, List.Item.Meta, Avatar, Badge, AddFundsModal, Progress, Typography.Link, Tabs, PixQRCode
**Schemas:** @/lib/validation/company

#### Formulário form-root-1
- Biblioteca: antd
- Componente: `components/dashboard/QuickQuote.tsx`
- Ações: onFinish: (values) => quoteMutation.mutate(values); Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| cepOrigem | CEP origem | Input | required, message: Informe o CEP de origem, pattern: /^[0-9]{5}-?[0-9]{3}$/u, message: CEP inválido | - | - | - | - | - |
| cepDestino | CEP destino | Input | required, message: Informe o CEP de destino, pattern: /^[0-9]{5}-?[0-9]{3}$/u, message: CEP inválido | - | - | - | - | - |
| pesoKg | Peso (kg) | InputNumber | required, message: Informe o peso, type: number, max: 30, message: Peso máximo suportado é 30 kg | - | - | - | - | - |
| valorDeclarado | Valor declarado (R$) | InputNumber | required, message: Informe o valor declarado | - | (value, info) => {
                  // enquanto o usuário digita, preserve o que está no input (evita “pular” o cursor)
                  if (info.userTyping) return info.input || "";
                  const num =
                    typeof value === "number"
                      ? value
                      : value != null && value !== ""
                      ? Number.parseFloat(String(value))
                      : 0;

                  return Number.isFinite(num)
                    ? num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "";
                } | - | - | - |
| comprimentoCm | Comprimento (cm) | InputNumber | required, message: Informe o comprimento, type: number, min: 16, message: Comprimento mínimo é 16 cm | - | - | - | - | - |
| larguraCm | Largura (cm) | InputNumber | required, message: Informe a largura, type: number, min: 11, message: Largura mínima é 11 cm | - | - | - | - | - |
| alturaCm | Altura (cm) | InputNumber | required, message: Informe a altura, type: number, min: 2, message: Altura mínima é 2 cm | - | - | - | - | - |
| servico | Serviço preferencial | Select | - | - | - | serviceOptions | - | - |

#### Formulário form-root-2
- Biblioteca: antd
- Componente: `components/wallet/AddFundsModal.tsx`
- Ações: onFinish: (values: { amount: number }) => pixMutation.mutate(values.amount); Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| amount | Valor | InputNumber | required | - | - | - | - | - |

#### Formulário form-root-3
- Biblioteca: antd
- Componente: `components/wallet/AddFundsModal.tsx`
- Ações: onFinish: (values: { amount: number; cardId?: string }) =>
                    cardMutation.mutate({
                      amount: values.amount,
                      cardId: values.cardId ?? selectedCardId,
                    }); Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| amount | Valor | InputNumber | required | - | - | - | - | - |
| cardId | Cartão | Select | required, message: Selecione um cartão. | - | - | cardOptions | - | - |
| field-3 | - | Button | - | - | - | - | - | - |

### /auth/cadastro
**Arquivo:** `app/(auth)/auth/cadastro/page.tsx`
**Componentes:** FormCard, Typography.Paragraph, Link, Form, Controller, Form.Item, Input, Input.Password, PasswordStrength, Checkbox, Button, Flex, Progress, Space, Typography.Text, Card, Typography.Title
**Store(s):** @/stores/auth
**Schemas:** @/lib/validation/auth

#### Formulário form-auth-cadastro-1
- Biblioteca: antd
- Componente: `app/(auth)/auth/cadastro/page.tsx`
- Ações: onFinish: handleSubmit(onSubmit); Button submit
- Store actions: setUser

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| field-1 | Nome completo | Input | - | - | - | - | - | - |
| field-2 | E-mail | Input | - | - | - | - | - | - |
| field-3 | Senha | Input.Password | - | - | - | - | - | - |
| field-4 | Confirmar senha | Input.Password | - | - | - | - | - | - |
| field-5 | Telefone (opcional) | Input | - | - | - | - | - | - |
| field-6 | - | Checkbox | - | - | - | - | - | - |
| field-7 | - | Button | - | - | - | - | - | - |
| nomeCompleto | - | Form.Item | - | - | - | - | - | - |
| email | - | Form.Item | - | - | - | - | - | - |
| senha | - | Form.Item | - | - | - | - | - | - |
| confirmarSenha | - | Form.Item | - | - | - | - | - | - |
| telefone | - | Form.Item | - | - | - | - | - | - |
| consentLGPD | - | Form.Item | - | - | - | - | - | - |

### /auth/confirmacao
**Arquivo:** `app/(auth)/auth/confirmacao/page.tsx`
**Componentes:** FormCard, Typography.Paragraph, Link, Flex, Button, Card, Typography.Title

_Observações:_
- Nenhum formulário detectado automaticamente.

### /auth/esqueci-senha
**Arquivo:** `app/(auth)/auth/esqueci-senha/page.tsx`
**Componentes:** FormCard, Typography.Paragraph, Typography.Link, Space, Alert, EmailPreview, Button, Form, Controller, Form.Item, Input, Flex, Card, Typography.Title, Typography.Text
**Schemas:** @/lib/validation/auth

#### Formulário form-auth-esqueci-senha-1
- Biblioteca: antd
- Componente: `app/(auth)/auth/esqueci-senha/page.tsx`
- Ações: onFinish: handleSubmit((values) => mutation.mutate(values)); Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| field-1 | E-mail | Input | - | - | - | - | - | - |
| email | - | Form.Item | - | - | - | - | - | - |

### /auth/login
**Arquivo:** `app/(auth)/auth/login/page.tsx`
**Componentes:** Form, Alert, Controller, ELFormItem, ELInput, ELInput.Password, Checkbox, Link, ELButton, FormCard, Typography.Paragraph, ELCard, Flex, Card, Typography.Title, Button, Form.Item, Input, Input.Password, Input.TextArea
**Store(s):** @/stores/auth
**Schemas:** @/lib/validation/auth

#### Formulário form-auth-login-1
- Biblioteca: react-hook-form
- Componente: `app/(auth)/auth/login/page.tsx`
- Ações: onFinish: handleSubmit(onSubmit)
- Store actions: login
- Observações: Form Ant Design embrulhado em React Hook Form (Controllers).

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| email | E-mail | ELInput | required, email | - | - | localStorage[enviolegal:last-email] | - | - |
| senha | Senha | ELInput.Password | required | - | - | - | - | - |
| lembrarEmail | Lembrar meu e-mail | Checkbox | - | - | - | - | - | - |

### /auth/reset/[token]
**Arquivo:** `app/(auth)/auth/reset/[token]/page.tsx`
**Componentes:** FormCard, Alert, Button, Typography.Paragraph, Typography.Link, Space, Form, Controller, Form.Item, Input.Password, PasswordStrength, Flex, Card, Typography.Title, Progress, Typography.Text
**Schemas:** @/lib/validation/auth

#### Formulário form-auth-reset--token-1
- Biblioteca: antd
- Componente: `app/(auth)/auth/reset/[token]/page.tsx`
- Ações: onFinish: handleSubmit((values) => mutation.mutate(values)); Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| field-1 | Nova senha | Input.Password | - | - | - | - | - | - |
| field-2 | Confirmar nova senha | Input.Password | - | - | - | - | - | - |
| senha | - | Form.Item | - | - | - | - | - | - |
| confirmarSenha | - | Form.Item | - | - | - | - | - | - |

### /carrinho
**Arquivo:** `app/(dashboard)/carrinho/page.tsx`
**Componentes:** Flex, Typography.Title, Skeleton, EmptyCart, Typography.Paragraph, Row, Col, CartTable, CartSummary, RemoveItemModal, Result, Button, Space, Typography.Text, Tag, InputNumber, Table, Card, Divider, Radio.Group, Radio, Modal

_Observações:_
- Nenhum formulário detectado automaticamente.

### /carteira
**Arquivo:** `app/(dashboard)/carteira/page.tsx`
**Componentes:** Alert, Typography.Link, BalanceCard, Card, TransactionsTable, AddFundsModal, Typography.Title, Typography.Text, Modal, Tabs, PixQRCode, Form, Form.Item, InputNumber, Button, Select, Empty, Table, Space, Typography.Paragraph

#### Formulário form-carteira-1
- Biblioteca: antd
- Componente: `components/wallet/AddFundsModal.tsx`
- Ações: onFinish: (values: { amount: number }) => pixMutation.mutate(values.amount); Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| amount | Valor | InputNumber | required | - | - | - | - | - |

#### Formulário form-carteira-2
- Biblioteca: antd
- Componente: `components/wallet/AddFundsModal.tsx`
- Ações: onFinish: (values: { amount: number; cardId?: string }) =>
                    cardMutation.mutate({
                      amount: values.amount,
                      cardId: values.cardId ?? selectedCardId,
                    }); Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| amount | Valor | InputNumber | required | - | - | - | - | - |
| cardId | Cartão | Select | required, message: Selecione um cartão. | - | - | cardOptions | - | - |
| field-3 | - | Button | - | - | - | - | - | - |

### /carteira/extrato
**Arquivo:** `app/(dashboard)/carteira/extrato/page.tsx`
**Componentes:** Card, Button, Table

_Observações:_
- Nenhum formulário detectado automaticamente.

### /carteira/faturas
**Arquivo:** `app/(dashboard)/carteira/faturas/page.tsx`
**Componentes:** Flex, Modal, InputNumber, Space, Typography.Title, Typography.Paragraph, Button, Card, Table

_Observações:_
- Nenhum formulário detectado automaticamente.

### /carteira/metodos
**Arquivo:** `app/(dashboard)/carteira/metodos/page.tsx`
**Componentes:** Modal, Form, Form.Item, Input, Space, InputNumber, Flex, Typography.Title, Typography.Paragraph, Button, PaymentMethodCard, AddFundsModal, Tabs, PixQRCode, Select, Empty, Card, Typography.Text

#### Formulário form-carteira-metodos-1
- Biblioteca: antd
- Componente: `app/(dashboard)/carteira/metodos/page.tsx`
- Ações: onFinish: (values) => addCardMutation.mutate(values)

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| holder | Titular | Input | required | - | - | - | - | - |
| number | Número | Input | required | - | - | - | - | - |
| expMonth | Mês | InputNumber | required | - | - | - | - | - |
| expYear | Ano | InputNumber | required | - | - | - | - | - |
| cvc | CVC | Input | required | - | - | - | - | - |

#### Formulário form-carteira-metodos-2
- Biblioteca: antd
- Componente: `components/wallet/AddFundsModal.tsx`
- Ações: onFinish: (values: { amount: number }) => pixMutation.mutate(values.amount); Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| amount | Valor | InputNumber | required | - | - | - | - | - |

#### Formulário form-carteira-metodos-3
- Biblioteca: antd
- Componente: `components/wallet/AddFundsModal.tsx`
- Ações: onFinish: (values: { amount: number; cardId?: string }) =>
                    cardMutation.mutate({
                      amount: values.amount,
                      cardId: values.cardId ?? selectedCardId,
                    }); Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| amount | Valor | InputNumber | required | - | - | - | - | - |
| cardId | Cartão | Select | required, message: Selecione um cartão. | - | - | cardOptions | - | - |
| field-3 | - | Button | - | - | - | - | - | - |

### /coletas
**Arquivo:** `app/(dashboard)/coletas/page.tsx`
**Componentes:** PageShell, SearchFilters, ColetasTable, Flex, Typography.Title, Typography.Text, Input, SearchOutlined, Select, Button, ReloadOutlined, Space, EnvironmentOutlined, EyeOutlined, Alert, Table, ColetaDetailDrawer, ClockCircleOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, Tag, Drawer, Descriptions, Descriptions.Item, TextArea, Timeline
**Store(s):** @/stores/coletas

_Observações:_
- Nenhum formulário detectado automaticamente.

### /coletas/[id]
**Arquivo:** `app/(dashboard)/coletas/[id]/page.tsx`
**Componentes:** Card, Typography.Text, Alert, Flex, Space, Typography.Title, Typography.Paragraph, Descriptions, Descriptions.Item, PickupStatusTag, Button, PickupTimeline, Form, Form.Item, Select, Input.TextArea, Tag, Timeline

#### Formulário form-coletas--id-1
- Biblioteca: antd
- Componente: `app/(dashboard)/coletas/[id]/page.tsx`
- Ações: onFinish: (values: { status: PickupStatus; description?: string }) =>
                updateStatusMutation.mutate(values); Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| status | Status | Select | required | - | - | STATUS_OPTIONS | - | - |
| description | Descrição | Input.TextArea | - | - | - | - | - | - |

#### Formulário form-coletas--id-2
- Biblioteca: antd
- Componente: `app/(dashboard)/coletas/[id]/page.tsx`
- Ações: onFinish: (values: { code: string; description: string }) =>
                webhookMutation.mutate(values); Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| code | Status | Select | required | - | - | WEBHOOK_OPTIONS | - | - |
| description | Descrição | Input.TextArea | required | - | - | - | - | - |

### /coletas/nova
**Arquivo:** `app/(dashboard)/coletas/nova/page.tsx`
**Componentes:** Flex, Typography.Title, Typography.Paragraph, Skeleton, Typography.Text, PickupWizard, Steps, Card, PickupShipmentsTable, Space, Controller, Form.Item, DatePicker, TimePicker, Select, Input.TextArea, Button, PickupSummary, Table, Descriptions, Descriptions.Item
**Schemas:** @/lib/validation/company, @/lib/validation/pickup

#### Formulário form-coletas-nova-1
- Biblioteca: react-hook-form
- Componente: `components/pickups/PickupWizard.tsx`
- Resolver/Schema: zodResolver(pickupPayloadSchema) as Resolver<WizardForm>
- Ações: onSubmit: handleSubmit(onSubmit); Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| schedule.date | - | Form.Item | - | - | - | - | - | - |
| schedule.windowStart | - | Form.Item | - | - | - | - | - | - |
| schedule.windowEnd | - | Form.Item | - | - | - | - | - | - |
| carrierPref | - | Form.Item | - | - | - | - | - | - |
| notes | - | Form.Item | - | - | - | - | - | - |

### /conta/perfil
**Arquivo:** `app/(dashboard)/conta/perfil/page.tsx`
**Componentes:** Sem componentes destacados

_Observações:_
- Nenhum formulário detectado automaticamente.

### /cotacoes
**Arquivo:** `app/(dashboard)/cotacoes/page.tsx`
**Componentes:** PageShell, ELCard, ELSkeleton, ELEmpty, QuoteForm, Space, Switch, Typography.Text, Radio.Group, Radio, OriginCard, Form.Item, AddressSelect, DestinationCard, Tag, Controller, Spin, CheckCircleTwoTone, CloseCircleTwoTone, Input, RecipientSelect, FormProvider, Form, Card, RouteSummaryBar, Alert, RouteModeTag, Steps, RouteCards, Row, Col, InputNumber, Typography.Title, Flex, Button, Typography.Paragraph, VolumesGrid, Divider, Modal, AddressModal, RecipientModal, Skeleton, Empty, ELButton, DeleteOutlined, PlusOutlined, Select, CepInput, RollbackOutlined, SwapRightOutlined, Badge.Ribbon, ArrowDownOutlined, ArrowRightOutlined, SummaryPart, CardContainer, ArrowIcon, BankOutlined, EnvironmentOutlined
**Store(s):** @/store/useQuoteStore
**Schemas:** @/lib/validation/company

#### Formulário form-cotacoes-1
- Biblioteca: antd
- Componente: `components/quote/QuoteForm.tsx`
- Ações: onFinish: handleSubmit(onSubmit); Button submit
- Store actions: storedForm, setResults

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| field-1 | Valor do seguro (R$) | InputNumber | - | - | - | - | - | - |
| seguroValor | - | Form.Item | - | - | - | - | - | - |
| coleta | - | Flex | - | - | - | - | - | - |

#### Formulário form-cotacoes-2
- Biblioteca: react-hook-form
- Componente: `components/account/AddressModal.tsx`
- Resolver/Schema: zodResolver(addressSchema)

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| label | - | Form.Item | - | - | - | - | - | - |
| numero | - | Form.Item | - | - | - | - | - | - |
| complemento | - | Form.Item | - | - | - | - | - | - |
| logradouro | - | Form.Item | - | - | - | - | - | - |
| bairro | - | Form.Item | - | - | - | - | - | - |
| cidade | - | Form.Item | - | - | - | - | - | - |
| uf | - | Form.Item | - | - | - | - | - | - |
| isDefault | - | Form.Item | - | - | - | - | - | - |

#### Formulário form-cotacoes-3
- Biblioteca: react-hook-form
- Componente: `components/recipients/RecipientModal.tsx`
- Resolver/Schema: zodResolver(recipientSchema)

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| name | - | Form.Item | - | - | - | - | - | - |
| doc | - | Form.Item | - | - | - | - | - | - |
| phone | - | Form.Item | - | - | - | - | - | - |
| email | - | Form.Item | - | - | - | - | - | - |
| numero | - | Form.Item | - | - | - | - | - | - |
| complemento | - | Form.Item | - | - | - | - | - | - |
| logradouro | - | Form.Item | - | - | - | - | - | - |
| bairro | - | Form.Item | - | - | - | - | - | - |
| cidade | - | Form.Item | - | - | - | - | - | - |
| uf | - | Form.Item | - | - | - | - | - | - |

### /cotacoes/finalizar
**Arquivo:** `app/(dashboard)/cotacoes/finalizar/page.tsx`
**Componentes:** Skeleton, FormProvider, Flex, ResultsBanner, Row, Col, Space, DocumentChooser, PostingUnitPicker, RecipientForm, LabelPreview, Card, Controller, Form.Item, Select, Button, Typography.Text, Typography.Title, Typography.Paragraph, Tabs, NFeForm, DeclarationItems, Alert, Input, SearchOutlined, Radio.Group, List, List.Item, Radio, EnvironmentOutlined, Switch, MapModal, UserOutlined, PhoneOutlined, MailOutlined, ContactsOutlined, Input.TextArea, Checkbox, Tag, HomeOutlined, TagOutlined, CalendarOutlined, DividerSection, InboxOutlined, Modal, NFeGrid, DeleteOutlined, InputNumber, PlusOutlined, AimOutlined, Table, Dragger
**Store(s):** @/store/useQuoteStore, @/stores/pontos, @/stores/checkout

#### Formulário form-cotacoes-finalizar-1
- Biblioteca: react-hook-form
- Componente: `app/(dashboard)/cotacoes/finalizar/page.tsx`
- Resolver/Schema: zodResolver<FinalizeFormValues, unknown, FinalizeFormValues>(
      createFinalizeFormSchema(pickupAtOrigin),
    )
- Store actions: results, selection

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| payment.method | - | Form.Item | - | - | - | - | - | - |

### /cotacoes/resultados
**Arquivo:** `app/(dashboard)/cotacoes/resultados/page.tsx`
**Componentes:** Flex, ResultsBanner, ResultsTable, Modal, Input, Space, Typography.Paragraph, ContentDeclarationModal, Card, Row, Col, Typography.Text, HomeOutlined, Typography.Title, Tag, TagOutlined, EnvironmentOutlined, CalendarOutlined, DividerSection, Button, InboxOutlined, Avatar, FieldTimeOutlined, ArrowDownOutlined, SafetyCertificateOutlined, LogoutOutlined, Segmented, Table, Empty, SafetyOutlined, Checkbox, FileTextOutlined
**Store(s):** @/store/useQuoteStore

_Observações:_
- Nenhum formulário detectado automaticamente.

### /cotar
**Arquivo:** `app/(dashboard)/cotar/page.tsx`
**Componentes:** Sem componentes destacados

_Observações:_
- Nenhum formulário detectado automaticamente.

### /devolucoes
**Arquivo:** `app/(dashboard)/devolucoes/page.tsx`
**Componentes:** Sem componentes destacados

_Observações:_
- Nenhum formulário detectado automaticamente.

### /etiquetas
**Arquivo:** `app/(dashboard)/etiquetas/page.tsx`
**Componentes:** App, Flex, Breadcrumb, Typography.Title, Typography.Paragraph, LabelsTable, LabelModal, Tag, Space, Button, Input.Search, Select, RangePicker, Skeleton, Empty, Table, Modal, Tabs, Typography.Text, Descriptions, Descriptions.Item

_Observações:_
- Nenhum formulário detectado automaticamente.

### /login
**Arquivo:** `app/login/page.tsx`
**Componentes:** Card, Typography.Title, Form, Form.Item, Input, Input.Password, Button, Typography.Paragraph, Link
**Store(s):** @/stores/auth

#### Formulário form-login-1
- Biblioteca: antd
- Componente: `app/login/page.tsx`
- Ações: onFinish: onFinish; Button submit
- Store actions: login

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| email | E-mail | Input | required, message: Informe seu e-mail, type: email, message: E-mail inválido | - | - | - | - | - |
| senha | Senha | Input.Password | required, message: Informe sua senha | - | - | - | - | - |
| field-3 | - | Button | - | - | - | - | - | - |

### /minha-conta
**Arquivo:** `app/(dashboard)/minha-conta/page.tsx`
**Componentes:** AccountTabs, Tabs, PersonalForm, AddressesList, CardsList, RecipientsList, SecurityForm, Card, Space, Typography.Title, Controller, Flex, Button, Avatar, Popconfirm, DeleteOutlined, Spin, Typography.Text, Alert, Row, Col, Form.Item, Input, Switch, Typography.Paragraph, Link, PlusOutlined, List, List.Item, List.Item.Meta, Tag, AddressModal, CreditCardOutlined, CardModal, SearchOutlined, RecipientModal, Input.Password, Modal, FormProvider, CepInput
**Store(s):** @/stores/auth
**Schemas:** @/lib/validation/utils

#### Formulário form-minha-conta-1
- Biblioteca: react-hook-form
- Componente: `components/account/PersonalForm.tsx`
- Resolver/Schema: zodResolver(formSchema)
- Ações: onSubmit: handleSubmit; Button submit
- Store actions: updateUser, setHasCompany
- Observações: Form dividido em cartões (foto no topo, dados pessoais e empresa).; Foto clicável abre seletor nativo; CEP e endereço gerenciados na aba dedicada.

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| avatarDataUrl | Foto do usuário | Upload | max:2MB, mimetypes:image/jpeg,image/png | - | - | - | - | - |
| fullName | Nome completo | Input | required, min:3 | - | - | - | - | - |
| email | E-mail | Input | required, email | - | - | - | - | - |
| phone | Telefone | Input | required, digits:10-11 | - | (##) #####-#### | - | - | - |
| cpf | CPF | Input | required, cpf | - | 000.000.000-00 | - | - | - |
| cnpj | CNPJ | Input | required_when:hasCompany, cnpj | - | 00.000.000/0000-00 | - | - | Alternador 'Adicionar dados de empresa' |
| razaoSocial | Razão social | Input | required_when:hasCompany | - | - | - | - | Alternador 'Adicionar dados de empresa' |

#### Formulário form-minha-conta-2
- Biblioteca: react-hook-form
- Componente: `components/account/SecurityForm.tsx`
- Resolver/Schema: zodResolver(securitySchema)
- Ações: onSubmit: handleSubmit; Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| currentPassword | - | Form.Item | - | - | - | - | - | - |
| newPassword | - | Form.Item | - | - | - | - | - | - |
| confirmNewPassword | - | Form.Item | - | - | - | - | - | - |

#### Formulário form-minha-conta-3
- Biblioteca: react-hook-form
- Componente: `components/account/AddressModal.tsx`
- Resolver/Schema: zodResolver(addressSchema)

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| label | - | Form.Item | - | - | - | - | - | - |
| numero | - | Form.Item | - | - | - | - | - | - |
| complemento | - | Form.Item | - | - | - | - | - | - |
| logradouro | - | Form.Item | - | - | - | - | - | - |
| bairro | - | Form.Item | - | - | - | - | - | - |
| cidade | - | Form.Item | - | - | - | - | - | - |
| uf | - | Form.Item | - | - | - | - | - | - |
| isDefault | - | Form.Item | - | - | - | - | - | - |

#### Formulário form-minha-conta-4
- Biblioteca: react-hook-form
- Componente: `components/account/CardModal.tsx`
- Resolver/Schema: zodResolver(cardSchema)

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| holderName | - | Form.Item | - | - | - | - | - | - |
| number | - | Form.Item | - | - | - | - | - | - |
| exp | - | Form.Item | - | - | - | - | - | - |
| cvv | - | Form.Item | - | - | - | - | - | - |
| document | - | Form.Item | - | - | - | - | - | - |
| isPrimary | - | Form.Item | - | - | - | - | - | - |

#### Formulário form-minha-conta-5
- Biblioteca: react-hook-form
- Componente: `components/recipients/RecipientModal.tsx`
- Resolver/Schema: zodResolver(recipientSchema)

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| name | - | Form.Item | - | - | - | - | - | - |
| doc | - | Form.Item | - | - | - | - | - | - |
| phone | - | Form.Item | - | - | - | - | - | - |
| email | - | Form.Item | - | - | - | - | - | - |
| numero | - | Form.Item | - | - | - | - | - | - |
| complemento | - | Form.Item | - | - | - | - | - | - |
| logradouro | - | Form.Item | - | - | - | - | - | - |
| bairro | - | Form.Item | - | - | - | - | - | - |
| cidade | - | Form.Item | - | - | - | - | - | - |
| uf | - | Form.Item | - | - | - | - | - | - |

### /rastreamento
**Arquivo:** `app/(dashboard)/rastreamento/page.tsx`
**Componentes:** Flex, Space, Typography.Title, Typography.Paragraph, Card, Input.Search, Tag, Table, TrackingStatusTag, Button

_Observações:_
- Nenhum formulário detectado automaticamente.

### /rastreamento/[id]
**Arquivo:** `app/(dashboard)/rastreamento/[id]/page.tsx`
**Componentes:** Flex, Space, Typography.Title, Typography.Paragraph, Card, Typography.Text, Descriptions, Descriptions.Item, TrackingStatusTag, TrackingTimeline, Form, Form.Item, Select, Input.TextArea, Row, Col, Input, Button, Alert, Timeline, Tag

#### Formulário form-rastreamento--id-1
- Biblioteca: antd
- Componente: `app/(dashboard)/rastreamento/[id]/page.tsx`
- Ações: onFinish: (values: {
                    type: TrackingEventType;
                    description: string;
                    city?: string;
                    uf?: string;
                  }) =>
                    addEventMutation.mutate({
                      shipmentId: id,
                      ...values,
                    }); Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| type | Tipo | Select | required | - | - | EVENT_OPTIONS | - | - |
| description | Descrição | Input.TextArea | required, message: Informe a descrição | - | - | - | - | - |
| city | Cidade | Input | - | - | - | - | - | - |
| uf | UF | Input | - | - | - | - | - | - |

#### Formulário form-rastreamento--id-2
- Biblioteca: antd
- Componente: `app/(dashboard)/rastreamento/[id]/page.tsx`
- Ações: onFinish: (values: {
                    code: TrackingEventType;
                    description: string;
                    city?: string;
                    uf?: string;
                  }) =>
                    webhookMutation.mutate({
                      shipmentId: id,
                      ...values,
                    }); Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| code | Status | Select | required | - | - | EVENT_OPTIONS | - | - |
| description | Descrição | Input.TextArea | required | - | - | - | - | - |
| city | Cidade | Input | - | - | - | - | - | - |
| uf | UF | Input | - | - | - | - | - | - |

### /shipments
**Arquivo:** `app/(dashboard)/shipments/page.tsx`
**Componentes:** Tag, Space, Tooltip, Link, Button, EyeOutlined, PrinterOutlined, GlobalOutlined, StopOutlined, Typography.Title, Typography.Paragraph, Input, SearchOutlined, Segmented, Table

_Observações:_
- Nenhum formulário detectado automaticamente.

### /shipments/[id]
**Arquivo:** `app/(dashboard)/shipments/[id]/page.tsx`
**Componentes:** Flex, Space, Typography.Title, Button, Skeleton, Alert, Card, Descriptions, Descriptions.Item

_Observações:_
- Nenhum formulário detectado automaticamente.

### /suporte
**Arquivo:** `app/(dashboard)/suporte/page.tsx`
**Componentes:** Space, Flex, Typography.Title, Typography.Text, Button, PlusOutlined, Card, NewTicketList, TicketDetailsDrawer, Text, Tag, Input, SearchOutlined, Select, Table, Drawer, Empty, Title, Descriptions, Descriptions.Item, UserOutlined, Divider, Timeline, Space.Compact, TextArea, SendOutlined
**Store(s):** @/stores/support
**Schemas:** @/lib/validation/support

_Observações:_
- Nenhum formulário detectado automaticamente.

### /suporte/[id]
**Arquivo:** `app/(dashboard)/suporte/[id]/page.tsx`
**Componentes:** Space, Card, Skeleton, Flex, Result, Button, TicketDetailHeader, TicketTimeline, TicketCommentBox, RelatedEntities, ArrowLeftOutlined, Typography.Title, Badge, Typography.Text, TicketStatusTag, Tag, Form, Form.Item, Select, Timeline, Typography.Paragraph, Typography.Link, CannedReplySelect, Input.TextArea, Upload

#### Formulário form-suporte--id-1
- Biblioteca: antd
- Componente: `components/support/TicketDetailHeader.tsx`
- Ações: onValuesChange: (changedValues) => {
                const entries = Object.entries(changedValues) as Array<[string, unknown]>;
                const payload: Partial<Ticket> = {};

                entries.forEach(([field, value]) => {
                  if (field === "assignee" && value === "unassigned") {
                    payload.assignee = null;
                    return;
                  }

                  if (!value) {
                    if (field === "assignee") {
                      payload.assignee = null;
                    } else {
                      (payload as Record<string, unknown>)[field] = value;
                    }
                    return;
                  }

                  if (field === "assignee") {
                    const agent =
                      availableAgents.find((item) => item.id === value) ??
                      (ticket.assignee && ticket.assignee.id === value ? ticket.assignee : undefined) ??
                      (currentAgent && currentAgent.id === value ? currentAgent : undefined);
                    payload.assignee = agent ?? null;
                  } else {
                    (payload as Record<string, unknown>)[field] = value;
                  }
                });

                if (Object.keys(payload).length > 0) {
                  handleSubmit(payload);
                }
              }

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| status | Status | Select | - | - | - | statusOptions | mutation.isPending | - |
| category | Categoria | Select | - | - | - | categoryOptions | mutation.isPending | - |
| assignee | Responsável | Select | - | - | - | assigneeOptions | mutation.isPending | - |

### /suporte/novo
**Arquivo:** `app/(dashboard)/suporte/novo/page.tsx`
**Componentes:** Space, Title, Text, Card, SupportForm, Alert, InfoCircleOutlined, Form, Form.Item, Input, Select, TextArea, Upload, Button, PaperClipOutlined
**Store(s):** @/stores/auth
**Schemas:** @/lib/validation/support

#### Formulário form-suporte-novo-1
- Biblioteca: antd
- Componente: `components/support/SupportForm.tsx`
- Ações: onFinish: handleSubmit; Button submit
- Store actions: usuario

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| name | Nome | Input | required, message: Nome é obrigatório | - | - | - | isLoggedIn | - |
| email | E-mail | Input | required, message: E-mail é obrigatório, type: email, message: E-mail inválido | - | - | - | isLoggedIn | - |
| phone | Telefone (opcional) | Input | - | - | - | - | - | - |
| subject | Assunto | Input | required, message: Assunto é obrigatório, min: 3 | - | - | - | - | - |
| priority | Prioridade | Select | required | - | - | { value: 'baixa', label: 'Baixa' }.{ value: 'media', label: 'Média' }.{ value: 'alta', label: 'Alta' }.{ value: 'critica', label: 'Crítica' } | - | - |
| description | Descrição | TextArea | required, message: Descrição é obrigatória, min: 3 | - | - | - | - | - |
| field-7 | Anexos (opcional) | Upload | - | - | - | - | - | - |
| field-8 | - | Space | - | - | - | - | - | - |


## Telas Administrativas (/admin)
### /admin
**Arquivo:** `app/(admin)/admin/page.tsx`
**Componentes:** Typography.Title

_Observações:_
- Nenhum formulário detectado automaticamente.

### /admin/coletores
**Arquivo:** `app/(admin)/admin/coletores/page.tsx`
**Componentes:** Flex, Title, Button, PlusOutlined, Card, SearchFilters, CollectorsTable, CollectorDrawer, Form, Form.Item, Input, SearchOutlined, Select, Space, ClearOutlined, ExclamationCircleOutlined, Tooltip, Link, Text, DocsStatusBadge, Tag, Switch, EditOutlined, DeleteOutlined, Table, PFForm, PJForm, VehicleForm, DocumentsForm, FinanceForm, Drawer, FormProvider, Spin, Tabs, CheckCircleOutlined, CloseCircleOutlined, Controller, Typography.Title, DatePicker, Checkbox, CloseCircleFilled, CheckCircleFilled, Alert, Upload, UploadOutlined, Segmented, InputNumber
**Schemas:** @/lib/collectors/schemas

#### Formulário form-admin-coletores-1
- Biblioteca: antd
- Componente: `components/collectors/SearchFilters.tsx`

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| q | - | Input | - | - | - | - | - | - |
| status | - | Select | - | all | - | { label: 'Todos', value: 'all' }.{ label: 'Ativo', value: 'active' }.{ label: 'Bloqueado', value: 'blocked' } | - | - |
| uf | - | Select | - | - | - | UFS.map((uf) => ({ label: uf, value: uf })) | - | - |
| cidade | - | Input | - | - | - | - | - | - |

### /admin/config
**Arquivo:** `app/(admin)/admin/config/page.tsx`
**Componentes:** Typography.Title

_Observações:_
- Nenhum formulário detectado automaticamente.

### /admin/contas
**Arquivo:** `app/(admin)/admin/contas/page.tsx`
**Componentes:** App, Flex, Typography.Title, Typography.Paragraph, ClientsTable, ClientDrawer, Tag, Space, Button, EyeOutlined, Popconfirm, UnlockOutlined, LockOutlined, Input.Search, Select, KeyOutlined, Table, Drawer, Row, Col, Statistic, Descriptions, Descriptions.Item, Form, Form.Item

#### Formulário form-admin-contas-1
- Biblioteca: antd
- Componente: `components/admin/clients/ClientDrawer.tsx`

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| status | Status da Conta | Select | required, message: Selecione o status | - | - | { label: statusLabels.active, value: 'active' }.{ label: statusLabels.blocked, value: 'blocked' }.{ label: statusLabels.suspended, value: 'suspended' } | - | - |

### /admin/financeiro
**Arquivo:** `app/(admin)/admin/financeiro/page.tsx`
**Componentes:** LedgerTable, InvoicesTable, ReconciliationTable, ChargebacksTable, PayoutsTable, CommissionsTable, FeesView, Reports, Flex, Select, RangePicker, Card, Skeleton, Row, Col, Statistic, Tabs, Tag, Input.Search, Button, DownloadOutlined, PlusOutlined, Popconfirm, CheckOutlined, Table, Modal, Form, Form.Item, Input, InputNumber, Input.TextArea, LinkOutlined, Space, CloseOutlined, Text, DollarOutlined, Descriptions, Descriptions.Item

#### Formulário form-admin-financeiro-1
- Biblioteca: antd
- Componente: `components/admin/finance/LedgerTable.tsx`

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| customerId | ID do Cliente | Input | required | - | - | - | - | - |
| customerName | Nome do Cliente | Input | required | - | - | - | - | - |
| nature | Natureza | Select | required | - | - | { label: 'Crédito', value: 'credit' }.{ label: 'Débito', value: 'debit' } | - | - |
| amount | Valor (R$) | InputNumber | required | - | (value) => `R$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') | - | - | - |
| description | Descrição | Input.TextArea | - | - | - | - | - | - |

#### Formulário form-admin-financeiro-2
- Biblioteca: antd
- Componente: `components/admin/finance/PayoutsTable.tsx`

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| reference | Referência (opcional) | Input | - | - | - | - | - | - |
| proofUrl | URL Comprovante (opcional) | Input | - | - | - | - | - | - |

#### Formulário form-admin-financeiro-3
- Biblioteca: antd
- Componente: `components/admin/finance/FeesView.tsx`

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| customerId | ID do Cliente | Input | required | - | - | - | - | - |
| customerName | Nome do Cliente | Input | required | - | - | - | - | - |
| feeType | Tipo de Taxa | Select | required | - | - | { label: 'MDR Cartão', value: 'mdr' }.{ label: 'Taxa Boleto', value: 'boleto' }.{ label: 'Taxa Plataforma', value: 'platform' } | - | - |
| amount | Valor (R$) | InputNumber | required | - | (value) => `R$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.') | - | - | - |
| description | Descrição | Input.TextArea | - | - | - | - | - | - |

### /admin/integracoes
**Arquivo:** `app/(admin)/admin/integracoes/page.tsx`
**Componentes:** ApiOutlined, CarrierTable, CarrierDrawer, LinkOutlined, ApiTable, ApiDrawer, LockOutlined, AuthPanel, CreditCardOutlined, PaymentGatewayTab, HeartOutlined, HealthPanel, PageShell, Tabs, Image, Tag, Space, Switch, Button, EditOutlined, CopyOutlined, DeleteOutlined, Empty, PlusOutlined, Flex, Table, Drawer, Form, Form.Item, Controller, Input, Checkbox.Group, Tooltip, Select, TextArea, Card, Spin, SaveOutlined, Space.Compact, EyeInvisibleOutlined, EyeOutlined, ReloadOutlined, Alert, Input.Password, ServiceStatusBadge, Text, Descriptions, Descriptions.Item, Typography.Title, Typography.Text, Badge
**Store(s):** @/store/integrations.store
**Schemas:** @/lib/integrations/schemas

#### Formulário form-admin-integracoes-1
- Biblioteca: antd
- Componente: `components/integrations/CarrierDrawer.tsx`
- Store actions: carrierDrawerOpen, carrierDrawerMode, editingCarrier, closeCarrierDrawer

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| field-1 | Nome | Controller | - | - | - | - | - | - |
| field-2 | Slug | Controller | - | - | - | - | - | - |
| field-3 | Website | Controller | - | - | - | - | - | - |
| field-4 | URL do Logo | Controller | - | - | - | - | - | - |
| field-5 | Serviços suportados | Controller | - | - | - | - | - | - |
| field-6 | Status | Controller | - | - | - | - | - | - |
| name | - | Input | - | - | - | - | - | - |
| slug | - | Input | - | - | - | - | - | - |
| website | - | Input | - | - | - | - | - | - |
| logoUrl | - | Input | - | - | - | - | - | - |
| services | - | Checkbox.Group | - | - | - | - | - | - |
| enabled | - | Space | - | - | - | - | - | - |

#### Formulário form-admin-integracoes-2
- Biblioteca: antd
- Componente: `components/integrations/ApiDrawer.tsx`
- Store actions: apiDrawerOpen, apiDrawerMode, editingApi, selectedCarrierId, closeApiDrawer

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| field-1 | Transportadora | Controller | - | - | - | - | - | - |
| field-2 | Ambiente | Controller | - | - | - | - | - | - |
| field-3 | Quote URL | Controller | - | - | - | - | - | - |
| field-4 | Label URL | Controller | - | - | - | - | - | - |
| field-5 | Tracking URL | Controller | - | - | - | - | - | - |
| field-6 | Notas | Controller | - | - | - | - | - | - |
| field-7 | Status | Controller | - | - | - | - | - | - |
| carrierId | - | Select | - | - | - | - | - | - |
| environment | - | Select | - | - | - | - | - | - |
| quoteUrl | - | Input | - | - | - | - | - | - |
| labelUrl | - | Input | - | - | - | - | - | - |
| trackingUrl | - | Input | - | - | - | - | - | - |
| notes | - | TextArea | - | - | - | - | - | - |
| active | - | Space | - | - | - | - | - | - |

#### Formulário form-admin-integracoes-3
- Biblioteca: antd
- Componente: `components/integrations/AuthPanel.tsx`

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| field-1 | field.label | Controller | - | - | - | - | - | - |
| carrierId | - | input | - | - | - | - | - | - |
| `fields.${index}.key` | - | input | - | - | - | - | - | - |
| `fields.${index}.label` | - | input | - | - | - | - | - | - |
| `fields.${index}.type` | - | input | - | - | - | - | - | - |
| `fields.${index}.masked` | - | input | - | - | - | - | - | - |
| `fields.${index}.value` | - | Space.Compact | - | - | - | - | - | - |

#### Formulário form-admin-integracoes-4
- Biblioteca: antd
- Componente: `components/integrations/PaymentGatewayTab.tsx`

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| field-1 | Public Key | Controller | - | - | - | - | - | - |
| field-2 | Access Token | Controller | - | - | - | - | - | - |
| field-3 | Webhook URL | Controller | - | - | - | - | - | - |
| field-4 | Webhook Secret | Controller | - | - | - | - | - | - |
| field-5 | Status | Controller | - | - | - | - | - | - |
| provider | - | input | - | - | - | - | - | - |
| publicKey | - | Input | - | - | - | - | - | - |
| accessToken | - | Input.Password | - | - | - | - | - | - |
| webhookUrl | - | Input | - | - | - | - | - | - |
| webhookSecret | - | Input.Password | - | - | - | - | - | - |
| active | - | Space | - | - | - | - | - | - |

### /admin/login
**Arquivo:** `app/(admin)/admin/login/page.tsx`
**Componentes:** Card, Form, Form.Item, Input, Input.Password, Button, Suspense, AdminLoginForm
**Store(s):** @/stores/useAdminSession

#### Formulário form-admin-login-1
- Biblioteca: antd
- Componente: `app/(admin)/admin/login/page.tsx`
- Ações: onFinish: onFinish; Button submit
- Store actions: setAdmin

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| email | E-mail | Input | required, message: E-mail é obrigatório, type: email, message: E-mail inválido | - | - | - | - | - |
| password | Senha | Input.Password | required, message: Senha é obrigatória | - | - | - | - | - |

### /admin/logout
**Arquivo:** `app/(admin)/admin/logout/page.tsx`
**Componentes:** Sem componentes destacados
**Store(s):** @/stores/useAdminSession

_Observações:_
- Nenhum formulário detectado automaticamente.

### /admin/operacoes
**Arquivo:** `app/(admin)/admin/operacoes/page.tsx`
**Componentes:** ShipmentsTable, Alert, PoCTable, EventsTable, Flex, Select, RangePicker, Card, Skeleton, Row, Col, Statistic, Tabs, Tag, Space, Button, EyeOutlined, ReloadOutlined, Input, SearchOutlined, Checkbox, DownloadOutlined, Table, Drawer, Timeline, CheckOutlined

_Observações:_
- Nenhum formulário detectado automaticamente.

### /admin/pontos-de-coleta
**Arquivo:** `app/(admin)/admin/pontos-de-coleta/page.tsx`
**Componentes:** Flex, Title, Button, PlusOutlined, Card, SearchFilters, PointsTable, PointDrawer, Form, Form.Item, Input, SearchOutlined, Select, Space, ClearOutlined, ExclamationCircleOutlined, Link, StatusTag, Switch, EditOutlined, DeleteOutlined, Table, PJForm, EnderecoForm, PagamentoForm, Drawer, Spin, Tabs, Tag, Controller, InputNumber, Row, Col, Radio.Group, Radio.Button
**Store(s):** @/stores/pontos
**Schemas:** @/lib/pickup/schemas

#### Formulário form-admin-pontos-de-coleta-1
- Biblioteca: antd
- Componente: `components/pickup/SearchFilters.tsx`

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| q | - | Input | - | - | - | - | - | - |
| status | - | Select | - | all | - | { label: 'Todos', value: 'all' }.{ label: 'Ativo', value: 'active' }.{ label: 'Bloqueado', value: 'blocked' } | - | - |
| uf | - | Select | - | - | - | UFS.map((uf) => ({ label: uf, value: uf })) | - | - |
| cidade | - | Input | - | - | - | - | - | - |

#### Formulário form-admin-pontos-de-coleta-2
- Biblioteca: antd
- Componente: `components/pickup/forms/PJForm.tsx`

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| field-1 | Razão Social | Controller | - | - | - | - | - | - |
| field-2 | Nome Fantasia | Controller | - | - | - | - | - | - |
| field-3 | CNPJ | Controller | - | - | - | - | - | - |
| field-4 | Inscrição Estadual | Controller | - | - | - | - | - | - |
| field-5 | E-mail | Controller | - | - | - | - | - | - |
| field-6 | Telefone | Controller | - | - | - | - | - | - |
| field-7 | Capacidade (pedidos/dia) | Controller | - | - | - | - | - | - |
| razaoSocial | - | Input | - | - | - | - | - | - |
| nomeFantasia | - | Input | - | - | - | - | - | - |
| cnpj | - | Input | - | - | - | - | - | - |
| ie | - | Input | - | - | - | - | - | - |
| email | - | Input | - | - | - | - | - | - |
| telefone | - | Input | - | - | - | - | - | - |
| capacityPerDay | - | InputNumber | - | - | - | - | - | - |

#### Formulário form-admin-pontos-de-coleta-3
- Biblioteca: antd
- Componente: `components/pickup/forms/EnderecoForm.tsx`

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| field-1 | CEP | Controller | - | - | - | - | - | - |
| field-2 | Logradouro | Controller | - | - | - | - | - | - |
| field-3 | Número | Controller | - | - | - | - | - | - |
| field-4 | Complemento | Controller | - | - | - | - | - | - |
| field-5 | Bairro | Controller | - | - | - | - | - | - |
| field-6 | Cidade | Controller | - | - | - | - | - | - |
| field-7 | UF | Controller | - | - | - | - | - | - |
| cep | - | Input | - | - | - | - | - | - |
| logradouro | - | Input | - | - | - | - | - | - |
| numero | - | Input | - | - | - | - | - | - |
| complemento | - | Input | - | - | - | - | - | - |
| bairro | - | Input | - | - | - | - | - | - |
| cidade | - | Input | - | - | - | - | - | - |
| uf | - | Select | - | - | - | - | - | - |

#### Formulário form-admin-pontos-de-coleta-4
- Biblioteca: antd
- Componente: `components/pickup/forms/PagamentoForm.tsx`

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| field-1 | Método de Pagamento | Controller | - | - | - | - | - | - |
| field-2 | Tipo de Chave PIX | Controller | - | - | - | - | - | - |
| field-3 | Chave PIX | Controller | - | - | - | - | - | - |
| field-4 | Código do Banco | Controller | - | - | - | - | - | - |
| field-5 | Agência | Controller | - | - | - | - | - | - |
| field-6 | Tipo de Conta | Controller | - | - | - | - | - | - |
| field-7 | Conta | Controller | - | - | - | - | - | - |
| field-8 | Nome do Titular | Controller | - | - | - | - | - | - |
| field-9 | CNPJ do Titular | Controller | - | - | - | - | - | - |
| field-10 | Dia do Repasse | Controller | - | - | - | - | - | - |
| field-11 | Valor Mínimo para Repasse | Controller | - | - | - | - | - | - |
| field-12 | Comissão por Item Recebido | Controller | - | - | - | - | - | - |
| paymentMethod.kind | - | Radio.Group | - | - | - | - | - | - |
| paymentMethod.pixType | - | Select | - | - | - | - | - | - |
| paymentMethod.pixKey | - | - | - | - | - | - | - | - |
| paymentMethod.bankCode | - | Input | - | - | - | - | - | - |
| paymentMethod.branch | - | Input | - | - | - | - | - | - |
| paymentMethod.accountType | - | Select | - | - | - | - | - | - |
| paymentMethod.account | - | Input | - | - | - | - | - | - |
| paymentMethod.holderName | - | Input | - | - | - | - | - | - |
| paymentMethod.holderDocument | - | Input | - | - | - | - | - | - |
| payoutDay | - | InputNumber | - | - | - | - | - | - |
| minPayoutAmount | - | InputNumber | - | - | - | - | - | - |
| commissionPerItem | - | InputNumber | - | - | - | - | - | - |

### /admin/suporte
**Arquivo:** `app/(admin)/admin/suporte/page.tsx`
**Componentes:** Suspense, AdminSupportPageSkeleton, AdminSupportPageContent, Space, Typography.Title, Typography.Text, NewTicketList, TicketDetailsDrawer, Skeleton, Text, Tag, Input, SearchOutlined, Select, Table, Drawer, Empty, Title, Descriptions, Descriptions.Item, UserOutlined, Divider, Timeline, Space.Compact, TextArea, Button, SendOutlined
**Store(s):** @/stores/support, @/stores/useAdminSession
**Schemas:** @/lib/validation/support

_Observações:_
- Nenhum formulário detectado automaticamente.

### /admin/suporte/[id]
**Arquivo:** `app/(admin)/admin/suporte/[id]/page.tsx`
**Componentes:** Space, Breadcrumb, Link, Typography.Title, TicketDetails, MessageOutlined, FlagOutlined, IdcardOutlined, PlusCircleOutlined, Card, Empty, TicketDetailsSkeleton, Result, Typography.Link, TicketHeader, Typography.Paragraph, Flex, Timeline, Typography.Text, ReplyBox, Skeleton, Tag, CustomerServiceOutlined, ClockCircleOutlined, Select, Button, SendOutlined, Form, Form.Item, Input.TextArea, Upload, PaperClipOutlined
**Store(s):** @/stores/useAdminSession

#### Formulário form-admin-suporte--id-1
- Biblioteca: antd
- Componente: `components/admin/support/ReplyBox.tsx`
- Ações: onFinish: handleSubmit; Button submit

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| message | Mensagem | Input.TextArea | required, message: Escreva a resposta ao cliente. | - | - | - | replyMutation.isPending | - |

### /admin/usuarios
**Arquivo:** `app/(admin)/admin/usuarios/page.tsx`
**Componentes:** PageShell, Button, PlusOutlined, SearchFilters, UsersTable, UserDrawer, Flex, Typography.Title, Typography.Text, Input, SearchOutlined, Select, ReloadOutlined, Tag, Switch, Tooltip, EditOutlined, KeyOutlined, DeleteOutlined, Table, Drawer, Form, Form.Item, Controller, RolesChecklist, Alert, Collapse, Checkbox, Card
**Schemas:** @/lib/auth/schemas

#### Formulário form-admin-usuarios-1
- Biblioteca: antd
- Componente: `components/admin/users/UserDrawer.tsx`

| fieldName | label | type | validation | default | mask | dataSource | RO/Disabled | Visible If |
|-----------|-------|------|------------|---------|------|------------|-------------|------------|
| field-1 | Nome | Controller | - | - | - | - | - | - |
| field-2 | E-mail | Controller | - | - | - | - | - | - |
| field-3 | Telefone | Controller | - | - | - | - | - | - |
| field-4 | Status | Controller | - | - | - | - | - | - |
| field-5 | Permissões | Controller | - | - | - | - | - | - |
| name | - | Input | - | - | - | - | - | - |
| email | - | Input | - | - | - | - | - | - |
| phone | - | Input | - | - | - | - | - | - |
| status | - | Select | - | - | - | - | - | - |
| roles | - | RolesChecklist | - | - | - | - | - | - |


## Enums & Schemas Globais
- @/lib/auth/schemas
- @/lib/collectors/schemas
- @/lib/integrations/schemas
- @/lib/pickup/schemas
- @/lib/validation/auth
- @/lib/validation/company
- @/lib/validation/pickup
- @/lib/validation/support
- @/lib/validation/utils

## Stores & Persistência
**Stores Zustand & Hooks relacionados**
- @/store/integrations.store
- @/store/useQuoteStore
- @/stores/auth
- @/stores/checkout
- @/stores/coletas
- @/stores/pontos
- @/stores/support
- @/stores/useAdminSession

## Mocks & Pontos a Eliminar
- Nenhum mock importado foi encontrado automaticamente.

## Itens de Integração Prioritários
- Revisar formulários com validações não mapeadas automaticamente (campos sem metadados).
- Validar consistência dos schemas Zod/Yup identificados com o backend antes de remover mocks.
- Garantir que ações de stores listadas estejam sincronizadas entre rotas de usuário e administrativas.
- Mapear dependências externas (CEP, mascaras) manualmente onde o analisador não identificou.

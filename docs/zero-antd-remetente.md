# Relatório: Zero Imports AntD no Remetente

## Objetivo
Garantir que a aplicação principal (Remetente) fique 100% sem imports diretos de AntD, permitindo:
- Controle total do Design System via wrappers EL*
- Substituição futura da biblioteca de componentes sem refatoração massiva
- Padronização de componentes e comportamentos

## Escopo

### Incluído (Remetente)
- `app/(envio)/**`
- `app/(auth)/**`
- `app/layout.tsx`
- Código em `/modules` e `/shared` usado por essas rotas

### Excluído
- `app/(admin)/**`
- `app/(collector)/**`
- `app/(public)/**`
- `modules/admin/**`
- `modules/collectors/**`
- `modules/pickup-points/**`
- `modules/assistant/**`
- `shared/ui/**` (wrappers são permitidos usar antd)

---

## Wrappers Criados

Total: **37 wrappers EL***

### Wrappers de Componentes
| Wrapper | Descrição |
|---------|-----------|
| ELAlert | Alert com variantes customizadas |
| ELApp | App + useELApp hook |
| ELButton | Button com variantes EL |
| ELCard | Card padronizado |
| ELCheckbox | Checkbox |
| ELCollapse | Collapse + Panel |
| ELConfigProvider | ConfigProvider + locale pt-BR |
| ELDatePicker | DatePicker + RangePicker |
| ELDescriptions | Descriptions + Item |
| ELDivider | Divider |
| ELDrawer | Drawer padronizado |
| ELEmpty | Empty state padronizado |
| ELFlexAntd | Flex do AntD |
| ELForm | Form + useELForm hook |
| ELFormItem | FormItem padronizado |
| ELGrid | Row, Col, ELFlex customizado |
| ELInput | Input + TextArea + Search |
| ELInputNumber | InputNumber |
| ELModal | Modal padronizado |
| ELPopconfirm | Popconfirm |
| ELRadio | Radio + RadioGroup + RadioButton |
| ELResult | Result |
| ELSegmented | Segmented |
| ELSelect | Select |
| ELSkeleton | Skeleton |
| ELSpace | Space |
| ELSpin | Spin loading |
| ELStatistic | Statistic + Row + Col |
| ELStatusTag | Tag de status customizado |
| ELSwitch | Switch |
| ELTable | Table + useBreakpoint |
| ELTableToolbar | Toolbar para tabelas |
| ELTabs | Tabs |
| ELTag | Tag |
| ELTimeline | Timeline |
| ELTypography | Typography + Text + Title + Paragraph + Link |
| ELUpload | Upload + tipos RcFile, UploadFile |

### Arquivo de Tipos
- `shared/ui/antd-types.ts` - Reexporta tipos do AntD (TableProps, UploadFile, RcFile, etc.)

---

## Arquivos Migrados

### app/(envio) e app/(auth)
| Arquivo | Imports Antes | Imports Depois |
|---------|---------------|----------------|
| app/layout.tsx | ConfigProvider, locale | ELConfigProvider, ELLocale |
| app/(envio)/EnvioLayoutClient.tsx | Spin | ELSpin |
| app/(envio)/etiquetas/EtiquetasClient.tsx | App, Spin, Space | ELApp, ELSpin, ELSpace, useELApp |
| app/(envio)/carteira/CarteiraClient.tsx | Typography | ELTypography |
| app/(auth)/auth/confirmacao/loading.tsx | Spin | ELSpin |
| app/(auth)/auth/login/LoginClient.tsx | App, Form, Typography | ELForm, ELTypography, useELApp |

### modules/payments
| Arquivo | Imports Antes | Imports Depois |
|---------|---------------|----------------|
| usePixPayment.ts | App | useELApp |
| CheckoutModal.tsx | App | useELApp |
| CheckoutCartModal.tsx | App, Spin, Space | useELApp, ELSpin, ELSpace |
| PaidCheckoutModal.tsx | App, Space, Typography, Radio, Spin | useELApp, ELSpace, ELTypography, ELRadio, ELSpin |
| PaymentMethodSelector.tsx | Radio, Typography, Space, Spin | ELRadio, ELTypography, ELSpace, ELSpin |
| PixPaymentView.tsx | Typography, Space, Spin | ELTypography, ELSpace, ELSpin |
| CardPaymentView.tsx | Typography, Space | ELTypography, ELSpace |

### modules/cart
| Arquivo | Imports Antes | Imports Depois |
|---------|---------------|----------------|
| CartTable.tsx | Space, Table, Tag, Typography, Grid, TableProps | ELSpace, ELTable, ELTag, ELTypography, useBreakpoint, TableProps |

### modules/quotes
| Arquivo | Imports Antes | Imports Depois |
|---------|---------------|----------------|
| InvoiceItemsTable.tsx | Alert, Empty, Skeleton, Table, Typography, TableProps | ELAlert, ELEmpty, ELSkeleton, ELTable, ELTypography, TableProps |
| MinhasEmbalagensSelect.tsx | App, Spin | useELApp, ELSpin |
| ModalNovaEmbalagem.tsx | App, Form, Input, InputNumber, Space | useELApp, ELForm, ELInput, ELInputNumber, ELSpace |

### modules/labels
| Arquivo | Imports Antes | Imports Depois |
|---------|---------------|----------------|
| LabelModal.tsx | Descriptions, Space, Typography, App, Tag | ELDescriptions, ELSpace, ELTypography, useELApp, ELTag |
| LabelPrintModal.tsx | Checkbox, App, Spin, Divider, Space | ELCheckbox, useELApp, ELSpin, ELDivider, ELSpace |
| LabelsTable.tsx | Table, Space, Tag, Typography, Popconfirm, App, Grid, TableProps | ELTable, ELSpace, ELTag, ELTypography, ELPopconfirm, useELApp, useBreakpoint, TableProps |

### modules/coletas
| Arquivo | Imports Antes | Imports Depois |
|---------|---------------|----------------|
| ColetasTable.tsx | Typography, Space | ELTypography, ELSpace |

### modules/wallet
| Arquivo | Imports Antes | Imports Depois |
|---------|---------------|----------------|
| ResolveDebtModal.tsx | Typography, Space, Radio, Divider, Alert, message, Spin | ELTypography, ELSpace, ELRadio, ELDivider, ELAlert, useELApp, ELSpin |

### modules/auth
| Arquivo | Imports Antes | Imports Depois |
|---------|---------------|----------------|
| useAccount.ts | App | useELApp |

### modules/support
| Arquivo | Imports Antes | Imports Depois |
|---------|---------------|----------------|
| SupportFAQ.tsx | Collapse, Space, Typography, Skeleton, Divider, App | ELCollapse, ELSpace, ELTypography, ELDivider, useELApp |
| NewTicketList.tsx | Tag, Space, Typography, App | ELTag, ELSpace, ELTypography, useELApp |
| SupportForm.tsx | Form, App, Space, Alert | ELForm, useELApp, ELSpace, ELAlert |
| TicketDetailsDrawer.tsx | 13 componentes antd | 13 wrappers EL* |
| TicketCommentBox.tsx | Button, Input, Space, Upload, Typography, App, Checkbox | EL* equivalentes |
| CollectorSupportForm.tsx | Form, Input, Select, Button, App, Space | ELForm, ELInput, ELSelect, ELButton, useELApp, ELSpace |

---

## Verificação

### Comando de Verificação
```bash
rg "from 'antd'" -g '*.ts' -g '*.tsx' \
  | grep -v 'app/(admin)/' \
  | grep -v 'app/(collector)/' \
  | grep -v 'app/(public)/' \
  | grep -v 'modules/admin/' \
  | grep -v 'modules/collectors/' \
  | grep -v 'modules/pickup-points/' \
  | grep -v 'modules/assistant/' \
  | grep -v 'shared/ui/'
```

### Resultado
```
(vazio - 0 resultados)
```

### TypeScript
```bash
npx tsc --noEmit
# Exit code: 0
```

---

## Padrão de Migração

### Estrutura do Import
```typescript
// Antes
import { Space, Typography, App } from 'antd';
const { Text } = Typography;
const { message } = App.useApp();

// Depois
import { ELSpace, ELTypography, useELApp } from '@/shared/ui';
const Space = ELSpace;
const Typography = ELTypography;
const App = { useApp: useELApp };
const { Text } = Typography;
const { message } = App.useApp();
```

### Tipos
```typescript
// Antes
import type { TableProps } from 'antd';

// Depois
import type { TableProps } from '@/shared/ui';
// ou
import type { TableProps } from '@/shared/ui/antd-types';
```

---

## Conclusão

**ZERO imports de antd na aplicação Remetente.**

- 37 wrappers EL* disponíveis
- 30+ arquivos migrados
- TypeScript compila sem erros
- Pronto para substituição futura da biblioteca de componentes

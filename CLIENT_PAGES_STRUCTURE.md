# CLIENT-FACING PAGES STRUCTURE & STYLING ANALYSIS

## Executive Summary
The Next.js application has a well-established client dashboard structure with **24 main client pages** organized under the `app/(dashboard)` route group. A new theme system is being gradually rolled out (NEW_THEME_ENABLED flag), with custom wrapper components (ELCard, ELButton, ELInput, etc.) to manage styling consistency. There are significant inconsistencies in layout patterns, spacing, and component usage across different pages that need standardization.

---

## 1. CLIENT-FACING PAGES STRUCTURE

### A. Main Route Groups

#### (dashboard) - Primary Client Routes
Located: `/app/(dashboard)/`

Protected by `DashboardLayout` which checks authentication and wraps content in `DashboardShell`.

**Structure:**
```
app/(dashboard)/
├── (overview)/
│   └── page.tsx                 # Dashboard home/overview
├── carrinho/
│   └── page.tsx                 # Shopping cart for quotes
├── carteira/
│   ├── page.tsx                 # Wallet balance & recent transactions
│   ├── extrato/page.tsx         # Wallet statements
│   ├── faturas/page.tsx         # Invoices/receipts
│   └── metodos/page.tsx         # Payment methods
├── coletas/
│   ├── [id]/page.tsx            # Pickup detail
│   ├── nova/page.tsx            # Create new pickup
│   └── page.tsx                 # Pickups list
├── conta/
│   └── perfil/page.tsx          # Profile (stub - in development)
├── cotacoes/
│   ├── finalizar/page.tsx       # Finalize quote selection
│   ├── page.tsx                 # Quote/shipping comparison tool
│   └── resultados/page.tsx      # Quote results with selection
├── cotar/page.tsx               # Alternative quote entry point
├── devolucoes/page.tsx          # Returns management
├── etiquetas/page.tsx           # Labels/shipping labels list
├── minha-conta/page.tsx         # Account management (tabs)
├── rastreamento/
│   ├── [id]/page.tsx            # Single shipment tracking detail
│   └── page.tsx                 # Tracking list
├── shipments/
│   ├── [id]/page.tsx            # Shipment detail
│   └── page.tsx                 # Shipments management
├── suporte/
│   ├── [id]/page.tsx            # Support ticket detail
│   ├── novo/page.tsx            # Create new support ticket
│   └── page.tsx                 # Support/help center
└── layout.tsx                   # Protected dashboard layout
```

#### (auth) - Authentication Routes
Located: `/app/(auth)/auth/`
- User registration, password reset (not fully explored)

#### /login - Public Login
Located: `/app/login/page.tsx`
- Public login page (not in (dashboard) group)

### B. Current Page Count
- **Total client pages:** 24 pages (including dynamic routes)
- **Dynamic routes:** 4 detail pages ([id])
- **List views:** 9 main list/table views
- **Forms/Actions:** 4 specific action pages (nova, finalizar, resultados, novo)

---

## 2. MAIN CLIENT PAGES INVENTORY

### Core Pages by Feature Area

#### Dashboard & Overview
- **`(overview)/page.tsx`** - Main dashboard home
  - Displays KPIs, quick actions, recent orders, wallet balance
  - Uses mixed inline styles and Ant Design components
  - Grid-based layout with flexbox (gap: 24px pattern)

#### Quotes/Shipping (Frete)
- **`cotacoes/page.tsx`** - Quote entry form
  - Conditional rendering based on NEW_THEME_ENABLED
  - Uses ELCard wrapper for new theme
  - Custom CSS module for spacing (page.module.css)
  
- **`cotacoes/resultados/page.tsx`** - Quote results & selection
  - Complex form with modals
  - Manages insurance, document type selection
  - Uses Ant Design Modal and Input components directly
  
- **`cotacoes/finalizar/page.tsx`** - Quote checkout (checkout flow)
  - Final purchase confirmation

- **`cotar/page.tsx`** - Alternative quote page
  - May be duplicate/legacy entry point

#### Cart Management
- **`carrinho/page.tsx`** - Shopping cart
  - Complex state management with remove modals
  - Uses Row/Col grid layout from Ant Design
  - Mixed spacing (16px inline with Flexbox gaps)
  - Calls `/api/payments/cart/checkout`

#### Wallet/Financial
- **`carteira/page.tsx`** - Wallet main page
  - Displays balance, add funds modal, transactions
  - Uses basic Card + Table layout

- **`carteira/extrato/page.tsx`** - Wallet statements
  - Transaction history view

- **`carteira/faturas/page.tsx`** - Invoices/receipts
  - Invoice list with PDF download
  - Uses Flex vertical with 24px gap pattern

- **`carteira/metodos/page.tsx`** - Payment methods
  - Card management

#### Shipment Management
- **`shipments/page.tsx`** - Shipments list
  - Table with search, status filter, action buttons
  - Uses Space component for filter layout
  - Ant Design Table with color-coded status tags

- **`shipments/[id]/page.tsx`** - Shipment detail
  - Uses Ant Design Descriptions component
  - Simple inline styling

#### Labels/Shipping Labels
- **`etiquetas/page.tsx`** - Shipping labels
  - Table view with modal preview
  - Uses Breadcrumb component
  - Gap: 12px pattern (smaller than others)

#### Collections/Pickups
- **`coletas/page.tsx`** - Pickups list
  - Status filtering with Tags
  - Table layout
  - Uses variant="borderless" for Cards

- **`coletas/[id]/page.tsx`** - Pickup detail
  - Detail view of a pickup request

- **`coletas/nova/page.tsx`** - Create new pickup
  - Form to schedule pickup

#### Tracking
- **`rastreamento/page.tsx`** - Tracking list
  - Shows shipment status with tracking info
  - Table with status filtering
  - Uses useQueries for parallel tracking requests

- **`rastreamento/[id]/page.tsx`** - Tracking detail
  - Single shipment tracking details

#### Support
- **`suporte/page.tsx`** - Support/help center
  - Ticket list with filters
  - Create new ticket button
  - Padding: 24px wrapper (different pattern)

- **`suporte/novo/page.tsx`** - Create support ticket
  - Form to create new support request

- **`suporte/[id]/page.tsx`** - Support ticket detail
  - Single ticket view with messages

#### Account Management
- **`minha-conta/page.tsx`** - Account settings
  - Uses inline h2 styles (margin-bottom: 4px, fontSize: 28px)
  - Tabbed interface
  - **INCONSISTENCY:** Not using Typography components or EL* wrappers

- **`conta/perfil/page.tsx`** - Profile (stub)
  - Under development - minimal placeholder

- **`devolucoes/page.tsx`** - Returns management
  - Not yet explored but likely list/form

---

## 3. LAYOUT COMPONENTS ANALYSIS

### A. DashboardShell (Main Container)
**Location:** `/components/layout/dashboard-shell.tsx`

**Structure:**
```
Layout (minHeight: 100dvh, background: var(--bg, #f5f7fb))
├── Sider (width: 240px, collapsible, breakpoint: lg)
│   ├── Logo area (height: 56px)
│   └── Menu (inline mode, 9 items)
├── Layout
│   ├── Header (height: 56px)
│   │   ├── Toggle button
│   │   └── User info + Logout
│   └── Content (padding: 16px)
│       └── {children}
```

**Navigation Items (9 total):**
1. Visão geral (/) - HomeOutlined
2. Cotar envio (/cotacoes) - SearchOutlined
3. Carrinho (/carrinho) - ShoppingCartOutlined
4. Etiquetas (/etiquetas) - FileAddOutlined
5. Gestão de envios (/shipments) - ri-truck-line
6. Coletas (/coletas) - CalendarOutlined
7. Carteira (/carteira) - WalletOutlined
8. Suporte (/suporte) - CustomerServiceOutlined
9. Minha conta (/minha-conta) - SettingOutlined

**Issues Found:**
- Inline styles for layout (not in CSS modules)
- Hard-coded colors (#fff, #f0f0f0) instead of CSS variables
- Collapse state stored in localStorage
- Header height (56px) vs content padding (16px) creates uneven spacing

### B. Content Layout Patterns
Most pages use:
```
<Flex vertical gap={24}>
  <Space direction="vertical" size={4}>
    <Typography.Title level={2} style={{ margin: 0 }}>...</Typography.Title>
    <Typography.Paragraph type="secondary" style={{ margin: 0 }}>...</Typography.Paragraph>
  </Space>
  {/* Page content */}
</Flex>
```

**Inconsistencies:**
- Some pages use `<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>`
- Some use `gap={24}`, others `gap={16}`
- Some pages have custom wrapper `<section>` with CSS modules
- `minha-conta` uses raw `<h2>` and `<p>` tags instead of Typography

---

## 4. STYLING APPROACH ANALYSIS

### A. CSS Variable System
**Root CSS Variables (app/globals.css):**

**Legacy Theme (default):**
```css
--color-background: #f4f6fb
--color-surface: #ffffff
--color-primary: #0b3b73
--color-secondary: #ff6b11
--color-text: #1a1c1f
--color-border: #d8dde8
```

**New Theme (html[data-new-theme="true"]):**
```css
--color-background: #F7F8FA
--color-surface: #FFFFFF
--color-primary: #003873
--color-secondary: #E4660C
--color-text: #182235
--color-border: #CFD8E6
--el-shadow-soft: 0 20px 48px rgba(0, 56, 115, 0.12)
--el-radius-base: 12px
--el-spacing-xs: 4px
--el-spacing-sm: 8px
--el-spacing-md: 12px
--el-spacing-lg: 16px
--el-spacing-xl: 24px
```

### B. Ant Design Theme Configuration
**Location:** `/src/styles/theme.ts`

**Token System:**
```typescript
export const spacing = {
  xs: 4,    // 4px
  sm: 8,    // 8px
  md: 12,   // 12px
  lg: 16,   // 16px
  xl: 24,   // 24px
}

// Light tokens
colorPrimary: #003873
colorWarning: #E4660C
colorSuccess: #1E8E5A
borderRadius: 12px
boxShadow: "0 20px 48px rgba(0, 56, 115, 0.12)"

// Component tokens
Button: height: 44px, padding: 20px, borderRadius: 12px
Card: borderRadius: 16px, padding: 16px
Form: itemMarginBottom: 16px
Input: borderRadius: 8px, height: 44px, padding: 8px
Select: borderRadius: 8px, height: 44px
```

### C. CSS Modules for Styling

#### ELCard.module.css
```css
.card {
  border: 1px solid rgba(0, 56, 115, 0.1);
  border-radius: var(--el-radius-base, 12px);
  box-shadow: var(--el-shadow-soft, ...);
  background: var(--color-surface, #ffffff);
}

.header {
  display: flex;
  gap: var(--el-spacing-xs, 4px);
  margin-bottom: var(--el-spacing-md, 12px);
}

.headerTitle {
  margin: 0;
  color: var(--color-primary, #003873);
  font-weight: 600;
}
```

#### ELButton.module.css
```css
.button {
  height: 44px;
  border-radius: var(--el-radius-base, 12px);
  font-weight: 600;
  padding-inline: 20px;
  transition: background-color 0.2s ease, ...;
}

.buttonPrimary {
  background-color: var(--color-primary, #003873);
  color: #ffffff;
}

.buttonDefault {
  background-color: #ffffff;
  border-color: rgba(0, 56, 115, 0.18);
}
```

#### ELInput.module.css
```css
.input {
  border-radius: var(--el-radius-base, 8px);
  height: 44px;
}
```

#### ELEmpty.module.css
```css
.empty {
  display: flex;
  flex-direction: column;
  gap: var(--el-spacing-lg, 16px);
  align-items: center;
  padding: var(--el-spacing-lg, 16px);
}

.title {
  color: var(--color-primary, #003873);
}
```

#### page.module.css (cotacoes page specific)
```css
.container {
  display: flex;
  flex-direction: column;
  gap: var(--el-spacing-xl, 24px);
  padding-block: var(--el-spacing-xl, 24px);
}

.header {
  display: flex;
  flex-direction: column;
  gap: var(--el-spacing-xs, 4px);
}

.title {
  color: var(--color-primary, #003873);
}
```

### D. Styling Approach Summary

| Aspect | Current Usage | Issues |
|--------|---------------|--------|
| **CSS Variables** | Global (globals.css) + theme tokens | Legacy vs new theme split; inconsistent application |
| **CSS Modules** | EL* components only | Not used for page layouts |
| **Inline Styles** | Heavy usage in pages | Difficult to maintain, no single source of truth |
| **Ant Design Components** | Cards, Tables, Buttons, Forms, Typography | Used directly without wrapper |
| **Custom Wrappers** | ELCard, ELButton, ELInput, ELEmpty, ELTag, ELSkeleton | Only in some pages; not universally used |
| **Spacing System** | Flexbox gaps (16, 24px) or inline margin styles | No consistent system across all pages |
| **Border Radius** | CSS variable (12px new, 8px legacy) | Mostly applied, but some hardcoded |
| **Typography** | Ant Design Typography + custom styling | Inconsistent heading/paragraph usage |

---

## 5. FORMS, TABLES & UI ELEMENTS IMPLEMENTATION

### A. Forms Implementation

#### Quote Form
**File:** `/components/forms/quote-form.tsx`

**Stack:**
- React Hook Form + Zod validation
- Ant Design Form component (native, not our wrapper)
- Custom inputs for dimensions, weight, etc.
- State management via Zustand

**Issues:**
- Direct Ant Design Form usage
- No form component wrapper (like ELForm)
- Complex conditional logic for rendering

#### Company Setup Form
**File:** `/components/forms/company-step-*.tsx`

**Components:**
- company-step-empresa.tsx
- company-step-endereco.tsx
- company-step-preferencias.tsx

#### Label/Shipment Form
**File:** `/components/forms/label-shipment-form.tsx`

**Issues:**
- Large 24KB file size
- Complex nested forms
- Direct Ant Design component usage

### B. Table Implementations

#### Patterns Used
All tables follow similar pattern:
```tsx
<Table<DataType>
  rowKey="id"
  loading={isLoading}
  dataSource={items}
  pagination={{ pageSize: 10 }}
  columns={[
    { title: "Column", dataIndex: "field" },
    { title: "Actions", render: (_, record) => <Button>Action</Button> }
  ]}
/>
```

#### Tables in Pages

| Page | Table | Features |
|------|-------|----------|
| shipments | Shipments | Search, status filter, action buttons, inline rendering |
| cotacoes/resultados | Quote results | Sort, selection with modals |
| coletas | Pickups | Status filter, pagination |
| rastreamento | Tracking | Multi-query fetch, status filter |
| etiquetas | Labels | Modal preview |
| carteira/faturas | Invoices | PDF download link |
| minha-conta | Various | Tabs with different tables |

**Issues:**
- No consistent table styling/wrapper
- Pagination inconsistent (pageSize: 5, 6, 10)
- Status colors hard-coded in component
- Action buttons use direct Button imports, not ELButton

### C. Custom Input Components

#### CepInput
**File:** `/components/form/CepInput.tsx`
- Custom CEP (postal code) input with validation
- Fetches city/state data

#### ELInput Components
- **ELInput** - Main input wrapper
- **ELInput.Password** - Password field
- **ELInput.TextArea** - Text area field

**Issues:**
- ForwardRef complexity
- Fallback behavior when NEW_THEME_ENABLED is false

### D. Custom UI Components Inventory

**Located:** `/components/ui/`

| Component | Purpose | Status |
|-----------|---------|--------|
| ELCard | Card wrapper with header config | Stable |
| ELButton | Button with variants (primary, default, link) | Stable |
| ELInput | Input wrapper (text, password, textarea) | Stable |
| ELSelect | Select wrapper | Basic |
| ELTag | Tag component | Basic |
| ELSkeleton | Loading skeleton | Basic |
| ELEmpty | Empty state with actions | Stable |
| ELFormItem | Form item wrapper | Basic |
| FormCard | Generic form card | Unused? |
| QuoteResultCard | Quote result display | Specific |
| QuoteSummary | Quote summary display | Specific |
| ShipmentStatusBadge | Status display | Specific |
| LabelPreview | Label preview modal | Specific |

---

## 6. IDENTIFIED INCONSISTENCIES

### A. Layout & Spacing Inconsistencies

**Problem 1: Inconsistent Gap Values**
```tsx
// Pattern 1: Large gap
<Flex vertical gap={24}>
  {/* Dashboard, shipments, cotacoes pages */}

// Pattern 2: Medium gap
<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
  {/* shipments/page.tsx, carteira/page.tsx */}

// Pattern 3: Small gap
<Flex vertical gap={12}>
  {/* etiquetas/page.tsx */}

// Pattern 4: Custom CSS module
<section className={styles.container}> {/* gap: var(--el-spacing-xl, 24px) */}
  {/* cotacoes/page.tsx */}
```

**Severity:** HIGH - Affects visual consistency

**Problem 2: Header Section Inconsistency**
```tsx
// Standard pattern
<Space direction="vertical" size={4}>
  <Typography.Title level={2} style={{ margin: 0 }}>...</Typography.Title>
  <Typography.Paragraph type="secondary" style={{ margin: 0 }}>...</Typography.Paragraph>
</Space>

// minha-conta uses raw HTML
<h2 style={{ marginBottom: 4, fontSize: 28, fontWeight: 600 }}>...</h2>
<p style={{ marginBottom: 0, color: "rgba(0,0,0,0.45)" }}>...</p>

// suporte uses custom padding
<Space direction="vertical" style={{ width: "100%", padding: 24 }} size={24}>
```

**Severity:** MEDIUM - Affects accessibility and maintainability

**Problem 3: Card Variant Usage**
```tsx
// Most common
<Card variant="borderless">
  {/* Used in coletas, rastreamento, carteira/faturas */}

// Standard Card
<Card title="...">
  {/* Used in shipments detail, carteira */}

// ELCard wrapper
<ELCard header={{ title: "...", description: "..." }}>
  {/* Used only in cotacoes page */}
```

**Severity:** MEDIUM - New theme inconsistency

### B. Typography Inconsistencies

**Problem 4: Title Level Usage**
```tsx
// level={2} - Most pages
<Typography.Title level={2} style={{ margin: 0 }}>...</Typography.Title>

// level={3} - ELCard wrapper uses
<Typography.Title level={3} className={styles.headerTitle}>...</Typography.Title>

// Raw h2 - minha-conta
<h2 style={{ marginBottom: 4, fontSize: 28, fontWeight: 600 }}>...</h2>
```

**Severity:** MEDIUM - Semantic HTML and accessibility issues

### C. Button Usage Inconsistencies

**Problem 5: Button Type Variations**
```tsx
// Ant Design direct import
<Button type="primary" onClick={...}>...</Button>

// Ant Design with variant
<Button type="primary" variant="solid" icon={<PlusOutlined />}>...</Button>

// No ELButton wrapper usage in client pages
// ELButton exists but not used in dashboard pages
```

**Severity:** HIGH - New theme won't apply to buttons

### D. Component Wrapper Adoption

**Problem 6: Selective EL* Component Usage**
```tsx
// Properly used in cotacoes page
<ELCard header={{ title: "...", description: "..." }}>
  <QuoteForm {...props} />
</ELCard>

// NOT used in other pages
// shipments/page.tsx uses Card directly
// carteira/page.tsx uses Card directly
// coletas/page.tsx uses Card directly
```

**Severity:** HIGH - New theme won't be applied consistently

### E. Form Implementation Inconsistencies

**Problem 7: Direct Ant Design Form Usage**
- Quote form uses raw Ant Design Form component
- No ELFormItem wrapper
- No consistent form styling across pages

**Severity:** MEDIUM - Forms styling won't match theme

### F. Admin vs Client Styling Differences

**Admin Layout** (`/app/(admin)/admin/layout.tsx`):
```tsx
// Dark theme Sider
<Layout.Sider theme="dark">
// Content padding
<Layout.Content style={{ padding: 24 }}>
```

**Client Layout** (`/components/layout/dashboard-shell.tsx`):
```tsx
// Light theme Sider, no theme prop
<Sider style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
// Content padding
<Content style={{ padding: 16 }}>
```

**Severity:** HIGH - Should harmonize styling approach

---

## 7. THEME IMPLEMENTATION STATUS

### A. NEW_THEME_ENABLED Feature Flag
**Location:** `/lib/features/new-theme`

**Affected Components:**
- ELCard - Conditional wrapper header
- ELButton - Conditional styling classes
- ELInput - Conditional className application
- ELEmpty - Conditional layout
- Some pages (cotacoes) use conditional rendering

**Usage Pattern:**
```tsx
if (!NEW_THEME_ENABLED) {
  return <LegacyComponent {...props} />;
}

return <NewThemedComponent {...props} />;
```

### B. Theme Application Status

| Component | Legacy Support | New Theme Support | CSS Modules | Issues |
|-----------|---|---|---|---|
| ELCard | Yes | Yes | Yes | Only used in cotacoes page |
| ELButton | Yes | Yes | Yes | Not used in pages |
| ELInput | Yes | Yes | Yes | Mostly unused |
| ELEmpty | Yes | Yes | Yes | Mostly unused |
| Quote Form | Partial | Partial | No | Direct Ant Design usage |
| Tables | No | No | No | Need wrapper |
| Buttons | No | No | No | All direct Button imports |
| Layout | No | No | No | Inline styles in dashboard-shell |

---

## 8. SUMMARY TABLE: PAGES REQUIRING HARMONIZATION

| Page | Gap Spacing | Card Type | Typography | Buttons | Forms | Tables | EL* Usage | Priority |
|------|---|---|---|---|---|---|---|---|
| (overview) | 24 | Card | Typography ✓ | Direct | N/A | None | No | HIGH |
| cotacoes | 24 | ELCard | Typography ✓ | Direct | RHF | N/A | Yes | MEDIUM |
| cotacoes/resultados | 24 | Card | Typography ✓ | Direct | Complex | N/A | No | HIGH |
| shipments | 16 | Card | Typography ✓ | Direct | N/A | Yes | No | HIGH |
| shipments/[id] | 24 | Card | Typography ✓ | Direct | N/A | Desc. | No | HIGH |
| carrinho | 16 | Card | Typography ✓ | Direct | N/A | Yes | Partial | HIGH |
| carteira | 16 | Card | Typography ✓ | Direct | N/A | Yes | No | HIGH |
| carteira/faturas | 24 | Card | Typography ✓ | Direct | No | Yes | No | MEDIUM |
| coletas | 24 | Card | Typography ✓ | Direct | N/A | Yes | No | MEDIUM |
| rastreamento | 24 | Card | Typography ✓ | Direct | N/A | Yes | No | MEDIUM |
| etiquetas | 12 | N/A | Typography ✓ | Direct | N/A | Yes | No | MEDIUM |
| suporte | 24 | Card | Typography ✓ | Direct | N/A | N/A | No | MEDIUM |
| minha-conta | 24 | N/A | HTML ✗ | Direct | N/A | Tabs | No | CRITICAL |
| conta/perfil | N/A | N/A | HTML ✗ | N/A | N/A | N/A | No | LOW |

---

## 9. RECOMMENDATIONS

### Phase 1: Immediate Standardization
1. **Create page layout wrapper component** - Consistent gap, padding, structure
2. **Standardize header sections** - Use consistent Typography pattern
3. **Create table wrapper component** - Consistent styling, pagination
4. **Fix minha-conta page** - Use Typography instead of raw HTML

### Phase 2: Component Adoption
1. **Create and use form wrapper** (ELForm, ELFormItem)
2. **Replace all Button usage** with ELButton
3. **Replace Card usage** with ELCard (or create ELCardList for tables)
4. **Migrate quote form** to use wrapper components

### Phase 3: Dashboard Layout Modernization
1. **Move inline styles to CSS module** - dashboard-shell.tsx
2. **Apply CSS variables** to all hardcoded colors
3. **Standardize DashboardShell spacing**

### Phase 4: Admin Harmonization
1. **Align admin layout** with client layout approach
2. **Apply same theming system** to admin pages
3. **Create shared layout components**


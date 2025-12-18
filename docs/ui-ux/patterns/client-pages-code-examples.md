# CLIENT PAGES - CODE EXAMPLES & PATTERNS

## Quick Reference Guide for Styling and Component Usage

---

## 1. SPACING & LAYOUT PATTERNS

### Standard Page Layout (RECOMMENDED)
```tsx
// Use this pattern for all new pages
import { Flex, Space, Typography } from "antd";

export default function ExamplePage() {
  return (
    <Flex vertical gap={24}>
      {/* Header Section */}
      <Space direction="vertical" size={4}>
        <Typography.Title level={2} style={{ margin: 0 }}>
          Page Title
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
          Page description and subtitle
        </Typography.Paragraph>
      </Space>

      {/* Content Area */}
      <div>
        {/* Main content */}
      </div>
    </Flex>
  );
}
```

### Current Spacing Values
- **xl: 24px** - Main vertical spacing between sections (preferred)
- **lg: 16px** - Secondary spacing (avoid mixing)
- **md: 12px** - Small element spacing
- **sm: 8px** - Minor spacing
- **xs: 4px** - Header/title spacing

### Spacing Inconsistencies (AVOID)
```tsx
// WRONG - Inconsistent gap
<div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
  {/* Should use Flex component with gap={24} */}
</div>

// WRONG - Custom padding
<Space direction="vertical" style={{ width: "100%", padding: 24 }}>
  {/* Extra padding creates inconsistency */}
</Space>

// WRONG - Small gap on page level
<Flex vertical gap={12}>
  {/* Should be gap={24} for consistency */}
</Flex>
```

---

## 2. TYPOGRAPHY PATTERNS

### Standard Heading Pattern (RECOMMENDED)
```tsx
import { Space, Typography } from "antd";

// Page/section header
<Space direction="vertical" size={4}>
  <Typography.Title level={2} style={{ margin: 0 }}>
    Main Heading
  </Typography.Title>
  <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
    Supporting description text
  </Typography.Paragraph>
</Space>

// Subsection header
<Typography.Title level={3} style={{ margin: 0 }}>
  Subsection
</Typography.Title>

// Body text
<Typography.Paragraph>
  Body text with default styling
</Typography.Paragraph>

// Secondary/muted text
<Typography.Text type="secondary">
  Secondary text for metadata or hints
</Typography.Text>
```

### Typography Anti-patterns (AVOID)
```tsx
// WRONG - Raw HTML heading (used in minha-conta)
<h2 style={{ marginBottom: 4, fontSize: 28, fontWeight: 600 }}>
  Page Title
</h2>
<p style={{ marginBottom: 0, color: "rgba(0,0,0,0.45)" }}>
  Description
</p>

// WRONG - Inline color override
<Typography.Title level={2} style={{ color: "#003873", margin: 0 }}>
  Title
</Typography.Title>
// Use theme colors instead

// WRONG - Manual font sizing
<Typography.Title style={{ fontSize: 24 }}>
  Title
</Typography.Title>
// Use level prop instead
```

---

## 3. CARD PATTERNS

### Standard Card with Header (RECOMMENDED - New Theme)
```tsx
import { ELCard } from "@/components/ui/ELCard";

<ELCard
  header={{
    title: "Card Title",
    description: "Optional description text",
    extra: <Button>Action</Button> // Optional extra content
  }}
  padding="lg"
  bodyGap="md"
>
  {/* Card content */}
</ELCard>
```

### Standard Card without Header (RECOMMENDED)
```tsx
import { ELCard } from "@/components/ui/ELCard";

<ELCard>
  {/* Content goes here */}
</ELCard>
```

### Borderless Card (for table containers)
```tsx
import { Card } from "antd";

<Card variant="borderless">
  <Table {...tableProps} />
</Card>
```

### Card Anti-patterns (AVOID)
```tsx
// WRONG - Raw Ant Design Card (won't apply new theme)
<Card title="Title">
  Content
</Card>

// WRONG - Inline styling
<Card style={{ padding: 24, borderRadius: 12 }}>
  Content
</Card>

// WRONG - Using variant directly with Ant Design
<Card variant="bordered">
  {/* This won't match theme */}
</Card>
```

---

## 4. BUTTON PATTERNS

### Standard Button Usage (RECOMMENDED)
```tsx
import { ELButton } from "@/components/ui/ELButton";

// Primary action
<ELButton variant="primary" onClick={handleAction}>
  Primary Action
</ELButton>

// Secondary/default action
<ELButton variant="default" onClick={handleAction}>
  Secondary Action
</ELButton>

// Link-style button
<ELButton variant="link" onClick={handleAction}>
  Link Action
</ELButton>

// With icon
<ELButton variant="primary" icon={<PlusOutlined />}>
  Create New
</ELButton>

// Disabled state
<ELButton variant="primary" disabled>
  Disabled
</ELButton>

// Loading state
<ELButton variant="primary" loading={isLoading}>
  Submit
</ELButton>
```

### Button Anti-patterns (AVOID)
```tsx
// WRONG - Direct Ant Design import (used in most pages)
<Button type="primary" onClick={...}>
  Button
</Button>
// Use ELButton instead

// WRONG - Inline styling
<Button style={{ borderRadius: 12, height: 44 }}>
  Button
</Button>
// ELButton handles this

// WRONG - Variant prop on Ant Design Button
<Button type="primary" variant="solid">
  Button
</Button>
// Use ELButton with variant prop
```

---

## 5. INPUT PATTERNS

### Standard Input Usage (RECOMMENDED)
```tsx
import { ELInput } from "@/components/ui/ELInput";

// Text input
<ELInput 
  placeholder="Enter text" 
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>

// Password input
<ELInput.Password
  placeholder="Enter password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>

// Text area
<ELInput.TextArea
  placeholder="Enter longer text"
  value={text}
  onChange={(e) => setText(e.target.value)}
  autoSize={{ minRows: 3, maxRows: 6 }}
/>

// With form integration
<Form.Item
  label="Email"
  name="email"
  rules={[{ required: true }]}
>
  <ELInput placeholder="email@example.com" />
</Form.Item>
```

### Input Anti-patterns (AVOID)
```tsx
// WRONG - Direct Ant Design Input
import Input from "antd";
<Input placeholder="..." />

// WRONG - Custom styling
<Input style={{ borderRadius: 12, height: 44 }} />
// ELInput handles this
```

---

## 6. TABLE PATTERNS

### Standard Table Implementation (CURRENT)
```tsx
import { Table, Card } from "antd";
import { Button, Space, Tag } from "antd";

export default function ListPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const columns = [
    { title: "ID", dataIndex: "id" },
    { 
      title: "Status",
      dataIndex: "status",
      render: (status) => <Tag color={STATUS_COLORS[status]}>{status}</Tag>
    },
    {
      title: "Actions",
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => handleView(record.id)}>
            View
          </Button>
          <Button type="link" danger onClick={() => handleDelete(record.id)}>
            Delete
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Flex vertical gap={24}>
      <Typography.Title level={2}>Items List</Typography.Title>
      
      <Card variant="borderless">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data}
          columns={columns}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </Flex>
  );
}
```

### Table Anti-patterns (AVOID)
```tsx
// WRONG - Inconsistent pagination
<Table pagination={{ pageSize: 5 }} />
<Table pagination={{ pageSize: 6 }} />
<Table pagination={{ pageSize: 10 }} />
// Use consistent pageSize (10 recommended)

// WRONG - Hard-coded status colors
const colors = { "active": "green", "inactive": "red" };
// Use centralized STATUS_COLORS mapping

// WRONG - Action buttons not using wrapper
<Button type="primary">View</Button>
// Should use ELButton when theme support needed
```

---

## 7. FORM PATTERNS

### React Hook Form Integration
```tsx
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Form, Input } from "antd";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

type FormValues = z.infer<typeof schema>;

export default function LoginForm() {
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <Form.Item
            label="Email"
            validateStatus={errors.email ? "error" : ""}
            help={errors.email?.message}
          >
            <Input {...field} placeholder="email@example.com" />
          </Form.Item>
        )}
      />

      <Form.Item>
        <Button type="primary" htmlType="submit">
          Login
        </Button>
      </Form.Item>
    </form>
  );
}
```

### Simple Form (Ant Design native)
```tsx
import { Form, Input, Button } from "antd";

export default function SimpleForm() {
  const [form] = Form.useForm();

  const onFinish = (values) => {
    console.log(values);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
    >
      <Form.Item
        label="Email"
        name="email"
        rules={[
          { required: true, message: "Required" },
          { type: "email", message: "Invalid email" }
        ]}
      >
        <Input placeholder="email@example.com" />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit">
          Submit
        </Button>
      </Form.Item>
    </Form>
  );
}
```

---

## 8. EMPTY STATE PATTERN

### Using ELEmpty Component (RECOMMENDED - New Theme)
```tsx
import { ELEmpty } from "@/components/ui/ELEmpty";
import { ELButton } from "@/components/ui/ELButton";

<ELEmpty
  title="No results found"
  description="Try adjusting your search or filters"
  primaryAction={{
    label: "Clear filters",
    onClick: handleClearFilters
  }}
  secondaryAction={{
    label: "Go back",
    onClick: handleGoBack
  }}
/>
```

### Fallback Empty State
```tsx
import { Empty, Button, Space } from "antd";

<Empty description="No results">
  <Space>
    <Button type="primary" onClick={handleAction}>
      Action
    </Button>
  </Space>
</Empty>
```

---

## 9. CSS MODULE USAGE

### Page-level CSS Module (WHEN NEEDED)
```tsx
// page.module.css
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
  margin: 0 !important;
  color: var(--color-primary, #003873);
}

.subtitle {
  margin: 0 !important;
  color: rgba(24, 34, 53, 0.72);
}

// page.tsx
import styles from "./page.module.css";

export default function Page() {
  return (
    <section className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Title</h1>
        <p className={styles.subtitle}>Subtitle</p>
      </div>
    </section>
  );
}
```

### CSS Variables Available
```css
/* Colors */
--color-background: #F7F8FA
--color-surface: #FFFFFF
--color-primary: #003873
--color-secondary: #E4660C
--color-text: #182235
--color-border: #CFD8E6

/* Spacing */
--el-spacing-xs: 4px
--el-spacing-sm: 8px
--el-spacing-md: 12px
--el-spacing-lg: 16px
--el-spacing-xl: 24px

/* Effects */
--el-shadow-soft: 0 20px 48px rgba(0, 56, 115, 0.12)
--el-radius-base: 12px
```

---

## 10. CURRENT INCONSISTENCIES & FIXES

### Issue 1: minha-conta Page (CRITICAL)
**Current (WRONG):**
```tsx
<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
  <div>
    <h2 style={{ marginBottom: 4, fontSize: 28, fontWeight: 600 }}>
      Minha Conta
    </h2>
    <p style={{ marginBottom: 0, color: "rgba(0,0,0,0.45)" }}>
      Description
    </p>
  </div>
  <AccountTabs />
</div>
```

**Fixed (RECOMMENDED):**
```tsx
<Flex vertical gap={24}>
  <Space direction="vertical" size={4}>
    <Typography.Title level={2} style={{ margin: 0 }}>
      Minha Conta
    </Typography.Title>
    <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
      Gerencie seus dados pessoais, endereços, cartões e segurança.
    </Typography.Paragraph>
  </Space>
  <AccountTabs />
</Flex>
```

### Issue 2: Button Usage (HIGH Priority)
**Current (WRONG - used everywhere):**
```tsx
import { Button } from "antd";

<Button type="primary" onClick={...}>Action</Button>
<Button type="link">Link</Button>
<Button danger>Delete</Button>
```

**Fixed (RECOMMENDED):**
```tsx
import { ELButton } from "@/components/ui/ELButton";

<ELButton variant="primary" onClick={...}>Action</ELButton>
<ELButton variant="link">Link</ELButton>
<ELButton variant="default" danger>Delete</ELButton>
```

### Issue 3: Card Inconsistency
**Current (INCONSISTENT):**
```tsx
// Most pages
<Card variant="borderless">
  <Table {...props} />
</Card>

// Quote page
<ELCard header={{ title: "Detalhes" }}>
  <QuoteForm />
</ELCard>

// Some pages
<Card title="Title">
  Content
</Card>
```

**Fixed (RECOMMENDED):**
```tsx
// For containers with title/header
<ELCard header={{ title: "Title", description: "..." }}>
  Content
</ELCard>

// For simple containers (tables, etc)
<Card variant="borderless">
  <Table {...props} />
</Card>

// Avoid mixing Ant Design Card with ELCard
```

---

## 11. QUICK CHECKLIST FOR NEW PAGES

When creating a new client page, use this checklist:

- [ ] Use `<Flex vertical gap={24}>` for main layout
- [ ] Use Typography.Title level={2} with style={{ margin: 0 }}
- [ ] Use Typography.Paragraph type="secondary" for descriptions
- [ ] Use `<Space direction="vertical" size={4}>` for header section
- [ ] Use ELCard or Card variant="borderless" for content areas
- [ ] Use ELButton instead of Button for styled buttons
- [ ] Use ELInput for form inputs (when available)
- [ ] Use CSS variables for colors (not hardcoded hex)
- [ ] Use consistent pagination pageSize (pageSize={10})
- [ ] Avoid inline styles where possible
- [ ] Use CSS modules for complex page styling
- [ ] Avoid raw HTML headings (use Typography)
- [ ] Check for accessibility (semantic HTML, ARIA labels)

---

## 12. COMPONENT IMPORTS REFERENCE

```tsx
// Layout & Structure
import { Flex, Space, Layout, Card, Row, Col } from "antd";

// Typography
import { Typography } from "antd"; // Or import Typography from "antd/es/typography"
// Usage: <Typography.Title>, <Typography.Paragraph>, <Typography.Text>

// Forms
import { Form, Input, Select, Button, Checkbox, Radio } from "antd";
import { useForm, Controller } from "react-hook-form";

// Data Display
import { Table, Tag, Badge, List, Empty, Descriptions } from "antd";

// Feedback
import { Modal, Alert, Message, Notification } from "antd";

// Custom Components
import { ELCard } from "@/components/ui/ELCard";
import { ELButton } from "@/components/ui/ELButton";
import { ELInput } from "@/components/ui/ELInput";
import { ELEmpty } from "@/components/ui/ELEmpty";
import { ELTag } from "@/components/ui/ELTag";
import { ELSkeleton } from "@/components/ui/ELSkeleton";

// Icons
import { 
  PlusOutlined, 
  DeleteOutlined, 
  EditOutlined,
  SearchOutlined,
  // ... and many more from @ant-design/icons
} from "@ant-design/icons";
```


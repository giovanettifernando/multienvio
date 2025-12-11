'use client';

import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Layout from 'antd/es/layout';
import Menu from 'antd/es/menu';
import Flex from 'antd/es/flex';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { sidebarItems } from './sidebar-items';
import { UserPanel } from './UserPanel';
import type { MenuProps } from 'antd';
import styles from './Sidebar.module.css';

const { Sider } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

interface SidebarProps {
  collapsed: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

function keyFromPath(pathname: string): string {
  if (pathname === '/' || pathname === '/dashboard') return 'overview';

  // Match exact path
  const exactMatch = sidebarItems.find((i) => i.href === pathname);
  if (exactMatch) return exactMatch.key;

  // Match by prefix (for subroutes like /cotacoes/finalizar)
  const prefixMatch = sidebarItems.find((i) => pathname.startsWith(i.href + '/'));
  if (prefixMatch) return prefixMatch.key;

  // Fallback
  return 'overview';
}

export function Sidebar({ collapsed, onCollapse }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const selectedKey = useMemo(() => keyFromPath(pathname || '/'), [pathname]);

  // Build menu items with proper icon support for collapsed state
  const menuItems: MenuItem[] = sidebarItems.map((item) => {
    const IconComponent = item.icon;
    return {
      key: item.key,
      icon: <IconComponent />,
      label: item.label,
      onClick: () => router.push(item.href),
    };
  });

  // Sidebar content
  const sidebarContent = (
    <div className={styles.content}>
      {/* Logo */}
      <div className={styles.logo}>
        {collapsed ? (
          <div className={styles.logoText}>EL</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/assets/logo-envio-legal-branca.svg"
            alt="Envio Legal"
            className={styles.logoImage}
          />
        )}
      </div>

      {/* User Panel - MOVED TO TOP */}
      <UserPanel collapsed={collapsed} />

      {/* Menu */}
      <div className={styles.menuWrapper}>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[selectedKey]}
          items={menuItems}
          inlineCollapsed={collapsed}
          style={{
            border: 0,
            padding: '16px 8px',
            background: 'var(--sidebar-bg)',
          }}
        />
      </div>
    </div>
  );

  return (
    <Sider
      width={280}
      collapsedWidth={80}
      collapsed={collapsed}
      onCollapse={onCollapse}
      breakpoint="lg"
      onBreakpoint={(broken) => {
        if (broken && onCollapse) {
          onCollapse(true);
        }
      }}
      collapsible
      trigger={
        <div className={styles.trigger}>
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      }
      className={styles.sidebar}
    >
      {sidebarContent}
      <style jsx global>{`
        /* Fixed sidebar on desktop */
        @media (min-width: 768px) {
          .ant-layout-sider {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            bottom: 0 !important;
            height: 100vh !important;
            z-index: 1000 !important;
          }
        }

        /* Mobile sidebar (not fixed) */
        @media (max-width: 767px) {
          .ant-layout-sider {
            position: relative !important;
          }
        }

        /* Blue theme for dark menu */
        .ant-layout-sider {
          background: var(--sidebar-bg) !important;
        }

        .ant-menu-dark,
        .ant-menu-dark .ant-menu-sub {
          background: var(--sidebar-bg);
        }

        .ant-menu-dark .ant-menu-item,
        .ant-menu-dark .ant-menu-submenu-title {
          color: var(--sidebar-text);
          border-radius: var(--el-radius-base);
          margin: 4px 8px;
          padding-inline: 12px !important;
        }

        .ant-menu-dark .ant-menu-item:hover {
          background: var(--sidebar-hover);
        }

        .ant-menu-dark .ant-menu-item-selected {
          background: var(--sidebar-active) !important;
          color: var(--sidebar-text-active) !important;
          font-weight: 500;
        }

        .ant-menu-dark .ant-menu-item-selected::after {
          display: none;
        }

        .ant-menu-dark .ant-menu-item .anticon,
        .ant-menu-dark .ant-menu-submenu-title .anticon {
          color: var(--sidebar-text-active);
          font-size: 18px;
        }

        /* IMPORTANT: Keep icons visible when collapsed */
        .ant-menu-inline-collapsed .ant-menu-item .ant-menu-item-icon,
        .ant-menu-inline-collapsed .ant-menu-item .anticon,
        .ant-menu-inline-collapsed .ant-menu-submenu-title .anticon {
          display: inline-flex !important;
          visibility: visible !important;
          width: 22px;
          height: 22px;
          align-items: center;
          justify-content: center;
          color: var(--sidebar-text-active) !important;
        }

        /* Hide only the text when collapsed (AntD handles this, we ensure) */
        .ant-menu-inline-collapsed .ant-menu-title-content {
          display: none !important;
        }

        /* Collapsed menu items centered */
        .ant-menu-inline-collapsed .ant-menu-item {
          padding-inline: 16px !important;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Smooth scrollbar */
        .ant-menu-inline {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }

        .ant-menu-inline::-webkit-scrollbar {
          width: 6px;
        }

        .ant-menu-inline::-webkit-scrollbar-track {
          background: transparent;
        }

        .ant-menu-inline::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }

        .ant-menu-inline::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        /* Remove default borders */
        .ant-menu-light {
          border-inline-end: none !important;
        }

        /* Sider trigger styling */
        .ant-layout-sider-trigger {
          background: rgba(0, 0, 0, 0.2) !important;
          border-top: 1px solid var(--sidebar-border);
        }

        /* Red logout button in UserPanel */
        .user-panel-logout {
          color: var(--color-danger) !important;
          padding: 0;
        }

        .user-panel-logout:hover {
          color: #ff7875 !important;
          background: transparent !important;
        }

        .user-panel-logout:focus {
          color: var(--color-danger) !important;
        }

        /* Hide menu tooltips on mobile to avoid overlap with content */
        @media (max-width: 991px) {
          .ant-tooltip {
            display: none !important;
          }
        }

        /* ============================================
           RESPONSIVIDADE SIDEBAR - 1366x768
           ============================================ */

        /* Desktop pequeno (1366px) - menu items compactos */
        @media (max-width: 1366px) {
          .ant-menu-dark .ant-menu-item,
          .ant-menu-dark .ant-menu-submenu-title {
            font-size: 13px;
            padding-inline: 10px !important;
            margin: 3px 6px;
            height: 40px;
            line-height: 40px;
          }

          .ant-menu-dark .ant-menu-item .anticon,
          .ant-menu-dark .ant-menu-submenu-title .anticon {
            font-size: 16px;
          }
        }

        /* Altura baixa (768px) - espaçamento reduzido */
        @media (max-height: 800px) {
          .ant-menu-dark .ant-menu-item,
          .ant-menu-dark .ant-menu-submenu-title {
            margin: 2px 6px;
            height: 38px;
            line-height: 38px;
          }
        }

        @media (max-height: 700px) {
          .ant-menu-dark .ant-menu-item,
          .ant-menu-dark .ant-menu-submenu-title {
            margin: 1px 6px;
            height: 36px;
            line-height: 36px;
            font-size: 12px;
          }

          .ant-menu-dark .ant-menu-item .anticon,
          .ant-menu-dark .ant-menu-submenu-title .anticon {
            font-size: 15px;
          }
        }
      `}</style>
    </Sider>
  );
}

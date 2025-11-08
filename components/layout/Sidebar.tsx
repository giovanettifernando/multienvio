'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu, Button, Flex, Avatar, Drawer, Typography, Skeleton } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import { sidebarItems } from './sidebar-items';
import type { MenuProps } from 'antd';

const { Sider } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
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
  const usuario = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.logout);

  const displayName = useMemo(() => usuario?.name ?? 'Usuário', [usuario]);
  const avatarInitials = useMemo(() => getInitials(displayName), [displayName]);
  const selectedKey = useMemo(() => keyFromPath(pathname || '/'), [pathname]);

  const handleLogout = () => {
    clearSession();
    router.replace('/login');
  };

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
    <Flex vertical style={{ height: '100%' }}>
      {/* Logo */}
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '0' : '0 24px',
          color: '#fff',
          fontWeight: 700,
          fontSize: collapsed ? 18 : 20,
          letterSpacing: 2,
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {collapsed ? 'EL' : 'Envio Legal'}
      </div>

      {/* Menu */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[selectedKey]}
          items={menuItems}
          inlineCollapsed={collapsed}
          style={{
            border: 0,
            padding: '16px 8px',
            background: '#0A2955',
          }}
        />
      </div>

      {/* Footer */}
      <div
        className="sidebar-footer"
        style={{
          position: 'sticky',
          bottom: 0,
          padding: 12,
          background: 'rgba(0, 0, 0, 0.15)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {!usuario ? (
          // Loading skeleton
          <Flex align="center" gap={12}>
            <Skeleton.Avatar active size={32} />
            {!collapsed && <Skeleton.Input active size="small" style={{ width: 120 }} />}
          </Flex>
        ) : (
          // User info + Logout
          <Flex
            align="center"
            gap={12}
            className="sidebar-user"
            style={{
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <Avatar
              size={32}
              style={{ flexShrink: 0, backgroundColor: '#1677ff' }}
            >
              {avatarInitials}
            </Avatar>
            {!collapsed && (
              <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#E6EEF7',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {displayName}
                </div>
                {usuario.email && (
                  <Typography.Text
                    style={{
                      fontSize: 12,
                      color: 'rgba(255, 255, 255, 0.65)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {usuario.email}
                  </Typography.Text>
                )}
                <Button
                  type="text"
                  size="small"
                  icon={<LogoutOutlined />}
                  onClick={handleLogout}
                  className="sidebar-logout"
                  style={{
                    padding: 0,
                    height: 'auto',
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  Sair
                </Button>
              </Flex>
            )}
          </Flex>
        )}
      </div>
    </Flex>
  );

  return (
    <Sider
      width={280}
      collapsedWidth={80}
      collapsed={collapsed}
      onCollapse={onCollapse}
      breakpoint="lg"
      onBreakpoint={(broken) => {
        if (broken) {
          onCollapse(true);
        }
      }}
      collapsible
      trigger={
        <Flex
          align="center"
          justify="center"
          style={{
            height: 48,
            cursor: 'pointer',
            transition: 'all 0.2s',
            color: '#fff',
          }}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </Flex>
      }
      style={{
        background: '#0A2955',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        overflow: 'hidden',
      }}
    >
      {sidebarContent}
      <style jsx global>{`
        /* Blue theme for dark menu */
        .ant-layout-sider {
          background: #0A2955 !important;
        }

        .ant-menu-dark,
        .ant-menu-dark .ant-menu-sub {
          background: #0A2955;
        }

        .ant-menu-dark .ant-menu-item,
        .ant-menu-dark .ant-menu-submenu-title {
          color: #E6EEF7;
          border-radius: 12px;
          margin: 4px 8px;
          padding-inline: 12px !important;
        }

        .ant-menu-dark .ant-menu-item:hover {
          background: rgba(255, 255, 255, 0.08);
        }

        .ant-menu-dark .ant-menu-item-selected {
          background: rgba(255, 255, 255, 0.18) !important;
          color: #fff !important;
          font-weight: 500;
        }

        .ant-menu-dark .ant-menu-item-selected::after {
          display: none;
        }

        .ant-menu-dark .ant-menu-item .anticon,
        .ant-menu-dark .ant-menu-submenu-title .anticon {
          color: #fff;
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
          color: #fff !important;
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
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* Footer user section */
        .sidebar-footer {
          position: sticky;
          bottom: 0;
        }

        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #E6EEF7;
        }

        /* Red logout button */
        .sidebar-logout {
          color: #ff4d4f !important;
          padding: 0;
        }

        .sidebar-logout:hover {
          color: #ff7875 !important;
          background: transparent !important;
        }

        .sidebar-logout:focus {
          color: #ff4d4f !important;
        }
      `}</style>
    </Sider>
  );
}

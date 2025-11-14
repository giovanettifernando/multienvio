'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Flex, Avatar, Button, Typography, Skeleton, Tooltip } from 'antd';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';

interface UserPanelProps {
  collapsed: boolean;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function UserPanel({ collapsed }: UserPanelProps) {
  const router = useRouter();
  const usuario = useAuthStore((s) => s.user);
  const clearSession = useAuthStore((s) => s.logout);

  const displayName = useMemo(() => usuario?.name ?? 'Usuário', [usuario]);
  const avatarInitials = useMemo(() => getInitials(displayName), [displayName]);

  const handleLogout = () => {
    clearSession();
    router.replace('/login');
  };

  if (!usuario) {
    // Loading skeleton
    return (
      <div
        style={{
          padding: collapsed ? '12px 16px' : '12px 24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Flex align="center" gap={12} justify={collapsed ? 'center' : 'flex-start'}>
          <Skeleton.Avatar active size={40} />
          {!collapsed && <Skeleton.Input active size="small" style={{ width: 140 }} />}
        </Flex>
      </div>
    );
  }

  // Collapsed view - just avatar with tooltip
  if (collapsed) {
    return (
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Tooltip
          title={
            <Flex vertical gap={4}>
              <div style={{ fontWeight: 600 }}>{displayName}</div>
              {usuario.email && (
                <div style={{ fontSize: 12, opacity: 0.85 }}>{usuario.email}</div>
              )}
              <Button
                type="text"
                size="small"
                danger
                icon={<LogoutOutlined />}
                onClick={handleLogout}
                style={{
                  width: '100%',
                  marginTop: 4,
                  justifyContent: 'flex-start',
                  padding: '4px 8px',
                }}
              >
                Sair
              </Button>
            </Flex>
          }
          placement="right"
          trigger="hover"
        >
          <Avatar
            size={40}
            style={{
              backgroundColor: '#1677ff',
              cursor: 'pointer',
              border: '2px solid rgba(255, 255, 255, 0.2)',
            }}
            icon={!avatarInitials ? <UserOutlined /> : undefined}
          >
            {avatarInitials}
          </Avatar>
        </Tooltip>
      </div>
    );
  }

  // Expanded view - full info
  return (
    <div
      style={{
        padding: '12px 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(0, 0, 0, 0.1)',
      }}
    >
      <Flex align="center" gap={12}>
        <Avatar
          size={40}
          style={{
            flexShrink: 0,
            backgroundColor: '#1677ff',
            border: '2px solid rgba(255, 255, 255, 0.2)',
          }}
          icon={!avatarInitials ? <UserOutlined /> : undefined}
        >
          {avatarInitials}
        </Avatar>
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
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleLogout();
              }
            }}
            className="user-panel-logout"
            style={{
              padding: 0,
              height: 'auto',
              fontSize: 12,
              marginTop: 6,
              color: '#ff4d4f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
            }}
          >
            Sair
          </Button>
        </Flex>
      </Flex>
    </div>
  );
}

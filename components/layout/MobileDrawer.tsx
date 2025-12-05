'use client';

import { useEffect } from 'react';
import { Drawer, Menu } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import styles from './MobileDrawer.module.css';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  items: MenuProps['items'];
  selectedKeys?: string[];
  logo?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  theme?: 'light' | 'dark';
  /** Submenus abertos por padrão */
  defaultOpenKeys?: string[];
}

export function MobileDrawer({
  open,
  onClose,
  items,
  selectedKeys = [],
  logo,
  header,
  footer,
  theme = 'dark',
  defaultOpenKeys,
}: MobileDrawerProps) {
  // Fechar ao pressionar ESC
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  // Prevenir scroll do body quando drawer está aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="left"
      closeIcon={null}
      className={theme === 'dark' ? styles.drawerDark : styles.drawerLight}
      styles={{
        header: { display: 'none' },
        body: { padding: 0 },
        wrapper: { width: 280 },
      }}
    >
      <div className={`${styles.container} ${theme === 'dark' ? styles.dark : styles.light}`}>
        {/* Header com logo e botão fechar */}
        <div className={styles.header}>
          <div className={styles.logoArea}>
            {logo}
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Fechar menu"
          >
            <CloseOutlined />
          </button>
        </div>

        {/* Área customizável do header (ex: UserPanel) */}
        {header && <div className={styles.customHeader}>{header}</div>}

        {/* Menu */}
        <div className={styles.menuWrapper}>
          <Menu
            mode="inline"
            theme={theme}
            selectedKeys={selectedKeys}
            defaultOpenKeys={defaultOpenKeys}
            items={items}
            onClick={onClose}
            style={{
              border: 0,
              background: 'transparent',
            }}
          />
        </div>

        {/* Footer customizável */}
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </Drawer>
  );
}

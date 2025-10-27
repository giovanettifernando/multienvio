"use client";

import { useState, useMemo } from "react";
import { Checkbox, Input, Flex, Typography, Card, Alert, Collapse } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useRoles } from "@/lib/auth/hooks";
import { isSuperAdminRole } from "@/lib/auth/roles";
import { spacing } from "@/lib/ui/theme";

interface RolesChecklistProps {
  value?: string[];
  onChange?: (roles: string[]) => void;
}

export function RolesChecklist({ value = [], onChange }: RolesChecklistProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: rolesData, isLoading } = useRoles();

  const hasSuperAdmin = useMemo(() => {
    return value.some(isSuperAdminRole);
  }, [value]);

  const filteredGroups = useMemo(() => {
    if (!rolesData?.groups) return [];

    const query = searchQuery.toLowerCase().trim();
    if (!query) return rolesData.groups;

    return rolesData.groups
      .map((group) => ({
        ...group,
        roles: group.roles.filter(
          (role) =>
            role.label.toLowerCase().includes(query) ||
            role.description?.toLowerCase().includes(query) ||
            role.key.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.roles.length > 0);
  }, [rolesData, searchQuery]);

  const handleRoleToggle = (roleKey: string, checked: boolean) => {
    if (!onChange) return;

    const newRoles = checked
      ? [...value, roleKey]
      : value.filter((r) => r !== roleKey);

    onChange(newRoles);
  };

  const handleGroupToggle = (groupRoles: string[], checked: boolean) => {
    if (!onChange) return;

    const groupKeys = groupRoles.map((r) => r);
    const newRoles = checked
      ? [...new Set([...value, ...groupKeys])]
      : value.filter((r) => !groupKeys.includes(r));

    onChange(newRoles);
  };

  if (isLoading) {
    return <Typography.Text type="secondary">Carregando permissões...</Typography.Text>;
  }

  return (
    <Flex vertical gap={spacing.md}>
      <Input
        prefix={<SearchOutlined />}
        placeholder="Buscar permissão..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        allowClear
      />

      {hasSuperAdmin && (
        <Alert
          type="info"
          message="Acesso Total"
          description="Super Administrador possui acesso completo a todas as funcionalidades do sistema."
          showIcon
        />
      )}

      <Collapse
        items={filteredGroups.map((group) => {
          const groupRoleKeys = group.roles.map((r) => r.key);
          const allGroupSelected = groupRoleKeys.every((key) =>
            value.includes(key)
          );
          const someGroupSelected = groupRoleKeys.some((key) =>
            value.includes(key)
          );

          return {
            key: group.key,
            label: (
              <Flex align="center" gap={spacing.sm}>
                <Checkbox
                  checked={allGroupSelected}
                  indeterminate={someGroupSelected && !allGroupSelected}
                  disabled={hasSuperAdmin}
                  onChange={(e) =>
                    handleGroupToggle(groupRoleKeys, e.target.checked)
                  }
                  onClick={(e) => e.stopPropagation()}
                />
                <Typography.Text strong>{group.label}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  ({group.roles.length})
                </Typography.Text>
              </Flex>
            ),
            children: (
              <Flex vertical gap={spacing.sm}>
                {group.roles.map((role) => (
                  <Card key={role.key} size="small">
                    <Checkbox
                      checked={value.includes(role.key)}
                      disabled={hasSuperAdmin && !isSuperAdminRole(role.key)}
                      onChange={(e) =>
                        handleRoleToggle(role.key, e.target.checked)
                      }
                    >
                      <Flex vertical gap={4}>
                        <Typography.Text strong>{role.label}</Typography.Text>
                        {role.description && (
                          <Typography.Text
                            type="secondary"
                            style={{ fontSize: 13 }}
                          >
                            {role.description}
                          </Typography.Text>
                        )}
                      </Flex>
                    </Checkbox>
                  </Card>
                ))}
              </Flex>
            ),
          };
        })}
        defaultActiveKey={filteredGroups.map((g) => g.key)}
      />

      {filteredGroups.length === 0 && (
        <Typography.Text type="secondary">
          Nenhuma permissão encontrada para &quot;{searchQuery}&quot;
        </Typography.Text>
      )}
    </Flex>
  );
}

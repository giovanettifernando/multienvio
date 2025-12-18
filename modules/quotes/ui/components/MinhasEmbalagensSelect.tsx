"use client";

import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Select, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { useListPackaging, useDeletePackaging, type PackagingTemplate } from '@/hooks/usePackaging';
import { ModalNovaEmbalagem } from './ModalNovaEmbalagem';
import { formatPackagingName } from '@/shared/utils/packaging';

interface MinhasEmbalagensSelectProps {
  value?: string;
  onChange?: (value: string | undefined, template: PackagingTemplate | undefined) => void;
  placeholder?: string;
}

export function MinhasEmbalagensSelect({ value, onChange, placeholder }: MinhasEmbalagensSelectProps) {
  const { message } = App.useApp();
  const { data: templates, isLoading } = useListPackaging();
  const deletePackaging = useDeletePackaging();
  const [modalOpen, setModalOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<string | undefined>(value);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Sincronizar valor interno com prop externa
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const handleChange = (selectedValue: string) => {
    if (selectedValue === '__add_new__') {
      setModalOpen(true);
      return;
    }

    setInternalValue(selectedValue);
    const template = templates?.find((t) => t.id === selectedValue);
    onChange?.(selectedValue, template);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await deletePackaging.mutateAsync(id);
      message.success('Embalagem removida com sucesso');

      // Se a embalagem excluída era a selecionada, limpar seleção
      if (internalValue === id) {
        setInternalValue(undefined);
        onChange?.(undefined, undefined);
      }
    } catch (error) {
      console.error('Erro ao excluir embalagem:', error);
      message.error(error instanceof Error ? error.message : 'Erro ao excluir embalagem');
    }
  };

  const handleModalClose = () => {
    setModalOpen(false);
  };

  const handleModalSuccess = (id: string) => {
    // Após criar, selecionar automaticamente a embalagem recém-criada
    // O refetch já foi disparado pelo mutation
    // Aguardar um tick para garantir que os dados foram atualizados
    setTimeout(() => {
      const newTemplate = templates?.find((t) => t.id === id);
      if (newTemplate) {
        setInternalValue(id);
        onChange?.(id, newTemplate);
      }
    }, 100);
  };

  const handleClear = () => {
    setInternalValue(undefined);
    onChange?.(undefined, undefined);
  };

  // Criar options com formatação e botão de excluir (somente quando dropdown está aberto)
  const options = [
    ...(templates || []).map((template) => {
      const label = formatPackagingName({
        lengthCm: template.lengthCm,
        widthCm: template.widthCm,
        heightCm: template.heightCm,
        name: template.name,
      });

      return {
        label: (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
            }}
          >
            <span title={label}>{label}</span>
            {isDropdownOpen && (
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => handleDelete(template.id, e)}
                loading={deletePackaging.isPending}
                style={{ marginLeft: 8 }}
              />
            )}
          </div>
        ),
        value: template.id,
        title: label, // Tooltip
      };
    }),
    {
      label: (
        <span style={{ color: '#1890ff' }}>
          <PlusOutlined style={{ marginRight: 8 }} />
          Adicionar embalagem...
        </span>
      ),
      value: '__add_new__',
    },
  ];

  // Se não houver embalagens, mostrar mensagem especial
  if (!isLoading && (!templates || templates.length === 0)) {
    return (
      <>
        <Select
          size="small"
          placeholder="-- Nenhuma embalagem cadastrada --"
          options={[
            {
              label: (
                <span style={{ color: '#1890ff' }}>
                  <PlusOutlined style={{ marginRight: 8 }} />
                  Adicionar embalagem...
                </span>
              ),
              value: '__add_new__',
            },
          ]}
          onChange={handleChange}
          style={{ width: '100%' }}
        />
        <ModalNovaEmbalagem
          open={modalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      </>
    );
  }

  return (
    <>
      <Select
        size="small"
        value={internalValue}
        placeholder={placeholder || 'Selecione uma embalagem'}
        options={options}
        onChange={handleChange}
        onClear={handleClear}
        onOpenChange={setIsDropdownOpen}
        loading={isLoading}
        notFoundContent={isLoading ? <Spin size="small" /> : 'Nenhuma embalagem encontrada'}
        style={{ width: '100%' }}
        allowClear
        popupMatchSelectWidth={true}
      />
      <ModalNovaEmbalagem
        open={modalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </>
  );
}

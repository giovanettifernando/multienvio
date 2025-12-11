"use client";

import { Descriptions, Timeline, Tag, Button, Space, Input, App } from "antd";
import { ELDrawer } from "@/components/ui/ELDrawer";
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  EnvironmentOutlined,
} from "@ant-design/icons";
import { useState } from "react";
import dayjs from "dayjs";
import type { Coleta } from "@/lib/coletas/types";
import {
  CollectionStatus,
  COLLECTION_STATUS_LABELS,
  COLLECTION_STATUS_COLORS,
} from "@/types/contracts";
import { useColetasActions } from "@/hooks/useColetas";

const { TextArea } = Input;

interface ColetaDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  coleta: Coleta | null;
}

export function ColetaDetailDrawer({
  open,
  onClose,
  coleta,
}: ColetaDetailDrawerProps) {
  const { message } = App.useApp();
  const { update, remove } = useColetasActions();
  const [observacoes, setObservacoes] = useState(coleta?.observacoes || "");
  const [isEditing, setIsEditing] = useState(false);

  if (!coleta) return null;

  const handleSaveObservacoes = () => {
    try {
      update(coleta.id, { observacoes });
      message.success("Observações atualizadas com sucesso");
      setIsEditing(false);
    } catch {
      message.error("Erro ao atualizar observações");
    }
  };

  const handleRemove = () => {
    try {
      remove(coleta.id);
      message.success("Coleta removida com sucesso");
      onClose();
    } catch {
      message.error("Erro ao remover coleta");
    }
  };

  const getStatusIcon = (status: CollectionStatus) => {
    switch (status) {
      case CollectionStatus.ABERTA:
        return <ClockCircleOutlined />;
      case CollectionStatus.AGENDADA:
        return <ClockCircleOutlined />;
      case CollectionStatus.EM_ANDAMENTO:
        return <SyncOutlined spin />;
      case CollectionStatus.CONCLUIDA:
        return <CheckCircleOutlined />;
      case CollectionStatus.CANCELADA:
        return <CloseCircleOutlined />;
      default:
        return <ClockCircleOutlined />;
    }
  };

  const timelineItems = [
    {
      color: "blue",
      content: (
        <div>
          <div style={{ fontWeight: 500 }}>Coleta Criada</div>
          <div style={{ color: "#999", fontSize: 12 }}>
            {dayjs(coleta.createdAt).format("DD/MM/YYYY HH:mm")}
          </div>
        </div>
      ),
    },
  ];

  // Add status update to timeline if updated
  if (coleta.updatedAt !== coleta.createdAt) {
    timelineItems.push({
      color: "green",
      content: (
        <div>
          <div style={{ fontWeight: 500 }}>Atualização de Status</div>
          <div style={{ color: "#999", fontSize: 12 }}>
            {dayjs(coleta.updatedAt).format("DD/MM/YYYY HH:mm")}
          </div>
          <Tag
            color={COLLECTION_STATUS_COLORS[coleta.status]}
            style={{ marginTop: 4 }}
          >
            {COLLECTION_STATUS_LABELS[coleta.status]}
          </Tag>
        </div>
      ),
    });
  }

  return (
    <ELDrawer
      title="Detalhes da Coleta"
      placement="right"
      drawerSize="lg"
      onClose={onClose}
      open={open}
      extra={
        <Space>
          <Button danger onClick={handleRemove}>
            Remover
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </Space>
      }
    >
      <Space orientation="vertical" size="large" style={{ width: "100%" }}>
        {/* Status Atual */}
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Status Atual</div>
          <Tag
            icon={getStatusIcon(coleta.status)}
            color={COLLECTION_STATUS_COLORS[coleta.status]}
            style={{ fontSize: 14, padding: "4px 12px" }}
          >
            {COLLECTION_STATUS_LABELS[coleta.status]}
          </Tag>
        </div>

        {/* Informações Principais */}
        <Descriptions title="Informações Principais" column={1} bordered size="small">
          <Descriptions.Item label="ID do Envio">
            <strong>{coleta.shipmentId}</strong>
          </Descriptions.Item>
          {coleta.transportadora && (
            <Descriptions.Item label="Transportadora">
              {coleta.transportadora}
            </Descriptions.Item>
          )}
          {coleta.servico && (
            <Descriptions.Item label="Serviço">{coleta.servico}</Descriptions.Item>
          )}
          {coleta.janelaColeta && (
            <Descriptions.Item label="Janela de Coleta">
              {dayjs(coleta.janelaColeta).format("DD/MM/YYYY HH:mm")}
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* Origem */}
        <Descriptions
          title={
            <span>
              <EnvironmentOutlined style={{ marginRight: 8 }} />
              Origem
            </span>
          }
          column={1}
          bordered
          size="small"
        >
          <Descriptions.Item label="Nome">{coleta.origem.nome}</Descriptions.Item>
          {coleta.origem.telefone && (
            <Descriptions.Item label="Telefone">
              {coleta.origem.telefone}
            </Descriptions.Item>
          )}
          <Descriptions.Item label="Endereço">
            {[
              coleta.origem.logradouro,
              coleta.origem.numero,
              coleta.origem.complemento,
            ]
              .filter(Boolean)
              .join(", ")}
          </Descriptions.Item>
          <Descriptions.Item label="Bairro">{coleta.origem.bairro}</Descriptions.Item>
          <Descriptions.Item label="Cidade/UF">
            {coleta.origem.cidade} / {coleta.origem.uf}
          </Descriptions.Item>
          <Descriptions.Item label="CEP">{coleta.origem.cep}</Descriptions.Item>
        </Descriptions>

        {/* Observações */}
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Observações</div>
          {isEditing ? (
            <Space orientation="vertical" style={{ width: "100%" }}>
              <TextArea
                rows={4}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Adicione observações sobre a coleta..."
              />
              <Space>
                <Button type="primary" onClick={handleSaveObservacoes}>
                  Salvar
                </Button>
                <Button onClick={() => setIsEditing(false)}>Cancelar</Button>
              </Space>
            </Space>
          ) : (
            <div>
              <div
                style={{
                  padding: 12,
                  background: "#fafafa",
                  borderRadius: 4,
                  minHeight: 80,
                }}
              >
                {coleta.observacoes || <em style={{ color: "#999" }}>Sem observações</em>}
              </div>
              <Button
                type="link"
                style={{ paddingLeft: 0, marginTop: 8 }}
                onClick={() => setIsEditing(true)}
              >
                Editar observações
              </Button>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div>
          <div style={{ marginBottom: 16, fontWeight: 500 }}>Linha do Tempo</div>
          <Timeline items={timelineItems} />
        </div>

        {/* Datas */}
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Criado em">
            {dayjs(coleta.createdAt).format("DD/MM/YYYY HH:mm:ss")}
          </Descriptions.Item>
          <Descriptions.Item label="Atualizado em">
            {dayjs(coleta.updatedAt).format("DD/MM/YYYY HH:mm:ss")}
          </Descriptions.Item>
        </Descriptions>
      </Space>
    </ELDrawer>
  );
}

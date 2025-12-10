"use client";

import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  App,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { ELSkeleton } from "@/components/ui/ELSkeleton";
import { ELCard } from "@/components/ui/ELCard";
import { ELButton } from "@/components/ui/ELButton";
import { ELGrid, ELGridSpanFull } from "@/components/ui/ELGrid";
import { ShareAltOutlined, CopyOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { TrackingTimeline } from "@/components/track/TrackingTimeline";
import { PageShell } from "@/components/shared/PageShell";

const { Text } = Typography;

const STATUS_LABELS: Record<string, string> = {
  "pending_payment": "Aguardando pagamento",
  "awaiting_pickup": "Aguardando coleta",
  "awaiting_posting": "Aguardando postagem",
  "ready_for_posting": "Pronto para postagem",
  "posted": "Postado",
  "in_transit": "Em trânsito",
  "out_for_delivery": "Em rota de entrega",
  "delivered": "Entregue",
  "cancelled": "Cancelado",
  "payment_failed": "Falha no pagamento",
};

// Type definitions
interface VolumeItem {
  id?: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  subtotal: number;
}

interface Volume {
  id: string;
  packageNumber: number;
  weight: number;
  width: number;
  height: number;
  length: number;
  hasDivergence: boolean;
  divergenceNotes: string | null;
  items: VolumeItem[]; // Itens deste volume específico
}

interface Item {
  id?: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  subtotal: number;
  volumeIndex?: number;
}

interface ShipmentDetail {
  id: string;
  trackingCode: string;
  publicTrackingId: string | null;
  status: string;
  paymentMethod: string | null;
  carrier: string | null;
  service: string | null;
  freightCost: number | null;
  estimatedDays: number | null;
  declaredValue: number | null;
  weight: number | null;
  originCep: string;
  destinationCep: string;
  destinationCity: string;
  destinationState: string;
  destinationAddress: string | null;
  destinationNeighborhood: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  recipientDocument: string | null;
  pickupPointId: string | null;
  document: Record<string, unknown> | null;
  postedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  volumes: Volume[];
  documentType: string;
  nfeKeys: string[];
  items: Item[];
  trackingEvents: Array<{
    type: string;
    description: string;
    city: string | null;
    uf: string | null;
    occurredAt: string;
  }>;
}

export default function ShipmentDetailClient() {
  const { message } = App.useApp();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  console.debug('[DETAIL] params.id=', id);

  // Buscar shipment diretamente por ID
  const { data: shipment, isLoading, error } = useQuery<ShipmentDetail>({
    queryKey: ['shipment', id],
    queryFn: async () => {
      const res = await fetch(`/api/shipments/${id}`);
      if (!res.ok) {
        const errorJson = await res.json();
        // Handle standardized API response format { data: T, error, meta }
        const errorData = errorJson.error ?? errorJson;
        throw new Error(errorData.message || errorData.error || 'Erro ao buscar envio');
      }
      const json = await res.json();
      // Handle standardized API response format { data: T, error, meta }
      return (json.data ?? json) as ShipmentDetail;
    },
    enabled: !!id,
  });

  const handleOpenPublicLink = () => {
    if (shipment?.publicTrackingId) {
      const url = `${window.location.origin}/rastreio/${shipment.publicTrackingId}`;
      window.open(url, '_blank');
    }
  };

  const handleCopyPublicLink = () => {
    if (shipment?.publicTrackingId) {
      const url = `${window.location.origin}/rastreio/${shipment.publicTrackingId}`;
      navigator.clipboard.writeText(url);
      message.success('Link público copiado!');
    }
  };

  return (
    <PageShell
      title="Detalhes do envio"
      gap="md"
      extra={
        <Space wrap>
          <ELButton onClick={() => router.push("/shipments")}>Voltar</ELButton>
          {shipment?.publicTrackingId && (
            <>
              <ELButton
                icon={<CopyOutlined />}
                onClick={handleCopyPublicLink}
              >
                Copiar link
              </ELButton>
              <ELButton
                variant="primary"
                icon={<ShareAltOutlined />}
                onClick={handleOpenPublicLink}
              >
                Abrir link
              </ELButton>
            </>
          )}
        </Space>
      }
    >

      {isLoading ? (
        <ELSkeleton lines={6} />
      ) : error || !shipment ? (
        <Alert
          type="error"
          message="Envio não encontrado"
          description="Verifique se o código está correto e tente novamente."
          action={
            <ELButton onClick={() => router.push("/shipments")}>
              Voltar para listagem
            </ELButton>
          }
        />
      ) : (
        <>
          {/* Seção 1: Informações Gerais */}
          <ELCard header={{ title: "Informações Gerais" }}>
            <ELGrid variant="3" gap="md">
              <div>
                <Text type="secondary">Status</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color={shipment.status === 'delivered' ? 'green' : shipment.status === 'cancelled' ? 'red' : 'blue'}>
                    {STATUS_LABELS[shipment.status] ?? shipment.status}
                  </Tag>
                </div>
              </div>
              <div>
                <Text type="secondary">Código de rastreio</Text>
                <div style={{ marginTop: 4, fontWeight: 500 }}>{shipment.trackingCode}</div>
              </div>
              <div>
                <Text type="secondary">Método de pagamento</Text>
                <div style={{ marginTop: 4 }}>
                  {shipment.paymentMethod ? (
                    shipment.paymentMethod === 'wallet' ? 'Carteira' :
                    shipment.paymentMethod === 'pix' ? 'PIX' :
                    shipment.paymentMethod === 'card' ? 'Cartão' :
                    shipment.paymentMethod
                  ) : 'Não informado'}
                </div>
              </div>
              <div>
                <Text type="secondary">Destinatário</Text>
                <div style={{ marginTop: 4 }}>{shipment.recipientName || 'Não informado'}</div>
              </div>
              <div>
                <Text type="secondary">Cidade destino</Text>
                <div style={{ marginTop: 4 }}>
                  {shipment.destinationCity}, {shipment.destinationState}
                </div>
              </div>
              <div>
                <Text type="secondary">CEP destino</Text>
                <div style={{ marginTop: 4 }}>{shipment.destinationCep}</div>
              </div>
              <div>
                <Text type="secondary">Transportadora</Text>
                <div style={{ marginTop: 4 }}>{shipment.carrier || 'Não informado'}</div>
              </div>
              <div>
                <Text type="secondary">Serviço</Text>
                <div style={{ marginTop: 4 }}>{shipment.service || 'Não informado'}</div>
              </div>
              <div>
                <Text type="secondary">Prazo estimado</Text>
                <div style={{ marginTop: 4 }}>
                  {shipment.estimatedDays ? `${shipment.estimatedDays} dias` : 'Não informado'}
                </div>
              </div>
              <div>
                <Text type="secondary">Valor do frete</Text>
                <div style={{ marginTop: 4 }}>
                  {shipment.freightCost ? `R$ ${shipment.freightCost.toFixed(2)}` : 'Não informado'}
                </div>
              </div>
              <div>
                <Text type="secondary">Valor declarado</Text>
                <div style={{ marginTop: 4 }}>
                  {shipment.declaredValue ? `R$ ${shipment.declaredValue.toFixed(2)}` : 'Não informado'}
                </div>
              </div>
              <div>
                <Text type="secondary">Peso total</Text>
                <div style={{ marginTop: 4 }}>
                  {shipment.weight ? `${shipment.weight.toFixed(1)} kg` : 'Não informado'}
                </div>
              </div>
              <ELGridSpanFull>
                <Text type="secondary">Criado em</Text>
                <div style={{ marginTop: 4 }}>
                  {new Date(shipment.createdAt).toLocaleString('pt-BR')}
                </div>
              </ELGridSpanFull>
            </ELGrid>
          </ELCard>

          {/* Seção 2: Volumes */}
          {shipment.volumes && shipment.volumes.length > 0 && (
            <ELCard header={{ title: "Volumes do Envio" }}>
              <Table
                dataSource={shipment.volumes}
                rowKey="id"
                pagination={false}
                size="small"
                scroll={{ x: 600 }}
                expandable={{
                  expandedRowRender: (record) => {
                    // Renderizar itens deste volume
                    if (!record.items || record.items.length === 0) {
                      return (
                        <div style={{ padding: '12px 16px', backgroundColor: '#fafafa', borderRadius: '4px' }}>
                          <Text type="secondary">Nenhum item encontrado para este volume.</Text>
                        </div>
                      );
                    }

                    return (
                      <div style={{ padding: '12px 16px', backgroundColor: '#fafafa', borderRadius: '4px' }}>
                        <div style={{ marginBottom: 8, fontSize: '13px', fontWeight: 500, color: '#595959' }}>
                          Itens deste volume
                        </div>
                        <Table
                          dataSource={record.items}
                          rowKey={(item, idx) => item.id || `item-${idx}`}
                          pagination={false}
                          size="small"
                          columns={[
                            {
                              title: 'Descrição',
                              dataIndex: 'descricao',
                            },
                            {
                              title: 'Qtd',
                              dataIndex: 'quantidade',
                              width: 80,
                              align: 'center',
                            },
                            {
                              title: 'Valor Unit.',
                              dataIndex: 'valorUnitario',
                              width: 120,
                              align: 'right',
                              render: (val) => (val ? `R$ ${val.toFixed(2)}` : '-'),
                            },
                            {
                              title: 'Subtotal',
                              dataIndex: 'subtotal',
                              width: 120,
                              align: 'right',
                              render: (val) => (val ? `R$ ${val.toFixed(2)}` : '-'),
                            },
                          ]}
                          summary={(data) => {
                            const total = data.reduce((sum, item) => sum + (item.subtotal || 0), 0);
                            return (
                              <Table.Summary.Row>
                                <Table.Summary.Cell index={0} colSpan={3} align="right">
                                  <strong>Total:</strong>
                                </Table.Summary.Cell>
                                <Table.Summary.Cell index={1} align="right">
                                  <strong>R$ {total.toFixed(2)}</strong>
                                </Table.Summary.Cell>
                              </Table.Summary.Row>
                            );
                          }}
                        />
                      </div>
                    );
                  },
                  rowExpandable: (record) => record.items && record.items.length > 0,
                }}
                columns={[
                  {
                    title: 'Volume',
                    dataIndex: 'packageNumber',
                    width: 100,
                    render: (num) => `Volume ${num}`,
                  },
                  {
                    title: 'Dimensões (A×L×C)',
                    key: 'dimensions',
                    render: (_, record) =>
                      `${record.height}×${record.width}×${record.length} cm`,
                  },
                  {
                    title: 'Peso',
                    dataIndex: 'weight',
                    width: 120,
                    align: 'right',
                    render: (weight) => `${weight.toFixed(1)} kg`,
                  },
                  {
                    title: 'Status',
                    key: 'status',
                    width: 150,
                    render: (_, record) =>
                      record.hasDivergence ? (
                        <Tag color="orange">Divergência</Tag>
                      ) : (
                        <Tag color="green">Conforme</Tag>
                      ),
                  },
                ]}
              />
            </ELCard>
          )}

          {/* Seção 3: Itens (Declaração ou NF) */}
          {/* REGRA: Só renderizar se itens NÃO estiverem sendo exibidos por volume */}
          {(() => {
            // Verificar se volumes têm itens (evitar duplicação)
            const hasPerVolumeItems = shipment.volumes?.some(
              (v) => v.items && v.items.length > 0
            );

            // NF-e: sempre mostrar card separado (chaves + itens globais)
            if (shipment.documentType === 'NFE' && shipment.nfeKeys && shipment.nfeKeys.length > 0) {
              return (
                <ELCard header={{ title: "Notas Fiscais Eletrônicas" }}>
                  <div style={{ marginBottom: 16 }}>
                    <Text type="secondary">Chaves de acesso:</Text>
                    {shipment.nfeKeys.map((key: string, idx: number) => (
                      <div key={idx} style={{ marginTop: 8, fontFamily: 'monospace', fontSize: '12px' }}>
                        {key}
                      </div>
                    ))}
                  </div>
                  {shipment.items && shipment.items.length > 0 && (
                    <>
                      <Text type="secondary" style={{ display: 'block', marginTop: 16, marginBottom: 8 }}>
                        Itens:
                      </Text>
                      <Table
                        dataSource={shipment.items}
                        rowKey={(record, idx) => record.id || `item-${idx}`}
                        pagination={false}
                        size="small"
                        columns={[
                          {
                            title: 'Descrição',
                            dataIndex: 'descricao',
                          },
                          {
                            title: 'Qtd',
                            dataIndex: 'quantidade',
                            width: 80,
                            align: 'center',
                          },
                          {
                            title: 'Valor Unit.',
                            dataIndex: 'valorUnitario',
                            width: 120,
                            align: 'right',
                            render: (val) => (val ? `R$ ${val.toFixed(2)}` : '-'),
                          },
                          {
                            title: 'Subtotal',
                            dataIndex: 'subtotal',
                            width: 120,
                            align: 'right',
                            render: (val) => (val ? `R$ ${val.toFixed(2)}` : '-'),
                          },
                        ]}
                        summary={(data) => {
                          const total = data.reduce((sum, item) => sum + (item.subtotal || 0), 0);
                          return (
                            <Table.Summary.Row>
                              <Table.Summary.Cell index={0} colSpan={3} align="right">
                                <strong>Total:</strong>
                              </Table.Summary.Cell>
                              <Table.Summary.Cell index={1} align="right">
                                <strong>R$ {total.toFixed(2)}</strong>
                              </Table.Summary.Cell>
                            </Table.Summary.Row>
                          );
                        }}
                      />
                    </>
                  )}
                </ELCard>
              );
            }

            // Declaração: só mostrar card global se NÃO houver itens por volume
            if (
              shipment.documentType === 'DECLARACAO' &&
              !hasPerVolumeItems &&
              shipment.items &&
              shipment.items.length > 0
            ) {
              return (
                <ELCard header={{ title: "Declaração de Conteúdo" }}>
                  <Table
                    dataSource={shipment.items}
                    rowKey={(record, idx) => record.id || `item-${idx}`}
                    pagination={false}
                    size="small"
                    columns={[
                      {
                        title: 'Descrição',
                        dataIndex: 'descricao',
                      },
                      {
                        title: 'Qtd',
                        dataIndex: 'quantidade',
                        width: 80,
                        align: 'center',
                      },
                      {
                        title: 'Valor Unit.',
                        dataIndex: 'valorUnitario',
                        width: 120,
                        align: 'right',
                        render: (val) => (val ? `R$ ${val.toFixed(2)}` : '-'),
                      },
                      {
                        title: 'Subtotal',
                        dataIndex: 'subtotal',
                        width: 120,
                        align: 'right',
                        render: (val) => (val ? `R$ ${val.toFixed(2)}` : '-'),
                      },
                    ]}
                    summary={(data) => {
                      const total = data.reduce((sum, item) => sum + (item.subtotal || 0), 0);
                      return (
                        <Table.Summary.Row>
                          <Table.Summary.Cell index={0} colSpan={3} align="right">
                            <strong>Total:</strong>
                          </Table.Summary.Cell>
                          <Table.Summary.Cell index={1} align="right">
                            <strong>R$ {total.toFixed(2)}</strong>
                          </Table.Summary.Cell>
                        </Table.Summary.Row>
                      );
                    }}
                  />
                </ELCard>
              );
            }

            // Nenhuma das condições: não renderizar nada
            return null;
          })()}

          {/* Timeline de eventos */}
          {shipment?.trackingEvents && shipment.trackingEvents.length > 0 && (
            <TrackingTimeline
              events={shipment.trackingEvents}
              title="Histórico de rastreamento"
            />
          )}
        </>
      )}
    </PageShell>
  );
}

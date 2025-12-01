"use client";

import { useParams, useRouter } from "next/navigation";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Row,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
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
        const errorData = await res.json();
        throw new Error(errorData.message || 'Erro ao buscar envio');
      }
      return res.json();
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
          <Button onClick={() => router.push("/shipments")}>Voltar</Button>
          {shipment?.publicTrackingId && (
            <>
              <Button
                icon={<CopyOutlined />}
                onClick={handleCopyPublicLink}
              >
                Copiar link
              </Button>
              <Button
                type="primary"
                icon={<ShareAltOutlined />}
                onClick={handleOpenPublicLink}
              >
                Abrir link
              </Button>
            </>
          )}
        </Space>
      }
    >

      {isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : error || !shipment ? (
        <Alert
          type="error"
          message="Envio não encontrado"
          description="Verifique se o código está correto e tente novamente."
          action={
            <Button onClick={() => router.push("/shipments")}>
              Voltar para listagem
            </Button>
          }
        />
      ) : (
        <>
          {/* Seção 1: Informações Gerais */}
          <Card title="Informações Gerais">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary">Status</Text>
                <div style={{ marginTop: 4 }}>
                  <Tag color={shipment.status === 'delivered' ? 'green' : shipment.status === 'cancelled' ? 'red' : 'blue'}>
                    {STATUS_LABELS[shipment.status] ?? shipment.status}
                  </Tag>
                </div>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary">Código de rastreio</Text>
                <div style={{ marginTop: 4, fontWeight: 500 }}>{shipment.trackingCode}</div>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary">Método de pagamento</Text>
                <div style={{ marginTop: 4 }}>
                  {shipment.paymentMethod ? (
                    shipment.paymentMethod === 'wallet' ? 'Carteira' :
                    shipment.paymentMethod === 'pix' ? 'PIX' :
                    shipment.paymentMethod === 'card' ? 'Cartão' :
                    shipment.paymentMethod
                  ) : 'Não informado'}
                </div>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary">Destinatário</Text>
                <div style={{ marginTop: 4 }}>{shipment.recipientName || 'Não informado'}</div>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary">Cidade destino</Text>
                <div style={{ marginTop: 4 }}>
                  {shipment.destinationCity}, {shipment.destinationState}
                </div>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary">CEP destino</Text>
                <div style={{ marginTop: 4 }}>{shipment.destinationCep}</div>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary">Transportadora</Text>
                <div style={{ marginTop: 4 }}>{shipment.carrier || 'Não informado'}</div>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary">Serviço</Text>
                <div style={{ marginTop: 4 }}>{shipment.service || 'Não informado'}</div>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary">Prazo estimado</Text>
                <div style={{ marginTop: 4 }}>
                  {shipment.estimatedDays ? `${shipment.estimatedDays} dias` : 'Não informado'}
                </div>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary">Valor do frete</Text>
                <div style={{ marginTop: 4 }}>
                  {shipment.freightCost ? `R$ ${shipment.freightCost.toFixed(2)}` : 'Não informado'}
                </div>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary">Valor declarado</Text>
                <div style={{ marginTop: 4 }}>
                  {shipment.declaredValue ? `R$ ${shipment.declaredValue.toFixed(2)}` : 'Não informado'}
                </div>
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <Text type="secondary">Peso total</Text>
                <div style={{ marginTop: 4 }}>
                  {shipment.weight ? `${shipment.weight.toFixed(1)} kg` : 'Não informado'}
                </div>
              </Col>
              <Col xs={24}>
                <Text type="secondary">Criado em</Text>
                <div style={{ marginTop: 4 }}>
                  {new Date(shipment.createdAt).toLocaleString('pt-BR')}
                </div>
              </Col>
            </Row>
          </Card>

          {/* Seção 2: Volumes */}
          {shipment.volumes && shipment.volumes.length > 0 && (
            <Card title="Volumes do Envio">
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
            </Card>
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
                <Card title="Notas Fiscais Eletrônicas">
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
                </Card>
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
                <Card title="Declaração de Conteúdo">
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
                </Card>
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

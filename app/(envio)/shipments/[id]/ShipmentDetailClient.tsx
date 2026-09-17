"use client";

import { useParams, useRouter } from "next/navigation";
import { ELSkeleton, ELCard, ELAlert, ELTypography, ELSpace, ELTag, useELApp, ELTable, ELTooltip } from '@/shared/ui';
const Table = ELTable;
const Alert = ELAlert;
const Typography = ELTypography;
const Space = ELSpace;
const Tag = ELTag;
const Tooltip = ELTooltip;
const App = { useApp: useELApp };
import { ELButton } from '@/shared/ui/ELButton';
import { ELGrid, ELGridSpanFull } from '@/shared/ui/ELGrid';
import { ShareAltOutlined, CopyOutlined, PrinterOutlined } from "@ant-design/icons";
import { formatBRL, formatPaymentMethod } from "@/shared/utils/format";
import { useQuery } from "@tanstack/react-query";
import { TrackingTimeline } from "@/modules/tracking/ui/components/TrackingTimeline";
import { PageShell } from '@/shared/ui/PageShell';
import { ShipmentLabelPdfModal } from "@/modules/labels/ui/components";
import { printShipmentDocument, isNFeShipment } from "@/modules/labels/infra/print-shipment-declaration";
import { useState, useMemo } from "react";
import { generatePublicTimeline, type PublicTrackingEvent } from "@/modules/shipments/application/public-tracking-status";

const { Text } = Typography;

// Status válidos de shipment (alinhado com ShipmentStatus de types/contracts.ts)
// Shipments só são criados após pagamento aprovado
const STATUS_LABELS: Record<string, string> = {
  // Enum principal (snake_case)
  "criado": "Criado",
  "etiqueta_emitida": "Etiqueta Emitida",
  "postado": "Postado",
  "em_transporte": "Em Transporte",
  "entregue": "Entregue",
  "cancelado": "Cancelado",
  // Aliases legados (compatibilidade)
  "awaiting_pickup": "Aguardando Coleta",
  "awaiting_posting": "Aguardando Postagem",
  "ready_for_posting": "Pronto para Postagem",
  "posted": "Postado",
  "in_transit": "Em Trânsito",
  "out_for_delivery": "Em Rota de Entrega",
  "delivered": "Entregue",
  "cancelled": "Cancelado",
  // Status de banco (UPPER_SNAKE_CASE)
  "PICKUP_REQUESTED": "Coleta Solicitada",
  "AWAITING_PICKUP": "Aguardando Coleta",
  "AWAITING_POSTING": "Aguardando Postagem",
  "POSTED": "Postado",
  "IN_TRANSIT": "Em Trânsito",
  "DELIVERED": "Entregue",
  "CANCELLED": "Cancelado",
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

interface Label {
  id: string;
  status: string;
  carrier: string;
  service: string;
  isPrinted: boolean;
}

interface ShipmentDetail {
  id: string;
  trackingCode?: string; // Alias (compatibilidade)
  platformTrackingCode: string; // Campo real da API
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
  originAddress: string | null;
  originNeighborhood: string | null;
  originCity: string | null;
  originState: string | null;
  senderName: string | null;
  senderDocument: string | null;
  dceKey: string | null;
  destinationCep: string;
  destinationCity: string;
  destinationState: string;
  destinationAddress: string | null;
  destinationNeighborhood: string | null;
  recipientName: string | null;
  recipientPhone: string | null;
  recipientEmail: string | null;
  recipientDocument: string | null;
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
  label: Label | null;
}

export default function ShipmentDetailClient() {
  const { message } = App.useApp();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [labelModalOpen, setLabelModalOpen] = useState(false);

  console.debug('[DETAIL] params.id=', id);

  // Buscar shipment diretamente por ID
  // Retry configurado para casos onde o shipment ainda está sendo criado (pós-checkout)
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
    retry: 3, // Tentar 3 vezes caso falhe (shipment pode estar sendo criado)
    retryDelay: (attemptIndex) => Math.min(1000 * (attemptIndex + 1), 3000), // 1s, 2s, 3s
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

  // Gerar timeline de eventos (usar eventos reais ou gerar timeline baseada no status)
  const timelineEvents = useMemo(() => {
    if (!shipment) return [];

    // Se há eventos reais de rastreamento, usar eles
    if (shipment.trackingEvents && shipment.trackingEvents.length > 0) {
      return shipment.trackingEvents;
    }

    // Caso contrário, gerar timeline pública baseada no status atual
    const publicTimeline = generatePublicTimeline({
      createdAt: new Date(shipment.createdAt),
      status: shipment.status,
      originCity: undefined, // Não temos essa info no contexto do remetente
      originState: undefined,
      destinationCity: shipment.destinationCity || undefined,
      destinationState: shipment.destinationState || undefined,
    });

    // Converter para o formato esperado pelo TrackingTimeline
    return publicTimeline.map((event: PublicTrackingEvent) => ({
      type: event.status,
      description: event.title,
      city: event.location?.split('/')[0] || null,
      uf: event.location?.split('/')[1] || null,
      occurredAt: event.timestamp.toISOString(),
    }));
  }, [shipment]);

  // Montagem do documento vive em print-shipment-declaration para a listagem
  // (que só tem o id do envio) imprimir exatamente o mesmo PDF.
  const handlePrintDocument = () => {
    if (!shipment) return;
    if (shipment.volumes.length === 0) {
      message.warning('Este envio não tem volumes para imprimir.');
      return;
    }
    printShipmentDocument(shipment);
  };

  return (
    <PageShell
      title="Detalhes do envio"
      gap="md"
      extra={
        <Space wrap>
          <ELButton onClick={() => router.push("/shipments")}>Voltar</ELButton>
          {shipment?.label && shipment.label.status === 'issued' && (() => {
            // Só pode imprimir etiqueta se ainda não foi postado
            const canPrint = !shipment.postedAt;
            return (
              <Tooltip title={canPrint ? "Imprimir etiqueta" : "Objeto já postado"}>
                <ELButton
                  icon={<PrinterOutlined />}
                  onClick={() => setLabelModalOpen(true)}
                  disabled={!canPrint}
                >
                  Imprimir Etiqueta
                </ELButton>
              </Tooltip>
            );
          })()}
          {/* Só NF-e. A declaração de conteúdo em papel saiu de circulação em
              01/09/2026: o documento válido passou a ser a DC-e, emitida pelo
              cliente na SEFAZ. O gerador continua em document-pdf.ts. */}
          {shipment && shipment.volumes.length > 0 && isNFeShipment(shipment) && (
            <Tooltip title="Gerar o PDF e abrir a impressão">
              <ELButton icon={<PrinterOutlined />} onClick={handlePrintDocument}>
                Imprimir NF-e
              </ELButton>
            </Tooltip>
          )}
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
          actions={
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
                <div style={{ marginTop: 4, fontWeight: 500 }}>{shipment.platformTrackingCode}</div>
              </div>
              <div>
                <Text type="secondary">Método de pagamento</Text>
                <div style={{ marginTop: 4 }}>
                  {formatPaymentMethod(shipment.paymentMethod)}
                </div>
              </div>
              {shipment.dceKey && (
                <ELGridSpanFull>
                  <Text type="secondary">Chave da DC-e</Text>
                  <div style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>
                    {shipment.dceKey}
                  </div>
                </ELGridSpanFull>
              )}
              <div>
                <Text type="secondary">Remetente</Text>
                <div style={{ marginTop: 4 }}>{shipment.senderName || 'Não informado'}</div>
              </div>
              <div>
                <Text type="secondary">Endereço de origem</Text>
                <div style={{ marginTop: 4 }}>
                  {/* Envios criados antes de a origem passar a ser gravada só
                      têm o CEP — por isso o fallback em vez de "Não informado". */}
                  {shipment.originAddress ? (
                    <>
                      {shipment.originAddress}
                      {shipment.originNeighborhood ? ` - ${shipment.originNeighborhood}` : ''}
                      <br />
                      {[shipment.originCity, shipment.originState].filter(Boolean).join('/')}
                      {shipment.originCity ? ' - ' : ''}
                      {shipment.originCep}
                    </>
                  ) : (
                    shipment.originCep
                  )}
                </div>
              </div>
              <div>
                <Text type="secondary">Destinatário</Text>
                <div style={{ marginTop: 4 }}>{shipment.recipientName || 'Não informado'}</div>
              </div>
              <div>
                <Text type="secondary">Endereço de destino</Text>
                <div style={{ marginTop: 4 }}>
                  {shipment.destinationAddress ? (
                    <>
                      {shipment.destinationAddress}
                      {shipment.destinationNeighborhood ? ` - ${shipment.destinationNeighborhood}` : ''}
                      <br />
                      {shipment.destinationCity}/{shipment.destinationState} - {shipment.destinationCep}
                    </>
                  ) : (
                    shipment.destinationCep
                  )}
                </div>
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
                  {shipment.freightCost ? formatBRL(shipment.freightCost) : 'Não informado'}
                </div>
              </div>
              <div>
                <Text type="secondary">Valor declarado</Text>
                <div style={{ marginTop: 4 }}>
                  {shipment.declaredValue ? formatBRL(shipment.declaredValue) : 'Não informado'}
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
                          rowKey={(item) => item.id || `${item.descricao}-${item.quantidade}-${item.valorUnitario}`}
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
                              render: (val) => (val ? formatBRL(val) : '-'),
                            },
                            {
                              title: 'Subtotal',
                              dataIndex: 'subtotal',
                              width: 120,
                              align: 'right',
                              render: (val) => (val ? formatBRL(val) : '-'),
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
                                  <strong>{formatBRL(total)}</strong>
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
                            render: (val) => (val ? formatBRL(val) : '-'),
                          },
                          {
                            title: 'Subtotal',
                            dataIndex: 'subtotal',
                            width: 120,
                            align: 'right',
                            render: (val) => (val ? formatBRL(val) : '-'),
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
                                <strong>{formatBRL(total)}</strong>
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
                        render: (val) => (val ? formatBRL(val) : '-'),
                      },
                      {
                        title: 'Subtotal',
                        dataIndex: 'subtotal',
                        width: 120,
                        align: 'right',
                        render: (val) => (val ? formatBRL(val) : '-'),
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
                            <strong>{formatBRL(total)}</strong>
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

      {/* Modal de impressão de etiqueta */}
      {shipment && (
        <ShipmentLabelPdfModal
          open={labelModalOpen}
          onClose={() => setLabelModalOpen(false)}
          shipmentId={shipment.id}
          trackingCode={shipment.platformTrackingCode}
          volumes={shipment.volumes.map((v) => ({
            id: v.id,
            packageNumber: v.packageNumber,
            weight: v.weight,
          }))}
          labelId={shipment.label?.id}
          hasDeclaration={(shipment.document as { type?: string } | null)?.type === 'DECLARACAO'}
        />
      )}
    </PageShell>
  );
}

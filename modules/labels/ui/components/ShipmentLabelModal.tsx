"use client";

/**
 * Modal de impressão de etiquetas para envios
 * Suporta etiquetas Correios (formato oficial) e genéricas
 * Renderiza 1 etiqueta por volume
 * Suporta visualização de Declaração de Conteúdo (PDF) para envios Correios
 */

import { useRef, useCallback, useState, useEffect } from "react";
import { ELSpace, ELTypography, ELDivider, ELSpin } from "@/shared/ui";
const Space = ELSpace;
const Typography = ELTypography;
const Divider = ELDivider;
const Spin = ELSpin;
import { PrinterOutlined, CloseOutlined, LoadingOutlined, FilePdfOutlined, FileTextOutlined } from "@ant-design/icons";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { LabelRenderer, type LabelData } from "./LabelRenderer";
import styles from "./ShipmentLabelModal.module.css";
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';
import { ELAlert } from '@/shared/ui/ELAlert';
import { Radio } from 'antd';

type TabType = 'etiqueta' | 'declaracao';

export interface ShipmentLabelData {
  /** ID do envio */
  id: string;
  /** Transportadora */
  carrier: string;
  /** Código do serviço */
  serviceCode?: string;
  /** Nome do serviço */
  serviceName: string;
  /** Código de rastreamento */
  trackingCode?: string;
  /** Remetente */
  sender: {
    nome: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    telefone?: string;
    documento?: string;
  };
  /** Destinatário */
  recipient: {
    nome: string;
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    telefone?: string;
    documento?: string;
  };
  /** Volumes */
  volumes: Array<{
    pesoKg: number;
    pesoCubadoKg?: number;
    dimensoes?: {
      comprimento: number;
      largura: number;
      altura: number;
    };
  }>;
  /** Serviços adicionais */
  additionalServices?: {
    ar?: boolean;
    mp?: boolean;
    vd?: number;
    dd?: boolean;
  };
  /** Código do cartão de postagem */
  postingCardCode?: string;
  /** Número da NF-e */
  nfeNumber?: string;
}

export interface ShipmentLabelModalProps {
  /** Se o modal está aberto */
  open: boolean;
  /** Callback ao fechar */
  onClose: () => void;
  /** Dados do envio */
  shipment: ShipmentLabelData | null;
  /** Título customizado */
  title?: string;
  /** Callback após impressão */
  onPrint?: (shipmentId: string) => void;
  /** Se o envio possui declaração de conteúdo (document.type === 'DECLARACAO') */
  hasDeclaration?: boolean;
}

/**
 * Converte dados do envio em array de LabelData (uma por volume)
 */
function shipmentToLabels(shipment: ShipmentLabelData): LabelData[] {
  const totalVolumes = shipment.volumes.length;

  return shipment.volumes.map((volume, index) => ({
    id: `${shipment.id}-vol-${index + 1}`,
    carrier: shipment.carrier,
    serviceCode: shipment.serviceCode,
    serviceName: shipment.serviceName,
    trackingCode: shipment.trackingCode,
    sender: shipment.sender,
    recipient: shipment.recipient,
    volume: {
      index: index + 1,
      total: totalVolumes,
      pesoKg: volume.pesoKg,
      pesoCubadoKg: volume.pesoCubadoKg,
      dimensoes: volume.dimensoes,
    },
    additionalServices: shipment.additionalServices,
    postingCardCode: shipment.postingCardCode,
    nfeNumber: shipment.nfeNumber,
  }));
}

export function ShipmentLabelModal({
  open,
  onClose,
  shipment,
  title = "Etiquetas de Envio",
  onPrint,
  hasDeclaration = false,
}: ShipmentLabelModalProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const pdfAreaRef = useRef<HTMLDivElement>(null);
  const declaracaoIframeRef = useRef<HTMLIFrameElement>(null);
  const [printing, setPrinting] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [labelsReady, setLabelsReady] = useState(false);

  // Estados para controle de tabs e declaração de conteúdo
  const [activeTab, setActiveTab] = useState<TabType>('etiqueta');
  const [declaracaoPdfUrl, setDeclaracaoPdfUrl] = useState<string | null>(null);
  const [loadingDeclaracao, setLoadingDeclaracao] = useState(false);
  const [declaracaoError, setDeclaracaoError] = useState<string | null>(null);

  // Reset estado quando modal abre/fecha
  useEffect(() => {
    if (open && shipment) {
      // Dar tempo para códigos de barras serem gerados
      const timer = setTimeout(() => setLabelsReady(true), 1500);
      return () => clearTimeout(timer);
    } else {
      setLabelsReady(false);
      setActiveTab('etiqueta');
      setDeclaracaoError(null);
    }
  }, [open, shipment]);

  // Cleanup do URL da declaração quando fecha o modal
  useEffect(() => {
    return () => {
      if (declaracaoPdfUrl) {
        URL.revokeObjectURL(declaracaoPdfUrl);
      }
    };
  }, [declaracaoPdfUrl]);

  // Carregar PDF da declaração quando a tab for selecionada
  useEffect(() => {
    if (activeTab === 'declaracao' && shipment?.id && !declaracaoPdfUrl && !loadingDeclaracao) {
      setLoadingDeclaracao(true);
      setDeclaracaoError(null);

      fetch(`/api/shipments/${shipment.id}/declaracao-conteudo`)
        .then(async (res) => {
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || 'Erro ao carregar declaração');
          }
          return res.blob();
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          setDeclaracaoPdfUrl(url);
        })
        .catch((err) => {
          console.error('Erro ao carregar declaração:', err);
          setDeclaracaoError('Não foi possível carregar a declaração de conteúdo.');
        })
        .finally(() => setLoadingDeclaracao(false));
    }
  }, [activeTab, shipment?.id, declaracaoPdfUrl, loadingDeclaracao]);

  // Função para imprimir etiquetas
  const handlePrintEtiqueta = useCallback(async () => {
    if (!printAreaRef.current || !shipment) return;

    setPrinting(true);

    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("Não foi possível abrir a janela de impressão. Verifique se popups estão permitidos.");
        setPrinting(false);
        return;
      }

      // CSS para impressão em formato etiqueta Correios
      const printStyles = `
        <style>
          @page {
            size: 84.7mm 101.6mm;
            margin: 0;
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .label-page {
            width: 84.7mm;
            height: 101.6mm;
            page-break-after: always;
            page-break-inside: avoid;
            overflow: hidden;
            position: relative;
          }

          .label-page:last-child {
            page-break-after: auto;
          }

          img {
            max-width: 100%;
            height: auto;
          }

          svg {
            max-width: 100%;
          }
        </style>
      `;

      // Copiar conteúdo das etiquetas
      const content = printAreaRef.current.innerHTML;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Etiquetas - ${shipment.trackingCode || shipment.id}</title>
            ${printStyles}
          </head>
          <body>
            ${content}
          </body>
        </html>
      `);

      printWindow.document.close();

      // Aguardar carregamento das imagens antes de imprimir
      await new Promise((resolve) => setTimeout(resolve, 1500));

      printWindow.focus();
      printWindow.print();

      // Callback de impressão
      if (onPrint) {
        onPrint(shipment.id);
      }

      // Fechar janela após um delay
      setTimeout(() => {
        printWindow.close();
        setPrinting(false);
      }, 500);
    } catch (error) {
      console.error("Erro na impressão:", error);
      setPrinting(false);
    }
  }, [shipment, onPrint]);

  // Função para imprimir declaração de conteúdo
  const handlePrintDeclaracao = useCallback(async () => {
    if (!declaracaoPdfUrl || !shipment) return;

    setPrinting(true);

    try {
      // Criar iframe temporário para impressão do PDF
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.src = declaracaoPdfUrl;

      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            setPrinting(false);
          }, 1000);
        }, 500);
      };
    } catch (error) {
      console.error("Erro na impressão da declaração:", error);
      setPrinting(false);
    }
  }, [declaracaoPdfUrl, shipment]);

  // Handler unificado de impressão
  const handlePrint = useCallback(async () => {
    if (activeTab === 'etiqueta') {
      await handlePrintEtiqueta();
    } else {
      await handlePrintDeclaracao();
    }
  }, [activeTab, handlePrintEtiqueta, handlePrintDeclaracao]);

  // Função para salvar etiqueta como PDF
  const handleSavePdfEtiqueta = useCallback(async () => {
    if (!pdfAreaRef.current || !shipment) return;

    setSavingPdf(true);

    try {
      // Dimensões da etiqueta Correios em mm
      const labelWidthMm = 84.7;
      const labelHeightMm = 101.6;

      // Criar PDF com tamanho da etiqueta
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [labelWidthMm, labelHeightMm],
      });

      // Obter todos os elementos de etiqueta
      const labelElements = pdfAreaRef.current.querySelectorAll(".pdf-label-item");

      for (let i = 0; i < labelElements.length; i++) {
        const labelElement = labelElements[i] as HTMLElement;

        // Se não for a primeira página, adicionar nova página
        if (i > 0) {
          pdf.addPage([labelWidthMm, labelHeightMm]);
        }

        // Renderizar elemento para canvas com alta resolução
        const canvas = await html2canvas(labelElement, {
          scale: 3, // Alta resolução para impressão
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
        });

        // Converter canvas para imagem e adicionar ao PDF
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, labelWidthMm, labelHeightMm);
      }

      // Gerar nome do arquivo
      const fileName = shipment.trackingCode
        ? `etiqueta-${shipment.trackingCode}.pdf`
        : `etiqueta-${shipment.id}.pdf`;

      // Salvar PDF
      pdf.save(fileName);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF. Tente novamente.");
    } finally {
      setSavingPdf(false);
    }
  }, [shipment]);

  // Função para baixar declaração de conteúdo como PDF
  const handleSavePdfDeclaracao = useCallback(async () => {
    if (!declaracaoPdfUrl || !shipment) return;

    setSavingPdf(true);

    try {
      const a = document.createElement('a');
      a.href = declaracaoPdfUrl;
      a.download = `declaracao-conteudo-${shipment.trackingCode || shipment.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Erro ao baixar declaração:", error);
      alert("Erro ao baixar declaração. Tente novamente.");
    } finally {
      setSavingPdf(false);
    }
  }, [declaracaoPdfUrl, shipment]);

  // Handler unificado de PDF
  const handleSavePdf = useCallback(async () => {
    if (activeTab === 'etiqueta') {
      await handleSavePdfEtiqueta();
    } else {
      await handleSavePdfDeclaracao();
    }
  }, [activeTab, handleSavePdfEtiqueta, handleSavePdfDeclaracao]);

  // Se não há dados, não renderizar
  if (!shipment) {
    return null;
  }

  const labels = shipmentToLabels(shipment);
  const isCorreios = shipment.carrier.toLowerCase().includes("correios") ||
    shipment.carrier.toLowerCase().includes("sedex") ||
    shipment.carrier.toLowerCase().includes("pac");

  // Determinar se os botões estão habilitados baseado na tab ativa
  const isEtiquetaReady = activeTab === 'etiqueta' && labelsReady;
  const isDeclaracaoReady = activeTab === 'declaracao' && !!declaracaoPdfUrl && !loadingDeclaracao;
  const isCurrentTabReady = activeTab === 'etiqueta' ? isEtiquetaReady : isDeclaracaoReady;

  return (
    <ELModal
      open={open}
      onCancel={onClose}
      title={
        <Space>
          <PrinterOutlined />
          <span>{title}</span>
        </Space>
      }
      width={hasDeclaration ? 550 : 450}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <ELButton icon={<CloseOutlined />} onClick={onClose} disabled={printing || savingPdf}>
            Fechar
          </ELButton>
          <ELButton
            icon={savingPdf ? <LoadingOutlined spin /> : <FilePdfOutlined />}
            onClick={handleSavePdf}
            disabled={!isCurrentTabReady || savingPdf || printing}
            loading={savingPdf}
          >
            {savingPdf ? "Gerando..." : "PDF"}
          </ELButton>
          <ELButton
            variant="primary"
            icon={printing ? <LoadingOutlined spin /> : <PrinterOutlined />}
            onClick={handlePrint}
            disabled={!isCurrentTabReady || printing || savingPdf}
            loading={printing}
          >
            {printing ? "Imprimindo..." : "Imprimir"}
          </ELButton>
        </div>
      }
      styles={{
        body: {
          maxHeight: "70vh",
          overflow: "auto",
          padding: "16px",
        },
      }}
    >
      {/* Informações do envio */}
      <div className={styles.shipmentInfo}>
        <Typography.Text strong>{shipment.carrier}</Typography.Text>
        <Typography.Text type="secondary"> - {shipment.serviceName}</Typography.Text>
        {shipment.trackingCode && (
          <div>
            <Typography.Text code>{shipment.trackingCode}</Typography.Text>
          </div>
        )}
      </div>

      <Divider style={{ margin: "12px 0" }} />

      {/* Tabs para alternar entre etiqueta e declaração */}
      {hasDeclaration && isCorreios && (
        <div style={{ marginBottom: 16 }}>
          <Radio.Group
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            optionType="button"
            buttonStyle="solid"
            size="middle"
          >
            <Radio.Button value="etiqueta">
              <PrinterOutlined style={{ marginRight: 4 }} />
              Etiqueta
            </Radio.Button>
            <Radio.Button value="declaracao">
              <FileTextOutlined style={{ marginRight: 4 }} />
              Declaração de Conteúdo
            </Radio.Button>
          </Radio.Group>
        </div>
      )}

      {/* Conteúdo da tab Etiqueta */}
      {activeTab === 'etiqueta' && (
        <>
          {/* Aviso sobre impressão */}
          <ELAlert
            variant="info"
            title="Configuração de impressão"
            description={
              isCorreios
                ? "Use papel para etiquetas 84.7 x 101.6 mm (padrão Correios). Configure a impressora sem margens e sem ajuste de escala."
                : "Configure a impressora conforme o tipo de etiqueta disponível. Recomendado: 84.7 x 101.6 mm."
            }
            style={{ marginBottom: 16 }}
          />

          {/* Estado de carregamento */}
          {!labelsReady && (
            <div className={styles.loadingContainer}>
              <Spin indicator={<LoadingOutlined spin />} />
              <Typography.Text type="secondary">Gerando códigos de barras...</Typography.Text>
            </div>
          )}

          {/* Preview das etiquetas */}
          <div className={styles.previewContainer} style={{ opacity: labelsReady ? 1 : 0.5 }}>
            <Typography.Text type="secondary" style={{ marginBottom: 8, display: "block" }}>
              Visualização ({labels.length} etiqueta{labels.length > 1 ? "s" : ""}):
            </Typography.Text>

            <div className={styles.labelsPreview}>
              {labels.map((label, index) => (
                <div key={label.id} className={styles.labelWrapper}>
                  <div className={styles.labelNumber}>
                    Volume {index + 1} de {labels.length}
                  </div>
                  <div className={styles.labelPreview}>
                    <LabelRenderer data={label} scale={0.42} showCutLine />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Conteúdo da tab Declaração de Conteúdo */}
      {activeTab === 'declaracao' && (
        <>
          {/* Aviso sobre impressão da declaração */}
          <ELAlert
            variant="info"
            title="Declaração de Conteúdo"
            description="Documento obrigatório para envios sem nota fiscal. Imprima em papel A4 e anexe ao pacote."
            style={{ marginBottom: 16 }}
          />

          {/* Estado de carregamento da declaração */}
          {loadingDeclaracao && (
            <div className={styles.loadingContainer}>
              <Spin indicator={<LoadingOutlined spin />} />
              <Typography.Text type="secondary">Carregando declaração...</Typography.Text>
            </div>
          )}

          {/* Erro ao carregar declaração */}
          {declaracaoError && (
            <ELAlert
              variant="error"
              title="Erro"
              description={declaracaoError}
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Preview do PDF da declaração */}
          {declaracaoPdfUrl && !loadingDeclaracao && (
            <div style={{ width: '100%', height: '400px', border: '1px solid #d9d9d9', borderRadius: 4 }}>
              <iframe
                ref={declaracaoIframeRef}
                src={declaracaoPdfUrl}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="Declaração de Conteúdo"
              />
            </div>
          )}
        </>
      )}

      {/* Área oculta para impressão */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <div ref={printAreaRef}>
          {labels.map((label) => (
            <div key={label.id} className="label-page">
              <LabelRenderer data={label} scale={1} />
            </div>
          ))}
        </div>
      </div>

      {/* Área oculta para geração de PDF (com tamanho fixo em pixels para html2canvas) */}
      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <div ref={pdfAreaRef}>
          {labels.map((label) => (
            <div
              key={`pdf-${label.id}`}
              className="pdf-label-item"
              style={{
                width: "320px",  // ~84.7mm em ~96dpi
                height: "384px", // ~101.6mm em ~96dpi
                overflow: "hidden",
                backgroundColor: "#ffffff",
              }}
            >
              <LabelRenderer data={label} scale={1} />
            </div>
          ))}
        </div>
      </div>
    </ELModal>
  );
}

export default ShipmentLabelModal;

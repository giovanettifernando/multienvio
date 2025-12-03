"use client";

/**
 * Componente de Etiqueta Correios - Layout Oficial
 * Formato: 84.7 x 101.6 mm
 * Baseado no Guia de Endereçamento Correios
 */

import { useEffect, useState } from "react";
import type { CorreiosLabelData, EtiquetaCorreiosProps } from "@/types/correios-label";
import { RoutingSymbolIcon } from "./RoutingSymbols";
import {
  generateDataMatrix,
  generateCode128,
  generateGS1128,
} from "@/lib/correios/barcode-generator";
import {
  generateDataMatrixString,
  formatCep,
  formatWeight,
} from "@/lib/correios/label-utils";
import styles from "./EtiquetaCorreios.module.css";

interface BarcodeImages {
  dataMatrix: string | null;
  tracking: string | null;
  cep: string | null;
}

// Formatar código de rastreamento com espaços
function formatTrackingCode(code: string): string {
  if (!code || code.length < 13) return code;
  // Format: XX 123 456 789 BR
  const prefix = code.slice(0, 2);
  const num1 = code.slice(2, 5);
  const num2 = code.slice(5, 8);
  const num3 = code.slice(8, 11);
  const suffix = code.slice(11, 13);
  return `${prefix} ${num1} ${num2} ${num3} ${suffix}`;
}

export function EtiquetaCorreios({
  data,
  showCutLine = false,
  scale = 1,
}: EtiquetaCorreiosProps) {
  const [barcodes, setBarcodes] = useState<BarcodeImages>({
    dataMatrix: null,
    tracking: null,
    cep: null,
  });
  const [loading, setLoading] = useState(true);

  // Gerar códigos de barras
  useEffect(() => {
    async function generateBarcodes() {
      setLoading(true);
      try {
        const dataMatrixString = generateDataMatrixString(data);

        const [dataMatrix, tracking, cep] = await Promise.all([
          generateDataMatrix(dataMatrixString, { scale: 3 }),
          generateGS1128(data.trackingCode, { scale: 2, includetext: false }),
          generateCode128(data.recipient.cep.replace(/\D/g, ""), {
            scale: 2,
            includetext: false,
          }),
        ]);

        setBarcodes({ dataMatrix, tracking, cep });
      } catch (error) {
        console.error("Erro ao gerar códigos de barras:", error);
      } finally {
        setLoading(false);
      }
    }

    generateBarcodes();
  }, [data]);

  const { sender, recipient, volume, additionalServices, trackingCode, routingSymbol } = data;

  // Formatação do endereço completo do destinatário
  const recipientAddressLine1 = `${recipient.logradouro}, ${recipient.numero}`;
  const recipientAddressLine2 = [recipient.complemento, recipient.bairro]
    .filter(Boolean)
    .join(" - ");

  // Formatação do endereço completo do remetente
  const senderAddressLine = [
    sender.logradouro,
    sender.numero,
    sender.complemento,
    sender.bairro,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={styles.label}
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      {showCutLine && <div className={styles.cutLine} />}

      {/* ═══════════════════════════════════════════
          SEÇÃO SUPERIOR - Área de dados do serviço
          ═══════════════════════════════════════════ */}
      <div className={styles.headerSection}>
        {/* Coluna esquerda: Data Matrix */}
        <div className={styles.dataMatrixContainer}>
          {loading ? (
            <div className={styles.loadingPlaceholder}>...</div>
          ) : barcodes.dataMatrix ? (
            <img
              src={barcodes.dataMatrix}
              alt="Data Matrix"
              className={styles.dataMatrixImg}
            />
          ) : (
            <div className={styles.errorPlaceholder}>Erro</div>
          )}
        </div>

        {/* Coluna central: Informações do serviço */}
        <div className={styles.serviceInfoContainer}>
          {/* Linha 1: NF, Contrato, Volume, Peso */}
          <div className={styles.serviceInfoRow}>
            <span className={styles.serviceLabel}>
              NF:<span className={styles.serviceValue}>{data.nfeNumber || "-"}</span>
            </span>
            <span className={styles.serviceLabel}>
              Contrato:<span className={styles.serviceValue}>{data.postingCardCode || "-"}</span>
            </span>
            <span className={styles.serviceLabel}>
              Volume:<span className={styles.serviceValue}>{volume.index}/{volume.total}</span>
            </span>
            <span className={styles.serviceLabel}>
              Peso (g):<span className={styles.serviceValue}>{Math.round(volume.pesoKg * 1000)}</span>
            </span>
          </div>

          {/* Linha 2: Código de rastreamento grande */}
          <div className={styles.trackingCodeLarge}>
            {formatTrackingCode(trackingCode)}
          </div>

          {/* Linha 3: Barcode do rastreamento */}
          <div className={styles.trackingBarcodeContainer}>
            {barcodes.tracking ? (
              <img
                src={barcodes.tracking}
                alt="Código de barras"
                className={styles.trackingBarcodeImg}
              />
            ) : (
              <div className={styles.loadingPlaceholder}>...</div>
            )}
          </div>
        </div>

        {/* Coluna direita: Símbolo + Serviços adicionais */}
        <div className={styles.rightColumn}>
          <div className={styles.routingSymbolContainer}>
            <RoutingSymbolIcon type={routingSymbol} width={50} height={35} />
          </div>

          <div className={styles.additionalServices}>
            <div className={styles.serviceRow}>
              <span className={styles.serviceCode}>AR</span>
              <span className={styles.serviceCheck}>{additionalServices.ar ? "XX" : ""}</span>
            </div>
            <div className={styles.serviceRow}>
              <span className={styles.serviceCode}>MP</span>
              <span className={styles.serviceCheck}>{additionalServices.mp ? "XX" : ""}</span>
            </div>
            <div className={styles.serviceRow}>
              <span className={styles.serviceCode}>DD</span>
              <span className={styles.serviceCheck}>{additionalServices.dd ? "XX" : ""}</span>
            </div>
            <div className={styles.serviceRow}>
              <span className={styles.serviceCode}>VD</span>
              <span className={styles.serviceCheck}>
                {additionalServices.vd ? (additionalServices.vd / 100).toFixed(0) : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SEÇÃO RECEBEDOR - Área para assinatura
          ═══════════════════════════════════════════ */}
      <div className={styles.receiverSection}>
        <div className={styles.receiverRow}>
          <span className={styles.receiverLabel}>Recebedor:</span>
          <span className={styles.receiverLine} />
        </div>
        <div className={styles.receiverRow}>
          <span className={styles.receiverLabel}>Assinatura:</span>
          <span className={styles.receiverLine} />
          <span className={styles.receiverLabel}>Documento:</span>
          <span className={styles.receiverLine} />
        </div>
      </div>

      {/* Faixa de entrega no vizinho */}
      <div className={styles.neighborBanner}>
        ENTREGA NO VIZINHO AUTORIZADA
      </div>

      {/* Complemento do endereço se houver */}
      {recipient.complemento && (
        <div className={styles.complementRow}>
          {recipient.complemento}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          SEÇÃO DESTINATÁRIO
          ═══════════════════════════════════════════ */}
      <div className={styles.recipientSection}>
        <div className={styles.recipientHeader}>
          <span className={styles.recipientTitle}>DESTINATÁRIO</span>
          <span className={styles.correiosLogo}>●Correios</span>
        </div>

        <div className={styles.recipientContent}>
          {/* Nome do destinatário */}
          <div className={styles.recipientName}>{recipient.nome}</div>

          {/* Endereço */}
          <div className={styles.recipientAddress}>{recipientAddressLine1}</div>
          {recipientAddressLine2 && (
            <div className={styles.recipientAddress}>{recipientAddressLine2}</div>
          )}

          {/* CEP + Cidade/UF com barcode */}
          <div className={styles.cepRow}>
            <div className={styles.cepInfo}>
              <span className={styles.cepNumber}>{formatCep(recipient.cep)}</span>
              <span className={styles.cepCity}>{recipient.cidade}/{recipient.uf}</span>
            </div>
            <div className={styles.cepBarcodeContainer}>
              {barcodes.cep ? (
                <img
                  src={barcodes.cep}
                  alt="CEP"
                  className={styles.cepBarcodeImg}
                />
              ) : null}
            </div>
          </div>

          {/* Observações */}
          <div className={styles.obsRow}>
            <span className={styles.obsLabel}>Obs:</span>
            <span className={styles.obsText}>{data.observation || ""}</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          SEÇÃO REMETENTE
          ═══════════════════════════════════════════ */}
      <div className={styles.senderSection}>
        <div className={styles.senderRow}>
          <span className={styles.senderLabel}>Remetente:</span>
          <span className={styles.senderName}>{sender.nome}</span>
        </div>
        <div className={styles.senderAddress}>{senderAddressLine}</div>
        <div className={styles.senderCep}>
          <span className={styles.senderCepNumber}>{formatCep(sender.cep)}</span>
          <span className={styles.senderCity}>{sender.cidade}-{sender.uf}</span>
        </div>
      </div>
    </div>
  );
}

export default EtiquetaCorreios;

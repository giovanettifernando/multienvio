"use client";

/**
 * Componente de Etiqueta Genérica
 * Usado para transportadoras não-Correios (temporário)
 * Formato: 84.7 x 101.6 mm (mesmo tamanho Correios para uniformidade)
 */

import { useEffect, useState } from "react";
import type { GenericLabelData, EtiquetaGenericaProps } from "@/types/correios-label";
import { generateCode128 } from "@/lib/correios/barcode-generator";
import { formatCep, formatWeight } from "@/lib/correios/label-utils";
import styles from "./EtiquetaGenerica.module.css";

export function EtiquetaGenerica({
  data,
  showCutLine = false,
  scale = 1,
}: EtiquetaGenericaProps) {
  const [trackingBarcode, setTrackingBarcode] = useState<string | null>(null);

  // Gerar código de barras do rastreamento se disponível
  useEffect(() => {
    async function generateBarcode() {
      if (data.trackingCode) {
        try {
          const barcode = await generateCode128(data.trackingCode, {
            scale: 2,
            includetext: false,
          });
          setTrackingBarcode(barcode);
        } catch (error) {
          console.error("Erro ao gerar código de barras:", error);
        }
      }
    }
    generateBarcode();
  }, [data.trackingCode]);

  const { sender, recipient, volume, carrier, serviceName, trackingCode } = data;

  // Formatação do endereço do destinatário
  const recipientAddress = [
    `${recipient.logradouro}, ${recipient.numero}`,
    recipient.complemento,
    recipient.bairro,
  ]
    .filter(Boolean)
    .join(" - ");

  const recipientCityState = `${recipient.cidade} / ${recipient.uf}`;

  // Formatação do endereço do remetente
  const senderAddress = [
    `${sender.logradouro}, ${sender.numero}`,
    sender.complemento,
    sender.bairro,
  ]
    .filter(Boolean)
    .join(" - ");

  const senderCityState = `${sender.cidade} / ${sender.uf}`;

  return (
    <div
      className={styles.label}
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}
    >
      {/* Linha de corte (opcional) */}
      {showCutLine && <div className={styles.cutLine} />}

      {/* Cabeçalho: Transportadora e Serviço */}
      <div className={styles.header}>
        <div className={styles.carrierName}>{carrier}</div>
        <div className={styles.serviceName}>{serviceName}</div>
        <div className={styles.volumeInfo}>
          Volume: {volume.index}/{volume.total} | {formatWeight(volume.pesoKg)}
        </div>
      </div>

      {/* Seção do destinatário */}
      <div className={styles.recipientSection}>
        <div className={styles.sectionLabel}>DESTINATÁRIO</div>
        <div className={styles.recipientName}>{recipient.nome}</div>
        <div className={styles.recipientAddress}>{recipientAddress}</div>
        <div className={styles.recipientCityState}>{recipientCityState}</div>
        <div className={styles.recipientCep}>CEP: {formatCep(recipient.cep)}</div>
        {recipient.telefone && (
          <div className={styles.recipientPhone}>Tel: {recipient.telefone}</div>
        )}
      </div>

      {/* Linha divisória */}
      <div className={styles.divider} />

      {/* Seção do remetente */}
      <div className={styles.senderSection}>
        <div className={styles.sectionLabel}>REMETENTE</div>
        <div className={styles.senderName}>{sender.nome}</div>
        <div className={styles.senderAddress}>{senderAddress}</div>
        <div className={styles.senderCityState}>
          {senderCityState} - CEP: {formatCep(sender.cep)}
        </div>
      </div>

      {/* Código de rastreamento */}
      {trackingCode && (
        <div className={styles.trackingSection}>
          {trackingBarcode && (
            <div className={styles.trackingBarcode}>
              {/* eslint-disable-next-line @next/next/no-img-element -- base64 barcode for print */}
              <img
                src={trackingBarcode}
                alt="Rastreamento"
                className={styles.trackingBarcodeImg}
              />
            </div>
          )}
          <div className={styles.trackingCode}>{trackingCode}</div>
        </div>
      )}

      {/* Assinatura do recebedor */}
      <div className={styles.signatureSection}>
        <div className={styles.signatureLabel}>Recebedor:</div>
        <div className={styles.signatureLine} />
        <div className={styles.signatureFields}>
          <span>Nome legível:</span>
          <span>Doc:</span>
          <span>Data: ___/___/___</span>
        </div>
      </div>
    </div>
  );
}

export default EtiquetaGenerica;

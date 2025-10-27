/**
 * Utility para criar coleta automaticamente após checkout
 */

export interface OrderForColeta {
  id: string;
  trackingCode: string; // código de rastreio gerado no fluxo de etiqueta/gestão de envios
  origemCep: string;
  destinoCep: string;
  pickupSelected: boolean;
  dropoffPointSelected?: boolean;
  coletaDate?: string; // yyyy-mm-dd
}

/**
 * Cria coleta automaticamente se o pedido requer coleta no endereço
 * Não cria se for entrega em ponto de coleta
 */
export async function createColetaIfNeeded(
  order: OrderForColeta
): Promise<void> {
  // Só cria coleta se pickup selecionado E não for dropoff point
  if (!order.pickupSelected || order.dropoffPointSelected) {
    return;
  }

  // Define data da coleta (usa fornecida ou próximo dia útil)
  const scheduledFor =
    order.coletaDate ?? new Date().toISOString().slice(0, 10);

  try {
    const response = await fetch("/api/mock/coletas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        trackingCode: order.trackingCode,
        origemCep: order.origemCep,
        destinoCep: order.destinoCep,
        scheduledFor,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Erro ao criar coleta após checkout:", await response.text());
    }
  } catch (error) {
    console.error("Erro ao criar coleta após checkout:", error);
  }
}

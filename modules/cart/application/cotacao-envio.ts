import { ApiError } from '@/platform/api/errors';

/**
 * Confere se o envio que vai ser pago é o mesmo que foi cotado.
 *
 * O preço sai da cotação salva no servidor; sem esta conferência dava para
 * cotar 1 kg de SP para SP e usar essa cotação para mandar 30 kg para Manaus,
 * ou cotar sem seguro e declarar R$ 10.000 na etiqueta. Mais leve, menor ou
 * com seguro menor passa: fica mais barato para a transportadora.
 */

export type CotacaoSalva = {
  originCep: string;
  destCep: string;
  insuranceValue: number | string | { toString(): string } | null;
  volumes: Array<{
    weight: number | string | { toString(): string };
    height: number;
    width: number;
    length: number;
  }>;
};

export type EnvioCotado = {
  originCep: string;
  destinationCep: string;
  insuranceValue?: number | null;
  volumes: Array<{ pesoKg: number; alturaCm: number; larguraCm: number; comprimentoCm: number }>;
};

// Folga para arredondamento (gramas, milímetros, centavos)
const FOLGA_PESO_KG = 0.01;
const FOLGA_MEDIDA_CM = 0.5;
const FOLGA_VALOR = 0.01;

const soDigitos = (cep: string) => cep.replace(/\D/g, '');
const numero = (v: number | string | { toString(): string } | null | undefined) =>
  v === null || v === undefined ? 0 : Number(v.toString());

function naoBate(motivo: string): never {
  throw new ApiError({
    code: 'QUOTE_MISMATCH',
    message: `O envio não bate com a cotação: ${motivo}. Faça uma nova cotação.`,
    status: 400,
  });
}

export function conferirEnvioComCotacao(cotacao: CotacaoSalva, envio: EnvioCotado): void {
  if (soDigitos(envio.originCep) !== soDigitos(cotacao.originCep)) {
    naoBate('CEP de origem diferente do cotado');
  }
  if (soDigitos(envio.destinationCep) !== soDigitos(cotacao.destCep)) {
    naoBate('CEP de destino diferente do cotado');
  }

  if (envio.volumes.length !== cotacao.volumes.length) {
    naoBate(`${envio.volumes.length} volumes, a cotação foi para ${cotacao.volumes.length}`);
  }

  envio.volumes.forEach((vol, i) => {
    const cotado = cotacao.volumes[i];
    if (vol.pesoKg > numero(cotado.weight) + FOLGA_PESO_KG) {
      naoBate(`volume ${i + 1} com peso acima do cotado`);
    }
    if (
      vol.alturaCm > cotado.height + FOLGA_MEDIDA_CM ||
      vol.larguraCm > cotado.width + FOLGA_MEDIDA_CM ||
      vol.comprimentoCm > cotado.length + FOLGA_MEDIDA_CM
    ) {
      naoBate(`volume ${i + 1} com medidas acima das cotadas`);
    }
  });

  if (numero(envio.insuranceValue) > numero(cotacao.insuranceValue) + FOLGA_VALOR) {
    naoBate('valor declarado acima do cotado');
  }
}

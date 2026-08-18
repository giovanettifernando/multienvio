"use client";

import { useState } from "react";
import {
  useELApp,
  ELAlert,
  ELButton,
  ELFlexAntd,
  ELInputNumber,
  ELTooltip,
  ELTypography,
} from "@/shared/ui";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useQuoteStore } from "@/modules/quotes/ui/state/useQuoteStore";
import { useQuoteCalculate } from "@/modules/quotes/ui/hooks";
import { inputNumberFormatterBRL, inputNumberParserBRL } from "@/shared/utils/format";
import { formatBRL } from "@/shared/utils/format";

const Flex = ELFlexAntd;
const InputNumber = ELInputNumber;
const Tooltip = ELTooltip;
const Typography = ELTypography;
const { Text } = Typography;

/**
 * Faixa aceita pelos Correios para valor declarado.
 *
 * Fora dela a cotação com seguro é RECUSADA pela API deles — e o serviço
 * simplesmente some da lista (medido: com R$ 50.000 o SEDEX desaparece da
 * resposta, sobrando só o PAC, que não aceita seguro). Sem validar aqui, o
 * usuário digita um valor alto e não entende por que nada acontece.
 *
 * Espelha CORREIOS_LIMITS em platform/integrations/correios/constants.ts.
 */
const VALOR_MINIMO_SEGURO = 25.63;
const VALOR_MAXIMO_SEGURO = 38057.59;

/**
 * Campo de seguro da tela de finalizar envio.
 *
 * Por que ele recota em vez de apenas guardar o valor: nas transportadoras o
 * seguro é o "valor declarado", que entra no cálculo do frete — medido no
 * SEDEX, R$ 250 de seguro custam R$ 2,24 a mais. Se o valor fosse apenas
 * anotado aqui, o cliente pagaria um preço e a transportadora cobraria outro.
 *
 * Por isso, ao confirmar, refazemos a cotação com o valor declarado e
 * atualizamos o preço do serviço já escolhido. O usuário vê o preço novo
 * ANTES de pagar.
 */
export function InsuranceField() {
  const { message } = useELApp();
  const calculateQuotes = useQuoteCalculate();

  const results = useQuoteStore((s) => s.results);
  const selection = useQuoteStore((s) => s.selection);
  const updateSummary = useQuoteStore((s) => s.updateSummary);
  const setSelection = useQuoteStore((s) => s.setSelection);

  const seguroAtual = results?.resumo.seguroValor ?? null;
  const [valor, setValor] = useState<number | null>(seguroAtual);

  const precoAtual = selection?.result.preco ?? null;
  const alterado = (valor ?? 0) !== (seguroAtual ?? 0);
  const abaixoDoMinimo = (valor ?? 0) > 0 && (valor ?? 0) < VALOR_MINIMO_SEGURO;
  const acimaDoMaximo = (valor ?? 0) > VALOR_MAXIMO_SEGURO;
  const foraDaFaixa = abaixoDoMinimo || acimaDoMaximo;

  const aplicar = async () => {
    if (!results || !selection) return;
    if (foraDaFaixa) return;

    const resumo = results.resumo;
    try {
      const resposta = await calculateQuotes.mutateAsync({
        origem: { cep: resumo.origemCep ?? "" },
        destino: { cep: resumo.destinoCep ?? "" },
        volumes: resumo.volumes ?? [],
        seguro: valor && valor > 0 ? valor : null,
        coleta: resumo.coleta ?? false,
        devolucao: resumo.devolucao ?? false,
      } as never);

      // Reencontrar o MESMO serviço na cotação nova. Se ele sumiu (nem todo
      // serviço aceita valor declarado — o código dos Correios inclusive
      // separa os que aceitam dos que não), avisamos em vez de trocar a
      // escolha do usuário pelas costas.
      const anterior = selection.result;
      const novo = resposta.results.find(
        (r) => r.carrier === anterior.carrier && r.modalidade === anterior.modalidade,
      );

      // ATENÇÃO: não usar `setResults` aqui. Ele zera a seleção
      // (`selection: null`), o que faz sentido numa cotação nova — mas neste
      // componente a seleção é o que mantém a tela de pé (`if (!selection)
      // return null`). Chamar setResults desmontava o campo no meio da
      // operação e o setSelection seguinte se perdia: o preço voltava ao
      // antigo e a mensagem dizia "Seguro aplicado" sem nada ter mudado.
      //
      // A ordem abaixo importa: primeiro a seleção nova (preço atualizado),
      // depois o resumo, que preserva a seleção.
      if (novo) {
        setSelection({ ...selection, result: novo });
      }

      updateSummary({ seguroValor: valor && valor > 0 ? valor : null });

      if (!novo) {
        message.warning(
          "Com esse valor de seguro, o serviço escolhido deixou de estar disponível. Escolha outro na cotação.",
          6,
        );
        return;
      }

      const diferenca = novo.preco - anterior.preco;
      if (Math.abs(diferenca) >= 0.01) {
        message.info(
          `Frete atualizado para ${formatBRL(novo.preco)} (${diferenca > 0 ? "+" : "−"}${formatBRL(Math.abs(diferenca))} de seguro).`,
          6,
        );
      } else {
        message.success("Seguro aplicado.");
      }
    } catch {
      message.error("Não foi possível recalcular o frete com esse seguro. Tente novamente.");
    }
  };

  if (!results || !selection) return null;

  // Serviço que não aceita valor declarado (PAC dos Correios, por regra deles)
  // não mostra o campo: aceitar um valor que seria ignorado faz o usuário
  // achar que contratou uma cobertura que não existe.
  if (selection.result.aceitaSeguro === false) return null;

  return (
    <Flex vertical gap={8} style={{ width: "100%" }}>
      <Flex align="center" gap={8} wrap="wrap">
        <Flex align="center" gap={4}>
          <Tooltip title="Valor que será coberto em caso de extravio ou avaria. Entra no cálculo do frete.">
            <QuestionCircleOutlined style={{ fontSize: 12, color: "#667085", cursor: "help" }} />
          </Tooltip>
          <Text style={{ fontSize: 13 }}>Valor do seguro</Text>
        </Flex>

        <InputNumber
          value={valor}
          onChange={(v) => setValor(typeof v === "number" ? v : null)}
          min={0}
          step={10}
          precision={2}
          placeholder="Opcional"
          prefix="R$"
          formatter={inputNumberFormatterBRL}
          parser={inputNumberParserBRL}
          status={foraDaFaixa ? "error" : undefined}
          disabled={calculateQuotes.isPending}
          style={{ width: 150 }}
        />

        {alterado && (
          <ELButton
            variant="primary"
            size="small"
            loading={calculateQuotes.isPending}
            disabled={foraDaFaixa}
            onClick={aplicar}
          >
            Aplicar
          </ELButton>
        )}
      </Flex>

      {abaixoDoMinimo && (
        <Text type="danger" style={{ fontSize: 12 }}>
          Valor mínimo de {formatBRL(VALOR_MINIMO_SEGURO)}
        </Text>
      )}

      {acimaDoMaximo && (
        <Text type="danger" style={{ fontSize: 12 }}>
          Valor máximo de {formatBRL(VALOR_MAXIMO_SEGURO)} — acima disso os
          Correios recusam a cotação e o serviço deixa de aparecer.
        </Text>
      )}

      {alterado && !foraDaFaixa && (
        <ELAlert
          variant="info"
          message="Informar o seguro recalcula o frete — o valor declarado entra no preço da transportadora."
        />
      )}

      {!alterado && seguroAtual ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Frete atual com seguro: {precoAtual !== null ? formatBRL(precoAtual) : "—"}
        </Text>
      ) : null}
    </Flex>
  );
}

export default InsuranceField;

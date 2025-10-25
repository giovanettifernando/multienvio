"use client";

import { EnvironmentOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Flex,
  List,
  Radio,
  Skeleton,
  Space,
  Switch,
  Typography,
} from "antd";
import { useFormContext } from "react-hook-form";
import { useShallow } from "zustand/react/shallow";
import { useQuoteStore } from "@/store/useQuoteStore";
import { useUnits } from "@/hooks/useQuotes";
import { useQuoteDraft } from "@/lib/state/quoteDraft";
import type { FinalizeFormValues } from "@/types/quoteFinalize";

export function PostingUnitPicker() {
  const { pickupAtOrigin, hydrated } = useQuoteDraft(
    useShallow((s) => ({ pickupAtOrigin: s.pickupAtOrigin, hydrated: s._hasHydrated }))
  );
  const results = useQuoteStore((state) => state.results);
  const originCep = results?.resumo.origemCep ?? "";

  const {
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<FinalizeFormValues>();

  const ampliarBusca = watch("postingUnit.ampliarBusca");
  const incluirEstados = watch("postingUnit.incluirEstadosProximos");
  const selectedUnit = watch("postingUnit.selected");
  const definirComoPadrao = watch("postingUnit.definirComoPadrao");

  const unitsQuery = useUnits({
    cep: originCep,
    ampliarAlcance: ampliarBusca,
    estadosProximos: incluirEstados,
  });

  const unidades = unitsQuery.data ?? [];
  const unidadesDisponiveis = unidades.length;

  const handleSelect = (unitId: string) => {
    const unit = unidades.find((item) => item.id === unitId);
    setValue("postingUnit.selected", unit ?? null, { shouldDirty: true });
  };

  // Aguarde hidratação antes de renderizar
  if (!hydrated) {
    return null; // Evita flicker durante carregamento
  }

  // Se coleta na origem está ativa, não exibir bloco
  if (pickupAtOrigin) {
    return null;
  }

  return (
    <Card title="Unidade de postagem">
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="Selecione a unidade onde o envio será postado."
        />

        <Flex gap={16} wrap>
          <Switch
            checked={ampliarBusca}
            onChange={(checked) =>
              setValue("postingUnit.ampliarBusca", checked, { shouldDirty: true })
            }
          />
          <Typography.Text>Ampliar o alcance da busca no estado</Typography.Text>
        </Flex>
        <Flex gap={16} wrap>
          <Switch
            checked={incluirEstados}
            onChange={(checked) =>
              setValue("postingUnit.incluirEstadosProximos", checked, {
                shouldDirty: true,
              })
            }
          />
          <Typography.Text>Listar unidades em estados próximos</Typography.Text>
        </Flex>

        <Typography.Text type="secondary">
          {unidadesDisponiveis} unidades disponíveis
        </Typography.Text>

        {unitsQuery.isLoading ? (
          <Skeleton active />
        ) : unidadesDisponiveis > 0 ? (
          <Radio.Group
            style={{ width: "100%" }}
            value={selectedUnit?.id}
            onChange={(event) => handleSelect(event.target.value)}
          >
            <List
              dataSource={unidades}
              renderItem={(unit) => (
                <List.Item key={unit.id}>
                  <Radio value={unit.id} style={{ width: "100%" }}>
                    <Space direction="vertical" size={4}>
                      <Typography.Text strong>{unit.nome}</Typography.Text>
                      <Typography.Text type="secondary">
                        <EnvironmentOutlined style={{ marginRight: 4 }} />
                        {unit.endereco}, {unit.cidade}/{unit.uf} — CEP {unit.cep}
                      </Typography.Text>
                    </Space>
                  </Radio>
                </List.Item>
              )}
            />
          </Radio.Group>
        ) : (
          <Alert
            type="warning"
            showIcon
            message="Nenhuma unidade encontrada para os filtros selecionados."
          />
        )}

        <Flex align="center" gap={12}>
          <Switch
            checked={definirComoPadrao}
            onChange={(checked) =>
              setValue("postingUnit.definirComoPadrao", checked, {
                shouldDirty: true,
              })
            }
          />
          <Typography.Text>Definir essa unidade como padrão na calculadora</Typography.Text>
        </Flex>

        <Button
          disabled
          onClick={() => {
            /* Placeholder */
          }}
        >
          Ver mapa de unidades
        </Button>

        {errors.postingUnit?.selected ? (
          <Typography.Text type="danger">
            {(errors.postingUnit.selected as unknown as { message?: string })?.message ??
              "Selecione uma unidade de postagem."}
          </Typography.Text>
        ) : null}
      </Space>
    </Card>
  );
}

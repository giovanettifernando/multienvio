import { shipmentsMock } from "@/lib/api/data";
import type { StoredShipment, Shipment } from "@/types/shipment";
import { getCompanyDisplayName } from "@/lib/validation/utils";
import type { CompanyWizardData } from "@/lib/validation/company";

export function getShipmentStore(): Map<string, StoredShipment> {
  if (!globalThis.__envioShipments) {
    globalThis.__envioShipments = new Map<string, StoredShipment>();
  }
  return globalThis.__envioShipments;
}

/**
 * Converte um StoredShipment em um item de lista (UI).
 */
export function recordToShipmentListItem(record: StoredShipment): Shipment {
  const cidadeOrigem = `${record.sender.endereco.cidade}/${record.sender.endereco.uf}`;

  return {
    id: record.id,
    codigoRastreio: record.codigoRastreio,
    destinatario: record.destinatarioNome,
    cidadeOrigem,
    cidadeDestino: record.cidadeDestino,
    servico: record.service.name ?? record.service.serviceCode,
    status: record.status,
    atualizadoEm: record.createdAt,
    prazoEstimado: `${record.etaDays} dias`,
    valorFrete: record.price,
    servicoCodigo: record.service.serviceCode,
    pesoKg: record.package?.pesoKg,
    comprimentoCm: record.package?.comprimentoCm,
    larguraCm: record.package?.larguraCm,
    alturaCm: record.package?.alturaCm,
    remetente: getCompanyDisplayName(record.sender),
  };
}

/**
 * Insere seeds iniciais apenas quando o Map estiver vazio.
 */
export function seedInitialShipments(): void {
  const store = getShipmentStore();
  if (store.size > 0) return;

  shipmentsMock.forEach((mock, idx) => {
    const [cidadeDestino, ufDestino] = mock.cidadeDestino.split("/");

    // Exemplo PJ (primeiro)
    if (idx === 0) {
      const pjSender: CompanyWizardData = {
        tipoPessoa: "PJ",
        empresa: {
          razao: "Envio Legal LTDA",
          fantasia: "Envio Legal",
          cnpj: "00000000000000",
          ie: undefined,
          regime: "SIMPLES",
        },
        endereco: {
          cep: "01000000",
          logradouro: "Rua Central",
          numero: "100",
          complemento: undefined,
          bairro: "Centro",
          cidade: "São Paulo",
          uf: "SP",
          telefone: "11912345678",
        },
        preferencias: {
          remetente: "Envio Legal",
          emailNotificacoes: "logistica@enviolegal.com.br",
          dimPadrao: {},
          aceite: true,
        },
      };

      const rec: StoredShipment = {
        id: mock.id,
        status: mock.status,
        createdAt: new Date().toISOString(),
        sender: pjSender,
        recipient: {
          nome: mock.destinatario,
          email: undefined,
          telefone: undefined,
          cep: "20040020",
          logradouro: "Rua Exemplo",
          numero: "123",
          complemento: undefined,
          bairro: "Centro",
          cidade: cidadeDestino,
          uf: ufDestino,
        },
        package: {
          pesoKg: 1,
          comprimentoCm: 20,
          larguraCm: 15,
          alturaCm: 10,
        },
        service: {
          serviceCode: mock.servicoCodigo ?? mock.servico,
          name: mock.servico,
        },
        price: mock.valorFrete,
        etaDays: 3,
        codigoRastreio: mock.codigoRastreio,
        destinatarioNome: mock.destinatario,
        cidadeDestino: mock.cidadeDestino,
        label: null,
      };

      store.set(rec.id, rec);
      return;
    }

    // Exemplo PF (segundo em diante)
    const pfSender: CompanyWizardData = {
      tipoPessoa: "PF",
      pessoa: {
        nomeCompleto: "João da Silva",
        cpf: "12345678909", // apenas dígitos; máscara só na exibição
        rg: undefined,
      },
      endereco: {
        cep: "30140071",
        logradouro: "Av. Paraná",
        numero: "500",
        complemento: undefined,
        bairro: "Centro",
        cidade: "Belo Horizonte",
        uf: "MG",
        telefone: "31999998888",
      },
      preferencias: {
        remetente: "João da Silva",
        emailNotificacoes: "joao.silva@example.com",
        dimPadrao: {},
        aceite: true,
      },
    };

    const rec: StoredShipment = {
      id: mock.id,
      status: mock.status,
      createdAt: new Date().toISOString(),
      sender: pfSender,
      recipient: {
        nome: mock.destinatario,
        email: undefined,
        telefone: undefined,
        cep: "20040020",
        logradouro: "Rua Exemplo",
        numero: "123",
        complemento: undefined,
        bairro: "Centro",
        cidade: cidadeDestino,
        uf: ufDestino,
      },
      package: {
        pesoKg: 1.2,
        comprimentoCm: 22,
        larguraCm: 16,
        alturaCm: 12,
      },
      service: {
        serviceCode: mock.servicoCodigo ?? mock.servico,
        name: mock.servico,
      },
      price: mock.valorFrete,
      etaDays: 4,
      codigoRastreio: mock.codigoRastreio,
      destinatarioNome: mock.destinatario,
      cidadeDestino: mock.cidadeDestino,
      label: null,
    };

    store.set(rec.id, rec);
  });
}

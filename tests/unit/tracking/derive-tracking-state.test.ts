/**
 * Testes unitários para a derivadora de estado de rastreamento
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveCorreiosTrackingState,
  getEventPhase,
  TrackingPhase,
  type TrackingEventInput,
} from '@/modules/tracking/application/derive-tracking-state';
import { ShipmentStatus } from '@/modules/shipments/application/shipment-status';

describe('deriveCorreiosTrackingState', () => {
  describe('Caso Real 1: EL1766001755188OB5B0 (AN384281717BR) - Apenas etiqueta emitida', () => {
    // Payload real da API dos Correios
    const events: TrackingEventInput[] = [
      {
        dataHora: new Date('2025-12-17T20:07:20.000Z'),
        descricao: 'Etiqueta emitida',
        local: 'INTERFACE DO SISTEMA',
        uf: 'BR',
      },
    ];

    it('deve retornar status AWAITING_DROP_OFF_AT_POINT', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.strictEqual(result.currentStatus, ShipmentStatus.AWAITING_DROP_OFF_AT_POINT);
    });

    it('deve retornar fase AWAITING_DROP_OFF', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.strictEqual(result.phase, TrackingPhase.AWAITING_DROP_OFF);
    });

    it('deve preencher labelCreatedAt', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.deepStrictEqual(result.milestones.labelCreatedAt, new Date('2025-12-17T20:07:20.000Z'));
    });

    it('NÃO deve preencher postedAt', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.strictEqual(result.milestones.postedAt, null);
    });

    it('deve ter sourceEvent apontando para o evento de etiqueta', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.strictEqual(result.sourceEvent?.descricao, 'Etiqueta emitida');
    });
  });

  describe('Caso Real 2: EL17659178757118QXHB (AN378943235BR) - Sequência completa', () => {
    // Payload real da API dos Correios
    const events: TrackingEventInput[] = [
      {
        dataHora: new Date('2025-12-16T20:48:21.000Z'),
        descricao: 'Etiqueta emitida',
        local: 'INTERFACE DO SISTEMA',
        uf: 'BR',
      },
      {
        dataHora: new Date('2025-12-19T14:52:03.000Z'),
        descricao: 'Objeto postado após o horário limite da unidade',
        local: 'Agência dos Correios',
        cidade: 'JOAO PESSOA',
        uf: 'PB',
      },
      {
        dataHora: new Date('2025-12-19T18:13:27.000Z'),
        descricao: 'Objeto em transferência - por favor aguarde',
        local: 'Agência dos Correios',
        cidade: 'JOAO PESSOA',
        uf: 'PB',
      },
      {
        dataHora: new Date('2025-12-21T20:41:02.000Z'),
        descricao: 'Objeto em transferência - por favor aguarde',
        local: 'Unidade de Tratamento',
        cidade: 'RECIFE',
        uf: 'PE',
      },
    ];

    it('deve retornar status IN_TRANSFER', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.strictEqual(result.currentStatus, ShipmentStatus.IN_TRANSFER);
    });

    it('deve retornar fase IN_TRANSFER', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.strictEqual(result.phase, TrackingPhase.IN_TRANSFER);
    });

    it('deve preencher labelCreatedAt com data da etiqueta', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.deepStrictEqual(result.milestones.labelCreatedAt, new Date('2025-12-16T20:48:21.000Z'));
    });

    it('deve preencher postedAt com data da postagem', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.deepStrictEqual(result.milestones.postedAt, new Date('2025-12-19T14:52:03.000Z'));
    });

    it('deve preencher inTransitAt com data do primeiro evento de transferência', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.deepStrictEqual(result.milestones.inTransitAt, new Date('2025-12-19T18:13:27.000Z'));
    });

    it('deve ter sourceEvent apontando para o último evento de transferência', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.strictEqual(result.sourceEvent?.cidade, 'RECIFE');
    });
  });

  describe('Sequência Canônica: PO → RO → OEC → BDE', () => {
    const events: TrackingEventInput[] = [
      {
        codigo: 'PO',
        dataHora: new Date('2025-12-15T10:00:00.000Z'),
        descricao: 'Objeto postado',
        cidade: 'SAO PAULO',
        uf: 'SP',
      },
      {
        codigo: 'RO',
        dataHora: new Date('2025-12-16T08:00:00.000Z'),
        descricao: 'Objeto em trânsito - por favor aguarde',
        cidade: 'SAO PAULO',
        uf: 'SP',
      },
      {
        codigo: 'OEC',
        dataHora: new Date('2025-12-17T14:00:00.000Z'),
        descricao: 'Objeto encaminhado',
        cidade: 'CURITIBA',
        uf: 'PR',
      },
      {
        codigo: 'BDE',
        dataHora: new Date('2025-12-18T09:00:00.000Z'),
        descricao: 'Objeto saiu para entrega ao destinatário',
        cidade: 'CURITIBA',
        uf: 'PR',
      },
    ];

    it('deve progredir corretamente de PO para IN_TRANSFER', () => {
      // Apenas PO
      const result1 = deriveCorreiosTrackingState([events[0]]);
      assert.strictEqual(result1.phase, TrackingPhase.POSTED);
      assert.strictEqual(result1.currentStatus, ShipmentStatus.RECEIVED_AT_ORIGIN_HUB);

      // PO + RO
      const result2 = deriveCorreiosTrackingState([events[0], events[1]]);
      assert.strictEqual(result2.phase, TrackingPhase.IN_TRANSFER);
      assert.strictEqual(result2.currentStatus, ShipmentStatus.IN_TRANSFER);
    });

    it('deve manter IN_TRANSFER com OEC', () => {
      const result = deriveCorreiosTrackingState([events[0], events[1], events[2]]);
      assert.strictEqual(result.phase, TrackingPhase.IN_TRANSFER);
    });

    it('com todos os eventos, deve estar em OUT_FOR_DELIVERY (BDE com descrição "saiu para entrega")', () => {
      const result = deriveCorreiosTrackingState(events);
      // A descrição "Objeto saiu para entrega ao destinatário" tem prioridade sobre o código BDE
      assert.strictEqual(result.phase, TrackingPhase.OUT_FOR_DELIVERY);
    });

    it('deve preencher todos os milestones corretamente', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.deepStrictEqual(result.milestones.postedAt, new Date('2025-12-15T10:00:00.000Z'));
      assert.deepStrictEqual(result.milestones.inTransitAt, new Date('2025-12-16T08:00:00.000Z'));
    });
  });

  describe('Sequência com entrega', () => {
    const events: TrackingEventInput[] = [
      {
        codigo: 'PO',
        dataHora: new Date('2025-12-15T10:00:00.000Z'),
        descricao: 'Objeto postado',
        cidade: 'SAO PAULO',
        uf: 'SP',
      },
      {
        codigo: 'RO',
        dataHora: new Date('2025-12-16T08:00:00.000Z'),
        descricao: 'Objeto em trânsito',
        cidade: 'SAO PAULO',
        uf: 'SP',
      },
      {
        codigo: 'LDI',
        dataHora: new Date('2025-12-17T08:00:00.000Z'),
        descricao: 'Objeto saiu para entrega ao destinatário',
        cidade: 'CURITIBA',
        uf: 'PR',
      },
      {
        codigo: 'BDI',
        dataHora: new Date('2025-12-17T14:30:00.000Z'),
        descricao: 'Objeto entregue ao destinatário',
        cidade: 'CURITIBA',
        uf: 'PR',
      },
    ];

    it('deve retornar DELIVERED quando há evento de entrega', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.strictEqual(result.currentStatus, ShipmentStatus.DELIVERED);
      assert.strictEqual(result.phase, TrackingPhase.DELIVERED);
    });

    it('deve preencher deliveredAt', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.deepStrictEqual(result.milestones.deliveredAt, new Date('2025-12-17T14:30:00.000Z'));
    });

    it('deve preencher outForDeliveryAt', () => {
      const result = deriveCorreiosTrackingState(events);
      assert.deepStrictEqual(result.milestones.outForDeliveryAt, new Date('2025-12-17T08:00:00.000Z'));
    });

    it('DELIVERED é terminal - eventos posteriores não mudam o status', () => {
      // Simular evento "fantasma" após entrega
      const eventsWithExtra = [
        ...events,
        {
          codigo: 'RO',
          dataHora: new Date('2025-12-18T10:00:00.000Z'),
          descricao: 'Objeto em trânsito (evento errado)',
          cidade: 'CURITIBA',
          uf: 'PR',
        },
      ];
      const result = deriveCorreiosTrackingState(eventsWithExtra);
      assert.strictEqual(result.phase, TrackingPhase.DELIVERED);
    });
  });

  describe('Eventos fora de ordem cronológica', () => {
    it('deve ordenar eventos por data antes de processar', () => {
      // Eventos em ordem invertida
      const events: TrackingEventInput[] = [
        {
          dataHora: new Date('2025-12-19T14:52:03.000Z'),
          descricao: 'Objeto postado',
          cidade: 'JOAO PESSOA',
          uf: 'PB',
        },
        {
          dataHora: new Date('2025-12-16T20:48:21.000Z'),
          descricao: 'Etiqueta emitida',
          local: 'INTERFACE DO SISTEMA',
          uf: 'BR',
        },
      ];

      const result = deriveCorreiosTrackingState(events);
      // Deve ter labelCreatedAt correto (o mais antigo)
      assert.deepStrictEqual(result.milestones.labelCreatedAt, new Date('2025-12-16T20:48:21.000Z'));
      // Deve ter postedAt correto (o mais recente)
      assert.deepStrictEqual(result.milestones.postedAt, new Date('2025-12-19T14:52:03.000Z'));
      // Status final deve ser POSTED (mais forte que AWAITING_DROP_OFF)
      assert.strictEqual(result.phase, TrackingPhase.POSTED);
    });
  });

  describe('Lista vazia de eventos', () => {
    it('deve retornar AWAITING_DROP_OFF para lista vazia', () => {
      const result = deriveCorreiosTrackingState([]);
      assert.strictEqual(result.phase, TrackingPhase.AWAITING_DROP_OFF);
      assert.strictEqual(result.currentStatus, ShipmentStatus.AWAITING_DROP_OFF_AT_POINT);
    });

    it('deve ter todos os milestones como null', () => {
      const result = deriveCorreiosTrackingState([]);
      assert.strictEqual(result.milestones.labelCreatedAt, null);
      assert.strictEqual(result.milestones.postedAt, null);
      assert.strictEqual(result.milestones.inTransitAt, null);
      assert.strictEqual(result.milestones.outForDeliveryAt, null);
      assert.strictEqual(result.milestones.deliveredAt, null);
    });
  });

  describe('Eventos desconhecidos', () => {
    it('deve registrar eventos com código/descrição não mapeados', () => {
      const events: TrackingEventInput[] = [
        {
          codigo: 'XXX',
          dataHora: new Date('2025-12-17T10:00:00.000Z'),
          descricao: 'Evento muito estranho nunca visto',
        },
      ];

      const result = deriveCorreiosTrackingState(events);
      assert.strictEqual(result.unknownEvents.length, 1);
      assert.strictEqual(result.unknownEvents[0].codigo, 'XXX');
      assert.strictEqual(result.unknownEvents[0].descricao, 'Evento muito estranho nunca visto');
    });
  });
});

describe('getEventPhase', () => {
  describe('Prioridade de descrição sobre código', () => {
    it('"Etiqueta emitida" retorna AWAITING_DROP_OFF independente do código', () => {
      // Mesmo com código DO (que normalmente seria IN_TRANSFER)
      const event: TrackingEventInput = {
        codigo: 'DO',
        dataHora: new Date(),
        descricao: 'Etiqueta emitida',
      };
      assert.strictEqual(getEventPhase(event), TrackingPhase.AWAITING_DROP_OFF);
    });

    it('"Objeto postado" retorna POSTED independente do código', () => {
      const event: TrackingEventInput = {
        codigo: 'RO', // Código de trânsito
        dataHora: new Date(),
        descricao: 'Objeto postado após o horário limite da unidade',
      };
      assert.strictEqual(getEventPhase(event), TrackingPhase.POSTED);
    });
  });

  describe('Mapeamento por código quando descrição não é específica', () => {
    it('código PO retorna POSTED', () => {
      const event: TrackingEventInput = {
        codigo: 'PO',
        dataHora: new Date(),
        descricao: 'Descrição genérica',
      };
      assert.strictEqual(getEventPhase(event), TrackingPhase.POSTED);
    });

    it('código RO retorna IN_TRANSFER', () => {
      const event: TrackingEventInput = {
        codigo: 'RO',
        dataHora: new Date(),
        descricao: 'Descrição genérica',
      };
      assert.strictEqual(getEventPhase(event), TrackingPhase.IN_TRANSFER);
    });

    it('código LDI retorna OUT_FOR_DELIVERY', () => {
      const event: TrackingEventInput = {
        codigo: 'LDI',
        dataHora: new Date(),
        descricao: 'Descrição genérica',
      };
      assert.strictEqual(getEventPhase(event), TrackingPhase.OUT_FOR_DELIVERY);
    });

    it('código BDI retorna DELIVERED', () => {
      const event: TrackingEventInput = {
        codigo: 'BDI',
        dataHora: new Date(),
        descricao: 'Descrição genérica',
      };
      assert.strictEqual(getEventPhase(event), TrackingPhase.DELIVERED);
    });
  });

  describe('Fallback por descrição', () => {
    it('"Objeto em transferência" retorna IN_TRANSFER', () => {
      const event: TrackingEventInput = {
        dataHora: new Date(),
        descricao: 'Objeto em transferência - por favor aguarde',
      };
      assert.strictEqual(getEventPhase(event), TrackingPhase.IN_TRANSFER);
    });

    it('"Saiu para entrega" retorna OUT_FOR_DELIVERY', () => {
      const event: TrackingEventInput = {
        dataHora: new Date(),
        descricao: 'Objeto saiu para entrega ao destinatário',
      };
      assert.strictEqual(getEventPhase(event), TrackingPhase.OUT_FOR_DELIVERY);
    });

    it('"Objeto entregue" retorna DELIVERED', () => {
      const event: TrackingEventInput = {
        dataHora: new Date(),
        descricao: 'Objeto entregue ao destinatário',
      };
      assert.strictEqual(getEventPhase(event), TrackingPhase.DELIVERED);
    });
  });
});

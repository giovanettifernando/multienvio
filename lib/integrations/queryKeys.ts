export const integrationKeys = {
  all: ['integrations'] as const,
  carriers: () => [...integrationKeys.all, 'carriers'] as const,
  carrier: (id: string) => [...integrationKeys.carriers(), id] as const,
  apis: (carrierId?: string) =>
    carrierId
      ? ([...integrationKeys.all, 'apis', carrierId] as const)
      : ([...integrationKeys.all, 'apis'] as const),
  api: (id: string) => [...integrationKeys.all, 'apis', id] as const,
  auth: (carrierId: string) => [...integrationKeys.all, 'auth', carrierId] as const,
  paymentGateway: () => [...integrationKeys.all, 'paymentGateway'] as const,
  health: () => [...integrationKeys.all, 'health'] as const,
  healthByCarrier: (carrierId: string) => [...integrationKeys.health(), carrierId] as const,
};

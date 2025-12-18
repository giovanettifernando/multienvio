export type DashboardHighlights = {
  enviosMes: number;
  economiaMedia: number;
  satisfacaoClientes: number;
  coletasAgendadas: number;
};

export type DashboardActivityTipo =
  | "etiqueta"
  | "entrega"
  | "coleta"
  | "alerta";

export type DashboardActivity = {
  id: string;
  descricao: string;
  data: string;
  tipo: DashboardActivityTipo;
};

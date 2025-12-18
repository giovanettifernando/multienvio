/**
 * Utilitários de data para o sistema
 * Padroniza o uso de timezone UTC-3 (Brasília) para relatórios financeiros
 */

import dayjs from 'dayjs';

/** Offset de Brasília em minutos (UTC-3) */
const BRASILIA_OFFSET_MINUTES = -180;

// ============================================================================
// Helpers de formatação para UI
// ============================================================================

/**
 * Formata uma data para exibição no padrão brasileiro (DD/MM/YYYY)
 * @param date - Data em formato ISO string, Date ou null/undefined
 * @returns String formatada ou "-" para valores nulos
 * @example formatDateBR("2024-01-15T10:30:00Z") // "15/01/2024"
 */
export function formatDateBR(date: Date | string | null | undefined): string {
  if (!date) return '-';
  return dayjs(date).format('DD/MM/YYYY');
}

/**
 * Formata uma data com hora para exibição no padrão brasileiro (DD/MM/YYYY HH:mm)
 * @param date - Data em formato ISO string, Date ou null/undefined
 * @returns String formatada ou "-" para valores nulos
 * @example formatDateTimeBR("2024-01-15T10:30:00Z") // "15/01/2024 10:30"
 */
export function formatDateTimeBR(date: Date | string | null | undefined): string {
  if (!date) return '-';
  return dayjs(date).format('DD/MM/YYYY HH:mm');
}

/**
 * Formata uma data de forma curta (DD/MM/YY)
 * @param date - Data em formato ISO string, Date ou null/undefined
 * @returns String formatada ou "—" para valores nulos
 * @example formatDateShortBR("2024-01-15") // "15/01/24"
 */
export function formatDateShortBR(date: Date | string | null | undefined): string {
  if (!date) return '—';
  return dayjs(date).format('DD/MM/YY');
}

/**
 * Ajusta uma data para o início do dia em UTC-3 (Brasília)
 * Usado para filtros de data em relatórios financeiros
 */
export function startOfDayBrasilia(dateString: string): Date {
  const date = new Date(dateString);
  // Ajustar para início do dia em UTC-3
  // Se dateString é "2024-01-15", queremos 2024-01-15 00:00:00 em Brasília
  // que é 2024-01-15 03:00:00 em UTC
  date.setUTCHours(3, 0, 0, 0); // 00:00 BRT = 03:00 UTC
  return date;
}

/**
 * Ajusta uma data para o fim do dia em UTC-3 (Brasília)
 * Usado para filtros de data em relatórios financeiros
 */
export function endOfDayBrasilia(dateString: string): Date {
  const date = new Date(dateString);
  // Ajustar para fim do dia em UTC-3
  // Se dateString é "2024-01-15", queremos 2024-01-15 23:59:59.999 em Brasília
  // que é 2024-01-16 02:59:59.999 em UTC
  date.setUTCHours(26, 59, 59, 999); // 23:59:59.999 BRT = 02:59:59.999+1 UTC
  return date;
}

/**
 * Retorna o mês da data em UTC-3 (Brasília)
 * @returns Mês 1-12
 */
export function getMonthBrasilia(date: Date): number {
  // Ajustar pelo offset de Brasília
  const brasiliaDate = new Date(date.getTime() + BRASILIA_OFFSET_MINUTES * 60 * 1000);
  return brasiliaDate.getUTCMonth() + 1;
}

/**
 * Retorna o ano da data em UTC-3 (Brasília)
 */
export function getYearBrasilia(date: Date): number {
  const brasiliaDate = new Date(date.getTime() + BRASILIA_OFFSET_MINUTES * 60 * 1000);
  return brasiliaDate.getUTCFullYear();
}

/**
 * Converte uma data para ISO string em UTC-3
 */
export function toISOBrasilia(date: Date): string {
  const brasiliaDate = new Date(date.getTime() - BRASILIA_OFFSET_MINUTES * 60 * 1000);
  return brasiliaDate.toISOString().replace('Z', '-03:00');
}

/**
 * Parse de parâmetros de data para filtros de período
 * Retorna datas ajustadas para UTC-3
 */
export function parseDateRangeParams(
  dateStart: string | null,
  dateEnd: string | null
): { startDate: Date; endDate: Date } | null {
  if (!dateStart && !dateEnd) return null;

  return {
    startDate: dateStart ? startOfDayBrasilia(dateStart) : new Date(0),
    endDate: dateEnd ? endOfDayBrasilia(dateEnd) : new Date(),
  };
}

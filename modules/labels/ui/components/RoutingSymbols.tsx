/**
 * Símbolos de encaminhamento Correios
 * SVG vetorial para garantir qualidade de impressão
 */

import type { RoutingSymbol } from '@/shared/types/correios-label';

interface RoutingSymbolProps {
  type: RoutingSymbol;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Símbolo SEDEX (vermelho)
 * Usado para SEDEX padrão
 */
function SedexSymbol({ width = 60, height = 20, className }: Omit<RoutingSymbolProps, "type">) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 40"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="120" height="40" fill="#E30613" rx="4" />
      <text
        x="60"
        y="28"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fontSize="22"
      >
        SEDEX
      </text>
    </svg>
  );
}

/**
 * Símbolo PAC (azul)
 */
function PacSymbol({ width = 60, height = 20, className }: Omit<RoutingSymbolProps, "type">) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 40"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="120" height="40" fill="#004B87" rx="4" />
      <text
        x="60"
        y="28"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fontSize="22"
      >
        PAC
      </text>
    </svg>
  );
}

/**
 * Símbolo SEDEX Hoje
 */
function SedexHojeSymbol({ width = 70, height = 20, className }: Omit<RoutingSymbolProps, "type">) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 140 40"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="140" height="40" fill="#E30613" rx="4" />
      <text
        x="70"
        y="18"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fontSize="14"
      >
        SEDEX
      </text>
      <text
        x="70"
        y="34"
        textAnchor="middle"
        fill="#FFD100"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fontSize="14"
      >
        HOJE
      </text>
    </svg>
  );
}

/**
 * Símbolo SEDEX 10
 */
function Sedex10Symbol({ width = 70, height = 20, className }: Omit<RoutingSymbolProps, "type">) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 140 40"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="140" height="40" fill="#E30613" rx="4" />
      <text
        x="70"
        y="18"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fontSize="14"
      >
        SEDEX
      </text>
      <text
        x="70"
        y="34"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fontSize="14"
      >
        10
      </text>
    </svg>
  );
}

/**
 * Símbolo SEDEX 12
 */
function Sedex12Symbol({ width = 70, height = 20, className }: Omit<RoutingSymbolProps, "type">) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 140 40"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="140" height="40" fill="#E30613" rx="4" />
      <text
        x="70"
        y="18"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fontSize="14"
      >
        SEDEX
      </text>
      <text
        x="70"
        y="34"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fontSize="14"
      >
        12
      </text>
    </svg>
  );
}

/**
 * Símbolo Mini Envios (amarelo)
 */
function MiniEnviosSymbol({ width = 70, height = 20, className }: Omit<RoutingSymbolProps, "type">) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 140 40"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="140" height="40" fill="#FFD100" rx="4" />
      <text
        x="70"
        y="18"
        textAnchor="middle"
        fill="#000000"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fontSize="12"
      >
        MINI
      </text>
      <text
        x="70"
        y="34"
        textAnchor="middle"
        fill="#000000"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fontSize="12"
      >
        ENVIOS
      </text>
    </svg>
  );
}

/**
 * Símbolo genérico (cinza)
 * Usado como fallback
 */
function GenericSymbol({ width = 60, height = 20, className }: Omit<RoutingSymbolProps, "type">) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 40"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="120" height="40" fill="#666666" rx="4" />
      <text
        x="60"
        y="28"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fontSize="16"
      >
        CORREIOS
      </text>
    </svg>
  );
}

/**
 * Componente principal que renderiza o símbolo correto baseado no tipo
 */
export function RoutingSymbolIcon({ type, width, height, className }: RoutingSymbolProps) {
  const props = { width, height, className };

  switch (type) {
    case "SEDEX":
      return <SedexSymbol {...props} />;
    case "PAC":
      return <PacSymbol {...props} />;
    case "SEDEX_HOJE":
      return <SedexHojeSymbol {...props} />;
    case "SEDEX_10":
      return <Sedex10Symbol {...props} />;
    case "SEDEX_12":
      return <Sedex12Symbol {...props} />;
    case "MINI_ENVIOS":
      return <MiniEnviosSymbol {...props} />;
    case "GENERIC":
    default:
      return <GenericSymbol {...props} />;
  }
}

export { SedexSymbol, PacSymbol, SedexHojeSymbol, Sedex10Symbol, Sedex12Symbol, MiniEnviosSymbol, GenericSymbol };

"use client";

import dynamic from "next/dynamic";
import type { GeoCoordinates } from "@/shared/utils/geo";
import type { Marker } from "./LeafletMapInner";

interface UnitsMapProps {
  originCenter: GeoCoordinates;
  markers: Marker[];
  selectedPointId?: string;
  onPointClick?: (pointId: string) => void;
  open?: boolean;
}

// Dynamic import with SSR disabled to prevent Leaflet errors
const LeafletMap = dynamic(() => import("./LeafletMapInner"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f0f0",
        borderRadius: 8,
      }}
    >
      <span style={{ color: "#8c8c8c" }}>Carregando mapa...</span>
    </div>
  ),
});

export default function UnitsMap(props: UnitsMapProps) {
  return <LeafletMap {...props} />;
}

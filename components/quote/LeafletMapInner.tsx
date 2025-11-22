"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoCoordinates } from "@/lib/utils/geo";

// Marker type normalizado
export type Marker = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

interface LeafletMapInnerProps {
  originCenter: GeoCoordinates;
  markers: Marker[];
  selectedPointId?: string;
  onPointClick?: (pointId: string) => void;
  open?: boolean;
}

// Fix default marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export default function LeafletMapInner({
  originCenter,
  markers,
  selectedPointId,
  onPointClick,
  open,
}: LeafletMapInnerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [originCenter.lat, originCenter.lng],
      zoom: 8,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // Add OpenStreetMap tiles (HTTPS)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      crossOrigin: true,
    }).addTo(map);

    mapRef.current = map;

    // Invalidate size after initialization
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [originCenter.lat, originCenter.lng]);

  // Invalidate size when modal opens
  useEffect(() => {
    if (!mapRef.current || !open) return;
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 50);
  }, [open]);

  // Add/update markers (Leaflet order: [lat, lng])
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing layers
    layerRef.current?.clearLayers();

    const group = L.layerGroup();

    // Add origin marker (blue circle)
    const originMarker = L.circleMarker([originCenter.lat, originCenter.lng], {
      radius: 8,
      fillColor: "#40a9ff",
      fillOpacity: 0.8,
      color: "#1890ff",
      weight: 2,
    });
    originMarker.bindPopup("<b>Origem</b>");
    originMarker.addTo(group);

    // Add pickup point markers
    markers.forEach((m) => {
      const isSelected = m.id === selectedPointId;

      // Custom icon for selected marker
      const icon = isSelected
        ? L.divIcon({
            html: '<div style="background-color: #1890ff; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            className: "",
          })
        : L.icon({
            iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
            iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
            shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41],
          });

      const marker = L.marker([m.lat, m.lng], { icon });

      // Popup content
      const popupContent = `
        <div style="min-width: 150px;">
          <b>${m.name}</b><br/>
          <button
            onclick="window.selectPickupPoint('${m.id}')"
            style="margin-top: 8px; padding: 4px 12px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;"
          >
            Selecionar
          </button>
        </div>
      `;
      marker.bindPopup(popupContent);

      // Click handler
      marker.on("click", () => {
        onPointClick?.(m.id);
      });

      marker.addTo(group);
    });

    group.addTo(map);
    layerRef.current = group;

    // Fit bounds to show all markers INCLUDING origin
    if (markers.length > 0) {
      // Incluir TODOS os pontos: origem + todos os markers
      const allPoints: [number, number][] = [
        [originCenter.lat, originCenter.lng], // Origem
        ...markers.map((m) => [m.lat, m.lng] as [number, number]), // Pontos de coleta
      ];

      const bounds = L.latLngBounds(allPoints);

      // Ajustar padding baseado na quantidade de pontos
      const padding: [number, number] = markers.length === 1 ? [50, 50] : [30, 30];

      map.fitBounds(bounds, {
        padding,
        maxZoom: markers.length === 1 ? 13 : undefined, // Limitar zoom se for só 1 ponto
      });
    } else if (originCenter) {
      // Fallback: sem pontos de coleta, mostrar apenas origem
      map.setView([originCenter.lat, originCenter.lng], 12);
    }
  }, [markers, selectedPointId, originCenter, onPointClick]);

  // Center map on selected point when it changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPointId) return;

    // Find the selected marker
    const selectedMarker = markers.find((m) => m.id === selectedPointId);
    if (selectedMarker) {
      // Animate to the selected point with appropriate zoom
      map.setView([selectedMarker.lat, selectedMarker.lng], 13, {
        animate: true,
        duration: 0.5,
      });
    }
  }, [selectedPointId, markers]);

  // Global function for popup button
  useEffect(() => {
    (window as Window & { selectPickupPoint?: (pointId: string) => void }).selectPickupPoint = (pointId: string) => {
      onPointClick?.(pointId);
    };
    return () => {
      delete (window as Window & { selectPickupPoint?: (pointId: string) => void }).selectPickupPoint;
    };
  }, [onPointClick]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 8,
        overflow: "hidden",
      }}
    />
  );
}

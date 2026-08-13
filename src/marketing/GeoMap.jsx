import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Brand map — muted Carto tiles on the paper palette, terracotta pins.
 * markers: [{ lat, lng, label?, count?, active?, onClick? }]
 */
export default function GeoMap({ markers = [], height = 260, zoom = 5, className = "" }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    const map = L.map(ref.current, {
      scrollWheelZoom: false,
      zoomControl: true,
      attributionControl: true,
    });
    map.attributionControl.setPrefix(false);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap · © CARTO",
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
    map.setView([31.7917, -7.0926], zoom);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!markers.length) return;

    markers.forEach((m) => {
      const isDot = m.count == null;
      const icon = L.divIcon({
        className: "mk-geopin-wrap",
        html: isDot
          ? `<span class="mk-geopin mk-geopin--dot${m.active ? " is-active" : ""}"></span>`
          : `<span class="mk-geopin${m.active ? " is-active" : ""}">${m.count}</span>`,
        iconSize: isDot ? [18, 18] : [34, 34],
        iconAnchor: isDot ? [9, 9] : [17, 17],
      });
      const marker = L.marker([m.lat, m.lng], { icon, title: m.label || "" }).addTo(layer);
      if (m.onClick) marker.on("click", m.onClick);
    });

    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], zoom, { animate: false });
    } else {
      map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng])), {
        padding: [34, 34],
        maxZoom: 6,
        animate: false,
      });
    }
  }, [markers, zoom]);

  return <div ref={ref} className={`mk-geomap ${className}`} style={{ height }} aria-hidden="true" />;
}

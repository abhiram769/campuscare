import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const CAMPUS_CENTER = [75.9344, 11.3217];

export default function CampusMap({ complaints = [], interactive = false, selectedLocation, onLocationSelect, compact = false }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: selectedLocation?.longitude && selectedLocation?.latitude
        ? [Number(selectedLocation.longitude), Number(selectedLocation.latitude)]
        : CAMPUS_CENTER,
      zoom: compact ? 15 : 15.5,
      pitch: 52,
      bearing: -12,
      antialias: true,
      attributionControl: true
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.on("load", () => {
      setReady(true);
      try {
        const style = map.getStyle();
        const sourceId = style.sources?.openmaptiles ? "openmaptiles" : Object.keys(style.sources || {}).find((key) => style.sources[key].type === "vector");
        if (sourceId && !map.getLayer("campus-care-3d-buildings")) {
          map.addLayer({
            id: "campus-care-3d-buildings",
            source: sourceId,
            "source-layer": "building",
            type: "fill-extrusion",
            minzoom: 14,
            filter: ["all", ["!=", ["get", "hide_3d"], true], ["has", "render_height"]],
            paint: {
              "fill-extrusion-color": ["interpolate", ["linear"], ["get", "render_height"], 0, "#dce9df", 30, "#83ad91", 100, "#4c8060"],
              "fill-extrusion-height": ["coalesce", ["get", "render_height"], 8],
              "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
              "fill-extrusion-opacity": 0.86
            }
          });
        }
      } catch (error) {
        console.warn("3D building layer could not be added:", error);
      }
    });
    map.on("error", (event) => {
      if (event?.error) setMapError("Map tiles are taking longer than expected. Check your internet connection.");
    });
    if (interactive && onLocationSelect) {
      map.on("click", (event) => onLocationSelect({
        latitude: event.lngLat.lat.toFixed(6),
        longitude: event.lngLat.lng.toFixed(6)
      }));
    }
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    const validComplaints = complaints.filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
    validComplaints.forEach((item) => {
      const element = document.createElement("div");
      element.className = "campus-map-marker";
      element.setAttribute("aria-label", item.title || "Campus complaint");
      const popup = new maplibregl.Popup({ offset: 18, closeButton: true }).setText(
        [item.title || "Campus complaint", item.location || "", String(item.status || "").replaceAll("_", " ")].filter(Boolean).join(" · ")
      );
      const marker = new maplibregl.Marker({ element, color: "#176b45" })
        .setLngLat([Number(item.longitude), Number(item.latitude)])
        .setPopup(popup)
        .addTo(map);
      markersRef.current.push(marker);
    });
    if (selectedLocation?.latitude && selectedLocation?.longitude) {
      const selected = new maplibregl.Marker({ color: "#d97706" })
        .setLngLat([Number(selectedLocation.longitude), Number(selectedLocation.latitude)])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setText("Selected complaint location"))
        .addTo(map);
      markersRef.current.push(selected);
      if (interactive) map.flyTo({ center: [Number(selectedLocation.longitude), Number(selectedLocation.latitude)], zoom: 17 });
    }
  }, [complaints, ready, selectedLocation, interactive]);

  return (
    <div className={`campus-map-frame ${compact ? "campus-map-compact" : ""}`}>
      <div ref={containerRef} className="campus-map-canvas" />
      {!ready && <div className="campus-map-loading">Loading interactive 3D campus map…</div>}
      {mapError && <div className="campus-map-error">{mapError}</div>}
      <div className="campus-map-legend"><span><i className="legend-dot complaint-dot" /> Your reports</span>{interactive && <span><i className="legend-dot selected-dot" /> Selected location</span>}</div>
    </div>
  );
}

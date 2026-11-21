// Dashboard Map Module
// Extracted from dashboard.html for separation of concerns

import L from "/js/lib/leaflet.mjs";
import { api } from "/js/api.js";
import { ui } from "/js/ui.js";

let map = null;
let mapMarkers = [];
let refreshMapLock = false;
let focusBoatCallback = null;

/**
 * Initialize the vessel tracking map
 * @param {Object} options - Configuration options
 * @param {string} options.mapElementId - ID of the map container element (default: 'vesselMap')
 * @param {Function} options.onMapClick - Callback when a vessel list item is clicked
 * @returns {Object} Map controller with refresh and focus methods
 */
export function initDashboardMap({ mapElementId = "vesselMap", onMapClick } = {}) {
  const mapEl = document.getElementById(mapElementId);
  if (!mapEl) {
    console.warn(`Map element #${mapElementId} not found`);
    return null;
  }

  // Initialize Leaflet map
  map = L.map(mapElementId).setView([14.4445, 121.1911], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(map);

  // Store focus callback for vessel list clicks
  focusBoatCallback = onMapClick || ((lat, lng) => {
    if (map) map.setView([lat, lng], 14);
  });

  return {
    map,
    refresh: refreshMap,
    focusBoat: focusBoatCallback,
  };
}

/**
 * Refresh map markers and vessel list
 * @param {Object} options - Optional configuration
 * @param {HTMLElement} options.listContainer - Vessel list container element
 */
export async function refreshMap({ listContainer } = {}) {
  if (!map || refreshMapLock) return;
  refreshMapLock = true;

  try {
    // Clear existing markers
    mapMarkers.forEach((m) => map.removeLayer(m));
    mapMarkers = [];

    const [terminals, boats, gpsLogs] = await Promise.all([
      api.terminals.list(),
      api.boats.list(),
      api.gpsLogs.list(),
    ]);

    const container = listContainer || document.getElementById("vesselListContainer");
    let htmlList = '<ul style="display: flex; flex-direction: column; gap: 0.75rem;">';

    // Add terminal markers
    terminals.forEach((term) => {
      const lat = Number(term.lat);
      const lng = Number(term.lng);
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
      const markerLat = hasCoords ? lat : 14.4645;
      const markerLng = hasCoords ? lng : 121.1918;

      const marker = L.marker([markerLat, markerLng], {
        icon: L.divIcon({
          className: "terminal-marker",
          html: '<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:#0d1b2a;color:#ffffff;border:2px solid #0077b6;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.3);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6"/></svg></div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        }),
      })
        .addTo(map)
        .bindPopup(
          `<strong>${ui.escapeHtml(term.name)}</strong><br>Location: ${ui.escapeHtml(term.location)}<br>Coast Guard: ${ui.escapeHtml(term.coast_guard_personnel)}`,
        );
      mapMarkers.push(marker);

      htmlList += `<li style="background:white; padding:0.5rem; border-radius:4px; border:1px solid var(--border); font-size:0.85rem;">
        <strong>Terminal: ${ui.escapeHtml(term.name)}</strong><br><span style="color:var(--text-muted);">PCG: ${ui.escapeHtml(term.coast_guard_personnel)}</span>
      </li>`;
    });

    // Add boat markers
    boats.forEach((boat) => {
      if (
        boat.registration_status !== "Verified" ||
        boat.boat_status !== "Active"
      )
        return;

      const boatLogs = gpsLogs.filter((l) => l.boat_id === boat.id);
      const lastLog = boatLogs.length > 0 ? boatLogs[boatLogs.length - 1] : null;

      if (!lastLog) {
        htmlList += `<li style="background:white; padding:0.5rem; border-radius:4px; border:1px solid var(--border); font-size:0.85rem;">
          <strong>Vessel: ${ui.escapeHtml(boat.name)}</strong><br><span style="color:var(--text-muted);">No GPS data</span>
        </li>`;
        return;
      }

      const marker = L.marker([lastLog.lat, lastLog.lng], {
        icon: L.divIcon({
          className: "boat-marker",
          html: '<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;background:#2a9d8f;color:#ffffff;border:2px solid #ffffff;border-radius:50%;box-shadow:0 2px 5px rgba(0,0,0,0.3);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.3.6 4.5 1.62 6"/><path d="M12 10V4l3 2-3 2"/></svg></div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        }),
      })
        .addTo(map)
        .bindPopup(
          `<strong>Vessel: ${ui.escapeHtml(boat.name)}</strong><br>Type: ${ui.escapeHtml(boat.boat_type)}<br>Max Load: ${ui.escapeHtml(boat.max_load_kg)} kg`,
        );
      mapMarkers.push(marker);

      htmlList += `<li style="background:white; padding:0.5rem; border-radius:4px; border:1px solid var(--border); font-size:0.85rem; cursor:pointer;" data-action="focus" data-lat="${lastLog.lat}" data-lng="${lastLog.lng}">
        <strong>Vessel: ${ui.escapeHtml(boat.name)}</strong><br><span style="color:var(--success);">Active</span> (${ui.escapeHtml(boat.boat_type)})
      </li>`;
    });

    htmlList += "</ul>";
    if (container) container.innerHTML = htmlList;

    // Attach click handler for vessel list items
    if (container) {
      container.onclick = (e) => {
        const item = e.target.closest('[data-action="focus"]');
        if (item && focusBoatCallback) {
          focusBoatCallback(Number(item.dataset.lat), Number(item.dataset.lng));
        }
      };
    }
  } finally {
    refreshMapLock = false;
  }
}

/**
 * Simulate GPS movement for active trips
 * @returns {Promise<number>} Number of active trips simulated
 */
export async function simulateGpsMovement() {
  const trips = await api.trips.list();
  const activeTrips = trips.filter((t) => t.trip_status === "In Progress");
  if (activeTrips.length === 0) return 0;

  await api.gpsLogs.simulateMovement();
  return activeTrips.length;
}
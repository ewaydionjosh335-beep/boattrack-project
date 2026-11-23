// js/utils/sosBadge.js
// Shared utility for SOS alert badge across admin pages.

import { api } from '/js/api.js';

const CACHE_KEY = 'sosBadgeCache';
const CACHE_TTL_MS = 30000; // 30 seconds

function getCachedBadge() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { count, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return count;
  } catch {
    return null;
  }
}

function setCachedBadge(count) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ count, ts: Date.now() }));
  } catch {}
}

export async function refreshSosBadge(badgeElementId = 'sosBadge', force = false) {
  const badge = document.getElementById(badgeElementId);
  if (!badge) return 0;

  function updateBadge(count) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline' : 'none';
    badge.setAttribute('aria-hidden', 'true');
    // The badge sits inside the link, so expose the count on the link instead.
    const link = badge.closest('a');
    if (link) {
      link.setAttribute('aria-label', count > 0 ? `SOS Alerts, ${count} open` : 'SOS Alerts');
    }
  }

  if (!force) {
    const cached = getCachedBadge();
    if (cached !== null) {
      updateBadge(cached);
      return cached;
    }
  }

  const alerts = await api.alerts.list();
  const openAlerts = alerts.filter(a => a.status === 'Open');

  updateBadge(openAlerts.length);
  setCachedBadge(openAlerts.length);
  return openAlerts.length;
}
// Admin Shared Initialization Module
// Eliminates duplicate boilerplate across all 10 admin pages

import { seedDatabase } from "/js/seed.js";
import { auth } from "/js/auth.js";
import { AdminSidebar } from "/admin/_sidebar.js";
import { refreshSosBadge } from "/js/utils/sosBadge.js";

/**
 * Initialize an admin page with shared boilerplate
 * @param {Object} options - Configuration options
 * @param {string} options.activePage - The active page identifier for sidebar highlighting
 * @param {Function} [options.onReady] - Optional callback after initialization completes, receives session
 * @returns {Promise<Object>} The authenticated session
 */
export async function initAdminPage({ activePage, onReady }) {
  // Seed database
  await seedDatabase();

  // Require admin authentication
  const session = await auth.requireAuth(["administrator"]);
  if (!session) {
    throw new Error("Unauthorized");
  }

  // Mount shared sidebar
  AdminSidebar.mount({
    activePage,
    userName: session.full_name || "Administrator",
  });

  // Refresh SOS badge
  await refreshSosBadge();

  // Call optional ready callback
  if (onReady) {
    await onReady(session);
  }

  return session;
}
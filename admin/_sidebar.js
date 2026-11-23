// AdminSidebar component - renders the shared sidebar and handles active state.
// The markup lives here instead of a fetched .html fragment because live-server
// injects its reload script into any served HTML, which corrupted the sidebar.
import { adminLogout } from "/admin/common.js";

const icon = (name) =>
  `<svg aria-hidden="true"><use href="/assets/icons.svg#i-${name}"></use></svg>`;

const SIDEBAR_HTML = `
<aside class="admin-sidebar">
  <div class="sidebar-header">
    <span class="sidebar-brand">
      <svg class="sidebar-logo" aria-hidden="true"><use href="/assets/icons.svg#i-boat"></use></svg>
      <span id="sidebarUserName"></span>
    </span>
  </div>
  <nav class="sidebar-menu" aria-label="Admin">
    <a href="/admin/dashboard.html" data-page="dashboard">${icon("dashboard")} Dashboard</a>
    <a href="/admin/accounts.html" data-page="accounts">${icon("users")} Accounts</a>
    <a href="/admin/boat-verification.html" data-page="boat-verification">${icon("boat-check")} Boat Verification</a>
    <a href="/admin/crew-verification.html" data-page="crew-verification">${icon("users")} Crew Verification</a>
    <a href="/admin/routes-fares.html" data-page="routes-fares">${icon("routes")} Routes &amp; Fares</a>
    <a href="/admin/terminals.html" data-page="terminals">${icon("terminals")} Terminals</a>
    <a href="/admin/manifests.html" data-page="manifests">${icon("manifests")} Manifests</a>
    <a href="/admin/bookings.html" data-page="bookings">${icon("bookings")} Bookings</a>
    <a href="/admin/sos-alerts.html" data-page="sos-alerts" aria-label="SOS Alerts">${icon("sos")} SOS Alerts <span class="badge badge-pending" id="sosBadge" aria-hidden="true">0</span></a>
    <a href="/admin/dev-tools.html" data-page="dev-tools">${icon("dev-tools")} Dev Tools</a>
    <button type="button" class="sidebar-logout" id="logoutBtn">${icon("logout")} Logout</button>
  </nav>
</aside>`;

export const AdminSidebar = {
  mount({ activePage, userName } = {}) {
    const container = document.getElementById("sidebarContainer");
    if (container && !container.querySelector(".admin-sidebar")) {
      container.innerHTML = SIDEBAR_HTML;
    }
    this.init({ activePage, userName });
  },

  init({ activePage, userName }) {
    // Set active page
    const activeLink = document.querySelector(
      `.sidebar-menu a[data-page="${activePage}"]`,
    );
    if (activeLink) {
      activeLink.classList.add("active");
      activeLink.setAttribute("aria-current", "page");
    }

    // Set user name
    const nameEl = document.getElementById("sidebarUserName");
    if (nameEl && userName) nameEl.textContent = userName;

    // Attach logout handler (shared helper)
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.onclick = adminLogout;
  },
};

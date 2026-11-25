// ManagerSidebar component - shared sidebar for all Port Manager pages.
// Uses the same icon sprite as admin.
import { api } from "/js/api.js";

const icon = (name, cls = "") =>
  `<svg${cls ? ` class="${cls}"` : ""} aria-hidden="true"><use href="/assets/icons.svg#i-${name}"></use></svg>`;

const SIDEBAR_HTML = `
<aside class="admin-sidebar">
  <div class="sidebar-header">
    <span class="sidebar-brand">
      ${icon("boat", "sidebar-logo")}
      <span class="sidebar-brand-text">Port Manager</span>
    </span>
  </div>
  <nav class="sidebar-menu" aria-label="Port Manager">
    <a href="/manager/dashboard.html" data-page="dashboard">${icon("dashboard")} Dashboard</a>
    <a href="/manager/trip-schedule.html" data-page="trip-schedule">${icon("routes")} Trip Schedule</a>
    <a href="/manager/monitoring.html" data-page="monitoring">${icon("boat-check")} Boat & Trip Monitoring</a>
    <a href="/manager/risk-assessment.html" data-page="risk-assessment">${icon("sos")} Risk Assessment</a>
    <a href="/manager/payments.html" data-page="payments">${icon("bookings")} Payment Records</a>
    <a href="/manager/departure-approval.html" data-page="departure-approval">${icon("routes")} Departure Approval</a>
    <a href="/manager/weather.html" data-page="weather">${icon("dev-tools")} Weather</a>
    <a href="/manager/profile.html" data-page="profile">${icon("users")} Profile</a>
    <button type="button" class="sidebar-logout" id="logoutBtn">${icon("logout")} Logout</button>
  </nav>
</aside>`;

export const ManagerSidebar = {
  async mount({ activePage } = {}) {
    const container = document.getElementById("sidebarContainer");
    if (!container) {
      console.warn("[ManagerSidebar] sidebarContainer not found in DOM");
      return;
    }
    if (!container.querySelector(".admin-sidebar")) {
      container.innerHTML = SIDEBAR_HTML;
    }
    await this.init({ activePage });
  },

  async init({ activePage }) {
    // Active page highlight
    const activeLink = document.querySelector(
      `.sidebar-menu a[data-page="${activePage}"]`,
    );
    if (activeLink) {
      activeLink.classList.add("active");
      activeLink.setAttribute("aria-current", "page");
    }

    // Drawer toggle for narrow windows (the CSS hides the sidebar below 992px).
    this.initDrawer();

    // Logout handler
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        await api.auth.logout();
        window.location.href = "/login.html";
      };
    }
  },

  initDrawer() {
    if (document.querySelector(".sidebar-toggle")) return;
    const header = document.querySelector(".admin-header");
    const sidebar = document.querySelector(".admin-sidebar");
    if (!header || !sidebar) return;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "sidebar-toggle";
    toggle.setAttribute("aria-label", "Open navigation menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`;
    header.prepend(toggle);

    const backdrop = document.createElement("div");
    backdrop.className = "sidebar-backdrop";
    document.body.appendChild(backdrop);

    const setOpen = (open) => {
      sidebar.classList.toggle("open", open);
      backdrop.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    };

    toggle.onclick = () => setOpen(!sidebar.classList.contains("open"));
    backdrop.onclick = () => setOpen(false);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sidebar.classList.contains("open")) setOpen(false);
    });
    // A drawer that stays open after navigating covers the next page too.
    sidebar.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setOpen(false));
    });
  },
};
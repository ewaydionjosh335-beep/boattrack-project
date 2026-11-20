// Admin Common Utilities
// Shared functions for all admin pages

import { api } from "/js/api.js";
import { ui } from "/js/ui.js";

/**
 * Shared logout handler for all admin pages
 * Prevents duplicate code across 10 admin files
 */
export async function adminLogout() {
  try {
    await api.auth.logout();
    window.location.href = "/login.html";
  } catch (err) {
    console.error("Logout failed:", err);
    ui.showToast("Logout failed. Please try again.", "error");
  }
}

/**
 * Shared date formatting using PHT (UTC+8)
 * Use this instead of manual Date.toLocaleDateString() for consistency
 */
export function uiLocalDateStr(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  // Convert to PHT (UTC+8)
  const phtOffset = 8 * 60 * 60 * 1000;
  const phtDate = new Date(d.getTime() + phtOffset);
  return `${phtDate.getUTCFullYear()}-${String(phtDate.getUTCMonth() + 1).padStart(2, "0")}-${String(phtDate.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Format date for display (localized string)
 */
export function formatDisplayDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString();
}

/**
 * Format date/time for display
 */
export function formatDisplayDateTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString();
}

/**
 * RFC 4180 compliant CSV escaping
 * Properly handles commas, quotes, newlines, and double quotes
 */
export function escapeCsvValue(value) {
  if (value === undefined || value === null) return "";
  const str = String(value);
  // If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (/[",\n\r]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Generate RFC 4180 compliant CSV from rows
 * @param {string} filename - Output filename
 * @param {Array<Object>} rows - Array of objects to export
 */
export function exportToCSV(filename, rows) {
  if (!rows || !rows.length) {
    ui.showToast("No data available to export.", "warning");
    return;
  }
  const keys = Object.keys(rows[0]);
  const lines = [keys.map(escapeCsvValue).join(",")];
  rows.forEach((row) => {
    lines.push(keys.map((key) => escapeCsvValue(row[key])).join(","));
  });

  // Blob download: data: URLs hit browser URL-length limits on large exports.
  const blob = new Blob([lines.join("\r\n") + "\r\n"], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Simple pagination helper
 * @param {Array} items - All items
 * @param {number} page - Current page (1-indexed)
 * @param {number} pageSize - Items per page
 * @returns {Object} { items: Array, totalPages: number, totalItems: number, currentPage: number }
 */
export function paginate(items, page = 1, pageSize = 25) {
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const currentPage = Math.max(1, Math.min(page, totalPages));
  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: items.slice(start, end),
    totalPages,
    totalItems,
    currentPage,
    pageSize,
  };
}

/**
 * Render pagination controls. Buttons carry data-page; wire clicks with
 * initPagination() after inserting this HTML.
 * @param {Object} pagination - Result from paginate()
 * @returns {string} HTML for pagination controls
 */
export function renderPagination(pagination) {
  const { currentPage, totalPages } = pagination;
  if (totalPages <= 1) return "";

  let html =
    '<div class="pagination" style="display:flex;gap:0.5rem;justify-content:center;margin-top:1rem;flex-wrap:wrap;">';

  // Previous button
  html += `<button class="btn btn-outline btn-sm" ${currentPage === 1 ? "disabled" : ""} data-page="${currentPage - 1}">Prev</button>`;

  // Page numbers (show max 5 pages centered on current)
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  for (let p = startPage; p <= endPage; p++) {
    html += `<button class="btn ${p === currentPage ? "btn-primary" : "btn-outline"} btn-sm" data-page="${p}">${p}</button>`;
  }

  // Next button
  html += `<button class="btn btn-outline btn-sm" ${currentPage === totalPages ? "disabled" : ""} data-page="${currentPage + 1}">Next</button>`;

  html += `</div>`;
  return html;
}

/**
 * Initialize pagination event listeners
 * @param {string} containerSelector - Selector for pagination container
 * @param {Function} onPageChange - Callback(pageNumber)
 */
export function initPagination(containerSelector, onPageChange) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  container.onclick = (e) => {
    const btn = e.target.closest("button[data-page]");
    if (btn && !btn.disabled) {
      const page = parseInt(btn.dataset.page, 10);
      onPageChange(page);
    }
  };
}

/**
 * Modal submit helper with loading/disabled state
 * Prevents double-click on form submission
 * @param {HTMLFormElement} form - The form element
 * @param {Function} submitFn - Async function to call on submit
 * @param {Object} options - { submitBtnSelector, loadingText, successToast, errorToast }
 */
export function setupModalSubmit(form, submitFn, options = {}) {
  const {
    submitBtnSelector = 'button[type="submit"]',
    loadingText = "Saving...",
    successToast = "Saved successfully.",
    errorToast = "Failed to save.",
  } = options;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector(submitBtnSelector);
    if (!submitBtn || submitBtn.disabled) return;

    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = loadingText;

    try {
      await submitFn();
      if (successToast) ui.showToast(successToast, "success");
    } catch (err) {
      ui.showToast(err.message || errorToast, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  };
}

/**
 * Search/filter helper for tables
 * @param {Array} allItems - All items to filter
 * @param {Object} filters - { search: string, ...otherFilters }
 * @param {Function} matchFn - Function(item, filters) => boolean
 * @returns {Array} Filtered items
 */
export function filterTable(allItems, filters, matchFn) {
  return allItems.filter((item) => matchFn(item, filters));
}

/**
 * Unique email check for crew provisioning
 * Generates a unique email based on name
 * @param {string} baseName - Base name for email
 * @param {Array} existingUsers - Array of user objects with email property
 * @returns {string} Unique email
 */
export async function generateUniqueEmail(baseName, existingUsers) {
  const cleanBase = (baseName || "crew")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  let email = `${cleanBase}@boattrack.local`;
  let counter = 1;
  while (existingUsers.some((u) => u.email === email)) {
    counter++;
    email = `${cleanBase}${counter}@boattrack.local`;
  }
  return email;
}

// Make adminLogout globally available for inline onclick handlers
window.adminLogout = adminLogout;

/**
 * Modal accessibility helper - adds focus trap, Escape key handling, and ARIA attributes
 * Call this after opening a modal: setupModalAccessibility(modalElement)
 * @param {HTMLElement} modal - The modal element (the .modal, not .modal-backdrop)
 */
export function setupModalAccessibility(modal) {
  if (!modal) return;
  // Re-opening a modal used to stack another keydown listener every time.
  if (modal._a11yCleanup) modal._a11yCleanup();

  // Set ARIA attributes
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  // Get focusable elements
  const focusableSelectors =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const getFocusable = () => modal.querySelectorAll(focusableSelectors);

  // Focus first element
  const focusable = getFocusable();
  if (focusable.length > 0) {
    focusable[0].focus();
  }

  // Handle keydown for focus trap and Escape
  const handleKeydown = (e) => {
    if (e.key === "Escape") {
      // Find close/cancel button - prefer data-dismiss, then .btn-outline in modal footer, then any close button
      const closeBtn = modal.querySelector(
        '[data-dismiss="modal"], .modal-footer .btn-outline, .modal-header .btn-outline, button[aria-label="Close"]',
      );
      if (closeBtn) {
        e.preventDefault();
        closeBtn.click();
      }
      return;
    }

    if (e.key === "Tab") {
      const focusable = getFocusable();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  modal.addEventListener("keydown", handleKeydown);

  // Return cleanup function
  const cleanup = () => modal.removeEventListener("keydown", handleKeydown);
  modal._a11yCleanup = cleanup;
  return cleanup;
}

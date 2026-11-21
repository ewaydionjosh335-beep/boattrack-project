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
 * Standardized error handler for admin pages
 * Use this instead of custom error boxes for consistency
 * @param {Error|string} err - Error object or message
 * @param {Object} options - { toast?: boolean, errorBox?: HTMLElement, fallbackMessage?: string }
 */
export function handleApiError(err, options = {}) {
  const { toast = true, errorBox = null, fallbackMessage = "Operation failed." } = options;
  const message = err?.message || fallbackMessage;

  if (toast) {
    ui.showToast(message, "error");
  }
  if (errorBox) {
    errorBox.textContent = message;
  }
  console.error("Admin API Error:", err);
  return message;
}

/**
 * Standardized success handler for admin pages
 * @param {string} message - Success message
 * @param {Object} options - { toast?: boolean }
 */
export function handleApiSuccess(message, options = {}) {
  const { toast = true } = options;
  if (toast) {
    ui.showToast(message, "success");
  }
  console.log("Admin API Success:", message);
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
 * Type definitions for admin module (JSDoc)
 * @typedef {Object} AdminUser
 * @property {string} id
 * @property {string} full_name
 * @property {string} email
 * @property {string} username
 * @property {string} role
 * @property {string} status
 * @property {string} [cluster]
 * @property {string} created_at
 */

/**
 * @typedef {Object} AdminBoat
 * @property {string} id
 * @property {string} name
 * @property {string} boat_type
 * @property {string} registration_status
 * @property {string} [registration_type]
 * @property {number} passenger_capacity
 * @property {number} cargo_capacity
 * @property {number} max_load_kg
 * @property {string} boat_status
 * @property {string} [owner_id]
 * @property {string} [operator_id]
 * @property {string} [remarks]
 * @property {string} created_at
 */

/**
 * @typedef {Object} AdminCrewApplication
 * @property {string} id
 * @property {string} full_name
 * @property {string} contact
 * @property {string} boat_id
 * @property {string} stage
 * @property {string} created_at
 */

/**
 * @typedef {Object} AdminRoute
 * @property {string} id
 * @property {string} origin_terminal_id
 * @property {string} destination_terminal_id
 * @property {number} fare
 * @property {string} route_type
 * @property {Object} [discount_rates]
 * @property {string} created_at
 */

/**
 * @typedef {Object} AdminTerminal
 * @property {string} id
 * @property {string} name
 * @property {string} location
 * @property {string} coast_guard_personnel
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {string} created_at
 */

/**
 * @typedef {Object} AdminTrip
 * @property {string} id
 * @property {string} boat_id
 * @property {string} route_id
 * @property {string} departure_time
 * @property {string} trip_status
 * @property {number} required_passengers
 * @property {string} [created_by]
 * @property {string} created_at
 */

/**
 * @typedef {Object} AdminAlert
 * @property {string} id
 * @property {string} boat_id
 * @property {string} trip_id
 * @property {string} sent_by_user_id
 * @property {string} sender_role
 * @property {string} message
 * @property {string} status
 * @property {string} [acknowledged_by]
 * @property {string} [acknowledged_at]
 * @property {string} created_at
 */

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
 * Update pagination controls in-place (more efficient than recreating)
 * @param {string} containerSelector - Selector for pagination container
 * @param {Object} pagination - Result from paginate()
 */
export function updatePagination(containerSelector, pagination) {
  const container = document.querySelector(containerSelector);
  if (!container) return;

  const { currentPage, totalPages } = pagination;
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  // Update existing buttons instead of recreating
  const prevBtn = container.querySelector('button[data-page="prev"]');
  const nextBtn = container.querySelector('button[data-page="next"]');
  const pageBtns = container.querySelectorAll('button[data-page]:not([data-page="prev"]):not([data-page="next"])');

  if (prevBtn) {
    prevBtn.disabled = currentPage === 1;
    prevBtn.dataset.page = currentPage - 1;
  }
  if (nextBtn) {
    nextBtn.disabled = currentPage === totalPages;
    nextBtn.dataset.page = currentPage + 1;
  }

  // Update page number buttons
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);
  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  // For simplicity, recreate only if page range changed significantly
  // Otherwise update in place
  const needsRecreate = pageBtns.length !== (endPage - startPage + 1) ||
    Array.from(pageBtns).some((btn, i) => parseInt(btn.dataset.page) !== startPage + i);

  if (needsRecreate) {
    container.innerHTML = renderPagination(pagination);
  } else {
    pageBtns.forEach((btn, i) => {
      const pageNum = startPage + i;
      btn.textContent = pageNum;
      btn.dataset.page = pageNum;
      btn.className = `btn ${pageNum === currentPage ? "btn-primary" : "btn-outline"} btn-sm`;
    });
  }
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
 * Create a standardized filter function for common admin table patterns
 * @param {Object} options - Configuration
 * @param {string} options.searchField - Field to search (or array of fields)
 * @param {Array} options.exactFilters - Array of { field, value } for exact matches
 * @returns {Function} Filter function compatible with filterTable
 */
export function createTableFilter({ searchFields = [], exactFilters = [] }) {
  return (item, filters) => {
    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase();
      const fields = Array.isArray(searchFields) ? searchFields : [searchFields];
      const matches = fields.some((field) => {
        const value = item[field];
        return value && String(value).toLowerCase().includes(search);
      });
      if (!matches) return false;
    }

    // Exact match filters
    for (const { field, value } of exactFilters) {
      const filterValue = filters[value];
      if (filterValue && item[field] !== filterValue) {
        return false;
      }
    }

    return true;
  };
}

/**
 * Setup standard filter event listeners for a table
 * @param {Object} options - { searchInput, filterSelects, renderTable }
 */
export function setupTableFilters({ searchInput, filterSelects = [], renderTable }) {
  let currentPage = 1;

  const resetPage = () => {
    currentPage = 1;
    renderTable();
  };

  if (searchInput) {
    searchInput.oninput = resetPage;
  }

  filterSelects.forEach((select) => {
    select.onchange = resetPage;
  });

  return { getCurrentPage: () => currentPage, setCurrentPage: (p) => { currentPage = p; } };
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

// adminLogout is exported and imported by modules that need it.
// Sidebar uses it directly via import; no global attachment needed.

/**
 * Password toggle button utility - returns SVG for eye/eye-slash icons
 * @param {boolean} showPassword - true for "show password" (eye), false for "hide password" (eye-slash)
 * @returns {string} SVG HTML string
 */
export function getPasswordToggleSVG(showPassword) {
  if (showPassword) {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  }
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

/**
 * Setup password toggle button
 * @param {HTMLInputElement} passwordInput - The password input element
 * @param {HTMLButtonElement} toggleBtn - The toggle button element
 */
export function setupPasswordToggle(passwordInput, toggleBtn) {
  toggleBtn.onclick = () => {
    const show = passwordInput.type === "password";
    passwordInput.type = show ? "text" : "password";
    toggleBtn.innerHTML = getPasswordToggleSVG(show);
  };
}

// Modal accessibility is handled by ui.modal() - no duplicate needed here.
// ui.modal() already provides: focus trap, Escape key handling, ARIA attributes, focus restore.

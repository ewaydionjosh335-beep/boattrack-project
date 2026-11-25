export const ui = {
  setupSync(callback, intervalMs = 5000) {
    const intervalId = setInterval(() => {
      try { callback(); } catch (e) { console.error('Sync interval error:', e); }
    }, intervalMs);
    const onStorage = (e) => {
      try { callback(); } catch (err) { console.error('Storage sync error:', err); }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('storage', onStorage);
    };
  },

  localDateStr(value = new Date()) {
    const d = value instanceof Date ? value : new Date(value);
    // Convert to PHT (UTC+8) for consistency with admin/common.js, so UTC
    // departure times near midnight are bucketed to the correct local day.
    const phtOffset = 8 * 60 * 60 * 1000;
    const phtDate = new Date(d.getTime() + phtOffset);
    return `${phtDate.getUTCFullYear()}-${String(phtDate.getUTCMonth() + 1).padStart(2, '0')}-${String(phtDate.getUTCDate()).padStart(2, '0')}`;
  },

  // Escape untrusted values before inserting them into innerHTML.
  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  },

  showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) container.remove();
    }, 3500);
  },

  // Escape/backdrop close, focus trap and focus restore for a .modal-backdrop.
  // Call open() instead of setting display directly so keyboard handling is wired up.
  modal(backdrop, { onClose } = {}) {
    const modalEl = backdrop.querySelector('.modal');
    const focusables = () => Array.from(backdrop.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    let lastFocused = null;

    const close = () => {
      if (backdrop.style.display === 'none') return;
      backdrop.style.display = 'none';
      document.removeEventListener('keydown', onKey);
      if (lastFocused) lastFocused.focus();
      if (onClose) onClose();
    };

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab' || !modalEl) return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) close();
    });

    return {
      open() {
        lastFocused = document.activeElement;
        backdrop.setAttribute('role', 'dialog');
        backdrop.setAttribute('aria-modal', 'true');
        backdrop.style.display = 'flex';
        document.addEventListener('keydown', onKey);
        requestAnimationFrame(() => (focusables()[0] || modalEl)?.focus());
      },
      close
    };
  },

  confirm(message, onConfirm) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Confirm Action</h3>
        </div>
        <div class="modal-body">
          <p></p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="cancelModal">Cancel</button>
          <button class="btn btn-danger" id="confirmModal">Confirm</button>
        </div>
      </div>
    `;
    backdrop.querySelector('.modal-body p').textContent = message;
    document.body.appendChild(backdrop);
    const dialog = ui.modal(backdrop, { onClose: () => backdrop.remove() });
    backdrop.querySelector('#cancelModal').onclick = () => dialog.close();
    backdrop.querySelector('#confirmModal').onclick = () => {
      dialog.close();
      Promise.resolve(onConfirm()).catch(err => ui.showToast(err.message || 'Action failed.', 'error'));
    };
    dialog.open();
  },

  };

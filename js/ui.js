export const ui = {
  setupSync(callback, intervalMs = 5000) {
    setInterval(() => {
      try { callback(); } catch (e) { console.error('Sync interval error:', e); }
    }, intervalMs);
    window.addEventListener('storage', (e) => {
      try { callback(); } catch (err) { console.error('Storage sync error:', err); }
    });
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

  confirm(message, onConfirm) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3>Confirm Action</h3>
        </div>
        <div class="modal-body">
          <p>${message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" id="cancelModal">Cancel</button>
          <button class="btn btn-danger" id="confirmModal">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#cancelModal').onclick = () => backdrop.remove();
    backdrop.querySelector('#confirmModal').onclick = () => {
      backdrop.remove();
      onConfirm();
    };
  },

  exportToCSV(filename, rows) {
    if (!rows || !rows.length) {
      this.showToast('No data available to export.', 'warning');
      return;
    }
    const keys = Object.keys(rows[0]);
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += keys.join(',') + '\r\n';

    rows.forEach(row => {
      const line = keys.map(key => {
        let val = row[key] !== undefined && row[key] !== null ? row[key] : '';
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      }).join(',');
      csvContent += line + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
};

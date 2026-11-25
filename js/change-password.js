import { api } from '/js/api.js';
import { auth } from '/js/auth.js';
import { ui } from '/js/ui.js';

const session = await auth.requireAuth();
if (!session) throw new Error('Unauthorized');

document.getElementById('changePasswordForm').onsubmit = async (e) => {
  e.preventDefault();
  const currentPass = document.getElementById('currentPass').value;
  const newPass = document.getElementById('newPass').value;
  const confirmPass = document.getElementById('confirmPass').value;

  try {
    if (newPass !== confirmPass) {
      throw new Error('New passwords do not match.');
    }
    // Verifies the current password against the login hash and hashes the
    // new one once, server-side style, in api.users.changePassword().
    await api.users.changePassword(currentPass, newPass);

    ui.showToast('Password updated successfully!', 'success');

    const ROLE_HOMES = {
      administrator: '/admin/dashboard.html',
      port_manager: '/manager/dashboard.html',
      receptionist: '/receptionist/dashboard.html',
      boat_owner: '/owner/dashboard.html',
      boat_operator: '/operator/dashboard.html',
      passenger: '/passenger/dashboard.html',
      crew: '/crew/dashboard.html'
    };
    setTimeout(() => {
      window.location.href = ROLE_HOMES[session.role] || '/index.html';
    }, 1000);
  } catch (err) {
    ui.showToast(err.message, 'danger');
  }
};

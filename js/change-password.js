import { api } from '/js/api.js';
import { auth, hashPassword } from '/js/auth.js';
import { ui } from '/js/ui.js';

const session = await auth.requireAuth();
if (!session) throw new Error('Unauthorized');

document.getElementById('changePasswordForm').onsubmit = async (e) => {
  e.preventDefault();
  const currentPass = document.getElementById('currentPass').value;
  const newPass = document.getElementById('newPass').value;
  const confirmPass = document.getElementById('confirmPass').value;

  try {
    // Read the account fresh: the password may have changed in another tab.
    const user = (await api.users.list()).find(u => u.id === session.user_id);
    if (!user) throw new Error('Account not found.');

    // Login checks password_hash only, so verify against that too — never the
    // legacy plaintext `password` field.
    if (!user.password_hash) {
      throw new Error('This account has no password on file. Contact the administrator.');
    }
    const currentHash = await hashPassword(currentPass);
    if (currentHash !== user.password_hash) {
      throw new Error('Current password is incorrect.');
    }
    if (newPass.length < 8 || !/[a-zA-Z]/.test(newPass) || !/[0-9]/.test(newPass)) {
      throw new Error('New password must be at least 8 characters long and contain at least one letter and one number.');
    }
    if (newPass !== confirmPass) {
      throw new Error('New passwords do not match.');
    }

    // Store the hash only; the plaintext `password` field stays empty.
    const newHash = await hashPassword(newPass);
    await api.users.update(session.user_id, {
      password: null,
      password_hash: newHash,
      must_change_password: false
    });

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

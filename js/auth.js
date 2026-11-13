import { api } from './api.js';

export async function hashPassword(password) {
  try {
    if (window.crypto && window.crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(password);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn('crypto.subtle failed', e);
  }
  throw new Error('Hashing not supported');
}

const ROLE_HOMES = {
  administrator: '/admin/dashboard.html',
  port_manager: '/manager/dashboard.html',
  receptionist: '/receptionist/dashboard.html',
  boat_owner: '/owner/dashboard.html',
  boat_operator: '/operator/dashboard.html',
  passenger: '/passenger/dashboard.html',
  crew: '/crew/dashboard.html'
};

function roleHome(role) {
  if (ROLE_HOMES[role]) return ROLE_HOMES[role];
  return `/roles/placeholder.html?role=${role}`;
}

const ROLE_PREFIXES = {
  administrator: '/admin/',
  port_manager: '/manager/',
  receptionist: '/receptionist/',
  boat_owner: '/owner/',
  boat_operator: '/operator/',
  passenger: '/passenger/',
  crew: '/crew/'
};

export const auth = {
  async requireAuth(allowedRoles = []) {
    const session = await api.auth.getSession();
    if (!session) {
      window.location.href = '/login.html';
      return null;
    }

    const currentPath = window.location.pathname;

    // Step 2: forced password change (skip on the change-password page itself)
    if (currentPath !== '/change-password.html') {
      const users = await api.users.list();
      const user = users.find(u => u.id === session.user_id);
      if (user && user.must_change_password) {
        window.location.href = '/change-password.html';
        return null;
      }
    }

    // Step 3: allowed roles check
    if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
      window.location.href = roleHome(session.role);
      return null;
    }

    // Step 4: path-prefix enforcement
    const allowedPrefix = ROLE_PREFIXES[session.role];
    if (allowedPrefix && currentPath !== '/change-password.html') {
      if (!currentPath.startsWith(allowedPrefix)) {
        window.location.href = roleHome(session.role);
        return null;
      }
    }

    return session;
  },

  async initNavbarAuth() {
    // Shortcuts removed per administrator request.
  }
};
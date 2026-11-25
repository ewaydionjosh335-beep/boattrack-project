/**
 * BoatTrack Data Access Layer (API simulation using localStorage)
 * FUTURE: Replace internal implementations with fetch() calls to Node/Express/Prisma backend.
 */

// localStorage is per-origin: http://localhost:5500 and http://127.0.0.1:5500 keep
// separate copies of the demo data, so a password/account saved in one looks "lost"
// when the other is opened. Canonicalise to 127.0.0.1 so every tab shares one store.
if (typeof location !== 'undefined' && location.hostname === 'localhost') {
  location.replace(location.href.replace('//localhost', '//127.0.0.1'));
}

const STORAGE_KEYS = [
  'users', 'passengers', 'boats', 'boat_documents', 'terminals',
  'routes', 'trips', 'manifests', 'payments', 'bookings',
  'etickets', 'gps_logs', 'alerts', 'settings', 'session',
  'crew_applications', 'crew_members', 'crew_attendance',
  'remittances', 'notifications', 'inspections', 'payment_gateway',
  'weather_records', 'risk_scans', 'departure_approvals', 'audit_logs'
];

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

function uiLocalDateStr(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function generateCSRFToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

function getCSRFToken() {
  const stored = localStorage.getItem(CSRF_TOKEN_KEY);
  if (!stored) return null;
  const { token, expires } = JSON.parse(stored);
  if (Date.now() > expires) {
    localStorage.removeItem(CSRF_TOKEN_KEY);
    return null;
  }
  return token;
}

function setCSRFToken(token) {
  localStorage.setItem(CSRF_TOKEN_KEY, JSON.stringify({
    token,
    expires: Date.now() + CSRF_TOKEN_EXPIRY
  }));
}

export function ensureCSRFToken() {
  return "prototype-csrf-disabled";
}

function validateCSRFToken(token) {
  const stored = getCSRFToken();
  return stored && stored === token;
}

function consumeCSRFToken() {
  localStorage.removeItem(CSRF_TOKEN_KEY);
}

async function hashPasswordServerSide(password, salt = null) {
  const encoder = new TextEncoder();
  const saltBytes = salt ? new Uint8Array(salt.match(/.{2}/g).map(b => parseInt(b, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const saltHex = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return { hash: hashHex, salt: saltHex };
}

async function verifyPasswordServerSide(password, storedHash, storedSalt) {
  if (!storedSalt) {
    // Backward compatibility: old SHA-256 hash without salt
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === storedHash;
  }
  const { hash } = await hashPasswordServerSide(password, storedSalt);
  return hash === storedHash;
}

function logAuditAction(session, action, targetType, targetId, details = {}) {
  const logs = api._get('audit_logs') || [];
  logs.push({
    id: 'audit_' + Math.random().toString(36).substring(2, 9),
    user_id: session?.user_id || 'unknown',
    user_role: session?.role || 'unknown',
    user_name: session?.full_name || 'Unknown',
    action,
    target_type: targetType,
    target_id: targetId,
    details,
    timestamp: new Date().toISOString(),
    ip: 'local'
  });
  if (logs.length > 10000) logs.splice(0, logs.length - 10000);
  api._set('audit_logs', logs);
}

export const api = {
  // Helper for reading/writing storage
  _get(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },

  _set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
  },

  _broadcastAlertsChanged() {
    try {
      const channel = new BroadcastChannel("sos-alerts");
      channel.postMessage("alerts-changed");
      channel.close();
    } catch (e) {
      // BroadcastChannel not supported (e.g., in some test environments)
    }
  },

  // Keep the role-specific record in sync with its user account. Admins create and
  // edit users directly, so without this a new passenger has no passengers row and
  // a new crew member has no crew_members row.
  _ensureRoleRecord(user, extra = {}) {
    if (user.role === 'passenger') {
      const passengers = api._get('passengers') || [];
      let passenger = passengers.find(p => p.user_id === user.id);
      if (passenger) {
        passenger.full_name = user.full_name;
      } else {
        passenger = {
          id: 'psg_' + Math.random().toString(36).substring(2, 9),
          user_id: user.id,
          full_name: user.full_name,
          weight_kg: extra.weight_kg || 65,
          created_at: new Date().toISOString()
        };
        passenger.qr_code = JSON.stringify({
          passenger_id: passenger.id,
          full_name: passenger.full_name,
          weight_kg: passenger.weight_kg
        });
        passengers.push(passenger);
      }
      api._set('passengers', passengers);
      return passenger;
    }

    if (user.role === 'crew') {
      const members = api._get('crew_members') || [];
      let member = members.find(m => m.user_id === user.id);
      if (member) {
        member.full_name = user.full_name;
      } else {
        member = {
          id: 'cm_' + Math.random().toString(36).substring(2, 9),
          user_id: user.id,
          boat_id: extra.boat_id || null,
          full_name: user.full_name,
          role: 'Crew',
          status: 'Active',
          created_at: new Date().toISOString()
        };
        members.push(member);
      }
      api._set('crew_members', members);
      return member;
    }

    return null;
  },

  // Ticket Number Generator Helper (unique and sequential per day, e.g., BT-20261017-0001)
  generateTicketNo() {
    // FUTURE: Backend ticket sequence generation
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const prefix = `BT-${dateStr}-`;
    
    const manifests = api._get('manifests') || [];
    let maxSeq = 0;
    manifests.forEach(m => {
      if (m.ticket_no && m.ticket_no.startsWith(prefix)) {
        const parts = m.ticket_no.split('-');
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });
    const nextSeq = maxSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  },

  // E-Ticket Number Generator Helper (unique and sequential per day, e.g., ET-20261017-0001)
  generateEticketNo() {
    // FUTURE: Backend e-ticket sequence generation
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const prefix = `ET-${dateStr}-`;
    
    const etickets = api._get('etickets') || [];
    let maxSeq = 0;
    etickets.forEach(e => {
      if (e.ticket_no && e.ticket_no.startsWith(prefix)) {
        const parts = e.ticket_no.split('-');
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });
    const nextSeq = maxSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  },

  // Amount Due Calculation Helper
  _calculateAmountDue(tripId, bookingType, passengerCount, cargoWeightKg, discountType = 'Adult') {
    const settings = api._get('settings') || { cargo_rate_per_kg: 2.00 };
    const ratePerKg = settings.cargo_rate_per_kg !== undefined ? settings.cargo_rate_per_kg : 2.00;

    if (bookingType === 'Cargo') {
      const weight = parseFloat(cargoWeightKg) || 0;
      return parseFloat((weight * ratePerKg).toFixed(2));
    } else {
      const trips = api._get('trips') || [];
      const routes = api._get('routes') || [];
      const boats = api._get('boats') || [];
      const trip = trips.find(t => t.id === tripId);
      let fare = 100.00;
      let routeDiscountRates = null;
      let boatDiscountRates = null;
      if (trip) {
        const route = routes.find(r => r.id === trip.route_id);
        if (route && route.fare) {
          fare = parseFloat(route.fare);
        }
        if (route && route.discount_rates) {
          routeDiscountRates = route.discount_rates;
        }
        const boat = boats.find(b => b.id === trip.boat_id);
        if (boat && boat.discount_rates) {
          boatDiscountRates = boat.discount_rates;
        }
      }
      const count = parseInt(passengerCount) || 1;
      const discountKey = {
        'Senior': 'senior',
        'Senior Citizen': 'senior',
        'PWD': 'pwd',
        'Student': 'student'
      }[discountType];
      
      // Priority: boat override > route override > global settings
      let discountRate = 0;
      if (discountKey) {
        if (boatDiscountRates && boatDiscountRates[discountKey] !== undefined) {
          discountRate = boatDiscountRates[discountKey];
        } else if (routeDiscountRates && routeDiscountRates[discountKey] !== undefined) {
          discountRate = routeDiscountRates[discountKey];
        } else {
          const globalKey = {
            'senior': 'discount_rate_senior',
            'pwd': 'discount_rate_pwd',
            'student': 'discount_rate_student'
          }[discountKey];
          discountRate = globalKey ? (settings[globalKey] ?? 20) : 0;
        }
      }
      return parseFloat((fare * count * (100 - discountRate) / 100).toFixed(2));
    }
  },

  // --- Auth & Session ---
  auth: {
    async login(identifier, passwordHash) {
      // FUTURE: POST /api/auth/login
      const users = api._get('users') || [];
      let user = users.find(u => (u.email === identifier || u.username === identifier));
      
      if (!user) throw new Error('Invalid email/username or password.');
      if (user.status === 'Suspended') throw new Error('Account is suspended. Please contact administrator.');
      
      const valid = await verifyPasswordServerSide(passwordHash, user.password_hash, user.password_salt);
      if (!valid) {
        throw new Error('Invalid email/username or password.');
      }
      
      const session = {
        token: 'mock_jwt_token_' + Math.random().toString(36).substring(2),
        user_id: user.id,
        role: user.role,
        full_name: user.full_name,
        expires_at: new Date(Date.now() + 86400000).toISOString()
      };
      api._set('session', session);
      logAuditAction(session, 'LOGIN', 'user', user.id, { identifier });
      return session;
    },

    async logout() {
      // FUTURE: POST /api/auth/logout
      localStorage.removeItem('session');
      return true;
    },

    async impersonate(userId, csrfToken) {
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const users = api._get('users') || [];
      const user = users.find(u => u.id === userId);
      if (!user) throw new Error('User not found.');
      const newSession = {
        token: 'mock_jwt_token_' + Math.random().toString(36).substring(2),
        user_id: user.id,
        role: user.role,
        full_name: user.full_name,
        expires_at: new Date(Date.now() + 86400000).toISOString()
      };
      api._set('session', newSession);
      logAuditAction(session, 'IMPERSONATE', 'user', userId, { targetRole: user.role });
      return newSession;
    },

    async getSession() {
      // FUTURE: GET /api/auth/session
      const session = api._get('session');
      if (!session) return null;
      if (new Date(session.expires_at) < new Date()) {
        localStorage.removeItem('session');
        return null;
      }
      const user = (api._get('users') || []).find(u => u.id === session.user_id);
      if (!user || user.status !== 'Active') {
        localStorage.removeItem('session');
        return null;
      }
      if (session.role !== user.role || session.full_name !== user.full_name) {
        session.role = user.role;
        session.full_name = user.full_name;
        api._set('session', session);
      }
      return session;
    },

    async registerUser(userData) {
      // FUTURE: POST /api/auth/register
      const users = api._get('users') || [];
      if (users.some(u => u.email === userData.email)) throw new Error('Email is already registered.');
      if (users.some(u => u.username === userData.username)) throw new Error('Username is already taken.');

      const { hash, salt } = await hashPasswordServerSide(userData.password_hash);
      const newUser = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        full_name: userData.full_name,
        email: userData.email,
        username: userData.username,
        password: null,
        password_hash: hash,
        password_salt: salt,
        role: userData.role || 'passenger',
        status: 'Active',
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      api._set('users', users);

      const linked = api._ensureRoleRecord(newUser, userData);
      return linked && newUser.role === 'passenger'
        ? { user: newUser, passenger: linked }
        : { user: newUser };
    }
  },

  // --- Users & Accounts ---
  users: {
    async list() {
      // FUTURE: GET /api/users
      return api._get('users') || [];
    },
    async updateSelf(data) {
      // Self-service profile edit: no role guard, but only the caller's own
      // whitelisted fields can ever be written.
      const session = api._getSession();
      if (!session) throw new Error('Unauthorized: login required.');
      const users = api._get('users') || [];
      const idx = users.findIndex(u => u.id === session.user_id);
      if (idx === -1) throw new Error('User not found.');

      const changes = {};
      ['full_name', 'contact'].forEach(key => {
        if (key in data) changes[key] = data[key];
      });
      users[idx] = { ...users[idx], ...changes };
      api._set('users', users);
      logAuditAction(session, 'UPDATE_SELF', 'user', session.user_id, { changes });
      return users[idx];
    },
    async changePassword(currentPassword, newPassword) {
      // Self-service password change. Verify against the same hash login uses,
      // then hash the raw new password exactly once (here).
      const session = api._getSession();
      if (!session) throw new Error('Unauthorized: login required.');
      const users = api._get('users') || [];
      const idx = users.findIndex(u => u.id === session.user_id);
      if (idx === -1) throw new Error('User not found.');
      const user = users[idx];
      if (!user.password_hash) throw new Error('This account has no password on file. Contact the administrator.');

      const valid = await verifyPasswordServerSide(currentPassword, user.password_hash, user.password_salt);
      if (!valid) throw new Error('Current password is incorrect.');
      if (!newPassword || newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        throw new Error('New password must be at least 8 characters long and contain at least one letter and one number.');
      }

      const { hash, salt } = await hashPasswordServerSide(newPassword);
      users[idx] = {
        ...user,
        password: null,
        password_hash: hash,
        password_salt: salt,
        must_change_password: false
      };
      api._set('users', users);
      logAuditAction(session, 'CHANGE_PASSWORD', 'user', user.id);
      return users[idx];
    },
    async generateUniqueEmail(baseName) {
      // FUTURE: POST /api/users/generate-email (atomic)
      const users = api._get('users') || [];
      const cleanBase = (baseName || 'crew').toLowerCase().replace(/[^a-z0-9]/g, '');
      // Timestamp + random suffix avoids two tabs generating the same address.
      const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      let email = `${cleanBase}_${suffix}@boattrack.local`;
      let counter = 1;
      while (users.some(u => u.email === email)) {
        email = `${cleanBase}_${suffix}${counter++}@boattrack.local`;
      }
      return email;
    },
    async generateUniqueUsername(baseName) {
      // FUTURE: POST /api/users/generate-username (atomic)
      const users = api._get('users') || [];
      const cleanBase = (baseName || 'crew').toLowerCase().replace(/[^a-z0-9]/g, '');
      // Timestamp + random suffix avoids two tabs generating the same username.
      const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      let username = `crew_${cleanBase}_${suffix}`;
      let counter = 1;
      while (users.some(u => u.username === username)) {
        username = `crew_${cleanBase}_${suffix}${counter++}`;
      }
      return username;
    },
    async create(data, csrfToken) {
      // FUTURE: POST /api/users
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const users = api._get('users') || [];
      if (users.some(u => u.email === data.email)) throw new Error('Email already exists.');
      if (users.some(u => u.username === data.username)) throw new Error('Username already exists.');

      const { hash, salt } = await hashPasswordServerSide(data.password_hash);
      const newUser = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        full_name: data.full_name,
        email: data.email,
        username: data.username,
        password: null,
        password_hash: hash,
        password_salt: salt,
        role: data.role,
        status: data.status || 'Active',
        cluster: data.cluster || null,
        must_change_password: data.must_change_password || false,
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      api._set('users', users);
      api._ensureRoleRecord(newUser, data);
      logAuditAction(session, 'CREATE', 'user', newUser.id, { role: newUser.role, email: newUser.email });
      return newUser;
    },
    async update(id, data, csrfToken) {
      // FUTURE: PUT /api/users/:id
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const users = api._get('users') || [];
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) throw new Error('User not found.');
      if (data.email && users.some(u => u.id !== id && u.email === data.email)) throw new Error('Email already exists.');
      if (data.username && users.some(u => u.id !== id && u.username === data.username)) throw new Error('Username already exists.');

      if (data.status === 'Suspended' && session && session.user_id === id) {
        throw new Error('You cannot suspend your own account.');
      }
      const activeAdmins = users.filter(u => u.role === 'administrator' && u.status === 'Active');
      const losingAdmin = users[idx].role === 'administrator' &&
        ((data.role && data.role !== 'administrator') || data.status === 'Suspended');
      if (losingAdmin && activeAdmins.length <= 1) {
        throw new Error('Cannot remove or suspend the last active administrator.');
      }

      const oldData = { ...users[idx] };
      if (data.password_hash) {
        const { hash, salt } = await hashPasswordServerSide(data.password_hash);
        data.password_hash = hash;
        data.password_salt = salt;
      }
      users[idx] = { ...users[idx], ...data, password: null };
      api._set('users', users);
      api._ensureRoleRecord(users[idx], data);
      logAuditAction(session, 'UPDATE', 'user', id, { changes: data, previous: oldData });
      return users[idx];
    },
    async delete(id, csrfToken) {
      // FUTURE: DELETE /api/users/:id
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const users = api._get('users') || [];
      const user = users.find(u => u.id === id);
      if (!user) return false;

      if (session && session.user_id === id) {
        throw new Error('You cannot delete your own account.');
      }
      const activeAdmins = users.filter(u => u.role === 'administrator' && u.status === 'Active');
      if (user.role === 'administrator' && activeAdmins.length <= 1) {
        throw new Error('Cannot delete the last active administrator.');
      }

      // Detach the account from operational records, keeping history intact.
      const boats = api._get('boats') || [];
      let boatsChanged = false;
      boats.forEach(b => {
        if (b.owner_id === id) { b.owner_id = null; boatsChanged = true; }
        if (b.operator_id === id) { b.operator_id = null; boatsChanged = true; }
      });
      if (boatsChanged) api._set('boats', boats);

      const crewMembers = api._get('crew_members') || [];
      const crewIds = crewMembers.filter(m => m.user_id === id).map(m => m.id);
      if (crewIds.length) {
        api._set('crew_members', crewMembers.filter(m => m.user_id !== id));

        const attendance = api._get('crew_attendance') || [];
        const keptAttendance = attendance.filter(a => !crewIds.includes(a.crew_member_id));
        if (keptAttendance.length !== attendance.length) api._set('crew_attendance', keptAttendance);

        const linkedApps = api._get('crew_applications') || [];
        let linkedAppsChanged = false;
        linkedApps.forEach(a => {
          if (crewIds.includes(a.crew_member_id)) { a.crew_member_id = null; linkedAppsChanged = true; }
        });
        if (linkedAppsChanged) api._set('crew_applications', linkedApps);

        const crewRemittances = api._get('remittances') || [];
        let crewRemittancesChanged = false;
        crewRemittances.forEach(r => {
          if (crewIds.includes(r.received_by_crew_id)) { r.received_by_crew_id = null; crewRemittancesChanged = true; }
        });
        if (crewRemittancesChanged) api._set('remittances', crewRemittances);
      }

      const apps = api._get('crew_applications') || [];
      const keptApps = apps.filter(a => a.applicant_user_id !== id);
      if (keptApps.length !== apps.length) api._set('crew_applications', keptApps);

      const alerts = api._get('alerts') || [];
      let alertsChanged = false;
      alerts.forEach(a => {
        if (a.sent_by_user_id === id) { a.sent_by_user_id = null; alertsChanged = true; }
        if (a.acknowledged_by === id) { a.acknowledged_by = null; alertsChanged = true; }
      });
      if (alertsChanged) api._set('alerts', alerts);

      const payments = api._get('payments') || [];
      let paymentsChanged = false;
      payments.forEach(p => {
        if (p.recorded_by === id) { p.recorded_by = null; paymentsChanged = true; }
      });
      if (paymentsChanged) api._set('payments', payments);

      const remittances = api._get('remittances') || [];
      let remittancesChanged = false;
      remittances.forEach(r => {
        if (r.recorded_by === id) { r.recorded_by = null; remittancesChanged = true; }
      });
      if (remittancesChanged) api._set('remittances', remittances);

      // Keep passenger booking history; just detach the deleted login.
      const passengers = api._get('passengers') || [];
      let passengersChanged = false;
      passengers.forEach(p => {
        if (p.user_id === id) { p.user_id = null; passengersChanged = true; }
      });
      if (passengersChanged) api._set('passengers', passengers);

      const notifications = api._get('notifications') || [];
      const keptNotifs = notifications.filter(n => n.user_id !== id);
      if (keptNotifs.length !== notifications.length) api._set('notifications', keptNotifs);

      // Clean up trips created by this user - nullify created_by
      const trips = api._get('trips') || [];
      let tripsChanged = false;
      trips.forEach(t => {
        if (t.created_by === id) { t.created_by = null; tripsChanged = true; }
      });
      if (tripsChanged) api._set('trips', trips);

      api._set('users', users.filter(u => u.id !== id));
      logAuditAction(session, 'DELETE', 'user', id, { email: user.email, role: user.role });
      return true;
    }
  },

  // --- Passengers ---
  passengers: {
    async list() {
      // FUTURE: GET /api/passengers
      return api._get('passengers') || [];
    },
    async getByUserId(userId) {
      // FUTURE: GET /api/passengers?user_id=:userId
      const passengers = api._get('passengers') || [];
      return passengers.find(p => p.user_id === userId);
    }
  },

  // --- Boats ---
  boats: {
    async list() {
      // FUTURE: GET /api/boats
      return api._get('boats') || [];
    },
    async listByOwner(ownerId) {
      // FUTURE: GET /api/boats?owner_id=:id
      const boats = api._get('boats') || [];
      return boats.filter(b => b.owner_id === ownerId);
    },
    async get(id) {
      // FUTURE: GET /api/boats/:id
      const boats = api._get('boats') || [];
      return boats.find(b => b.id === id);
    },
    async create(data, csrfToken) {
      // FUTURE: POST /api/boats
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const boats = api._get('boats') || [];
      const passengerCapacity = parseInt(data.passenger_capacity) || 20;
      const maxLoadKg = parseInt(data.max_load_kg) || 2000;
      const avgPassengerWeightKg = 65; // DEFAULT_PASSENGER_WEIGHT_KG from loadService
      const minRequiredLoadKg = passengerCapacity * avgPassengerWeightKg;
      if (maxLoadKg < minRequiredLoadKg) {
        throw new Error(`Max load (${maxLoadKg} kg) must be at least passenger capacity (${passengerCapacity}) × avg weight (${avgPassengerWeightKg} kg) = ${minRequiredLoadKg} kg.`);
      }
      const newBoat = {
        id: 'boat_' + Math.random().toString(36).substring(2, 9),
        name: data.name,
        owner_id: data.owner_id || null,
        operator_id: data.operator_id || null,
        boat_type: data.boat_type || 'Normal',
        registration_type: data.registration_type || null,
        registration_status: data.registration_status || 'Pending',
        verified_by: data.verified_by || null,
        remarks: data.remarks || '',
        passenger_capacity: parseInt(data.passenger_capacity) || 20,
        cargo_capacity: parseInt(data.cargo_capacity) || 500,
        max_load_kg: parseInt(data.max_load_kg) || 2000,
        boat_status: data.boat_status || 'Active',
        submitted_at: data.submitted_at || null,
        resubmission_count: parseInt(data.resubmission_count) || 0,
        home_terminal_id: data.home_terminal_id || null,
        discount_rates: data.discount_rates || null,
        created_at: new Date().toISOString()
      };
      boats.push(newBoat);
      api._set('boats', boats);
      logAuditAction(session, 'CREATE', 'boat', newBoat.id, { name: newBoat.name, owner_id: newBoat.owner_id });
      return newBoat;
    },
    async verify(id, data, csrfToken) {
      // FUTURE: PATCH /api/boats/:id/verify
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const boats = api._get('boats') || [];
      const idx = boats.findIndex(b => b.id === id);
      if (idx === -1) throw new Error('Boat not found.');

      if (data.registration_status === 'Rejected' && !String(data.remarks || '').trim()) {
        throw new Error('A reason is required when rejecting a boat registration.');
      }

      if (data.registration_status === 'Verified') {
        const docs = (api._get('boat_documents') || []).filter(d => d.boat_id === id);
        if (docs.length === 0) throw new Error('Cannot approve a boat with no submitted documents.');

        // Validate required fields for approval
        const boat = boats[idx];
        if (!boat.boat_type || boat.boat_type.trim() === '') {
          throw new Error('Boat type is required before approval.');
        }
        if (!boat.passenger_capacity || boat.passenger_capacity <= 0) {
          throw new Error('Passenger capacity must be greater than 0.');
        }
        if (!boat.max_load_kg || boat.max_load_kg <= 0) {
          throw new Error('Maximum load (kg) must be greater than 0.');
        }
        if (!boat.registration_type || boat.registration_type.trim() === '') {
          throw new Error('Registration type (Franchised/Licensed) is required before approval.');
        }

        const operatorId = data.operator_id !== undefined ? data.operator_id : boats[idx].operator_id;
        const operator = (api._get('users') || []).find(u => u.id === operatorId);
        if (!operator || operator.role !== 'boat_operator' || operator.status !== 'Active') {
          throw new Error('Assign an active boat operator before approving.');
        }
      }

      const oldData = { ...boats[idx] };
      boats[idx] = {
        ...boats[idx],
        registration_status: data.registration_status,
        registration_type: data.registration_type || boats[idx].registration_type,
        verified_by: data.verified_by,
        remarks: data.remarks || '',
        operator_id: data.operator_id !== undefined ? data.operator_id : boats[idx].operator_id,
        // Approving must not silently lift an existing suspension.
        boat_status: data.registration_status === 'Verified' && boats[idx].boat_status !== 'Suspended'
          ? 'Active'
          : boats[idx].boat_status
      };
      api._set('boats', boats);
      logAuditAction(session, 'VERIFY', 'boat', id, { newStatus: data.registration_status, changes: data, previous: oldData });
      return boats[idx];
    },
    async updateStatus(id, boat_status, reason = null, csrfToken) {
      // FUTURE: PATCH /api/boats/:id/status
      const session = api._requireRole('port_manager');
      api._requireCSRF(csrfToken);
      const boats = api._get('boats') || [];
      const idx = boats.findIndex(b => b.id === id);
      if (idx === -1) throw new Error('Boat not found.');
      const oldStatus = boats[idx].boat_status;
      boats[idx].boat_status = boat_status;
      api._set('boats', boats);

      const trips = api._get('trips') || [];
      const manifests = api._get('manifests') || [];
      const passengers = api._get('passengers') || [];
      const notifs = api._get('notifications') || [];
      let tripsChanged = false;
      let notified = false;

      const notify = (userId, message, link) => {
        if (!userId) return;
        notifs.push({ id: 'notif_' + Math.random().toString(36).substring(2, 9), user_id: userId, type: 'Trip', message, link, is_read: false, created_at: new Date().toISOString() });
        notified = true;
      };

      if (boat_status === 'Suspended') {
        const holdReason = reason || 'Boat suspended';
        trips.forEach(t => {
          // Only trips that were actually scheduled (not already manually held) are
          // marked as suspension-held, so reactivation releases only these.
          // A manually held trip keeps its manual hold_reason and stays Held.
          if (t.boat_id === id && t.trip_status === 'Scheduled' && !t.held_reason) {
            t.trip_status = 'Held';
            t.held_reason = holdReason;
            // Marker so reactivation releases only trips this suspension held.
            t.held_by_boat_suspension = true;
            t.updated_at = new Date().toISOString();
            t.approval_revision = (t.approval_revision || 0) + 1;
            tripsChanged = true;

            manifests.filter(m => m.trip_id === t.id).forEach(m => {
              const p = passengers.find(x => x.id === m.passenger_id);
              notify(p && p.user_id, `Your trip on ${boats[idx].name} has been placed on hold because the boat was suspended. Reason: ${holdReason}`, '/passenger/my-trips.html');
            });
            notify(boats[idx].operator_id, `Trip ${t.id} on ${boats[idx].name} has been placed on hold because the boat was suspended. Reason: ${holdReason}`, '/operator/trips.html');
          }
        });
      } else if (boat_status === 'Active') {
        // Reactivating releases only trips this suspension held (held_by_boat_suspension=true).
        // Manually held trips (held_by_boat_suspension=false) stay Held for the manager to review.
        // This preserves manual hold reasons even if suspension/reactivation occurs.
        trips.forEach(t => {
          if (t.boat_id === id && t.trip_status === 'Held' && t.held_by_boat_suspension) {
            t.trip_status = 'Scheduled';
            t.held_reason = null;
            t.held_by_boat_suspension = false;
            t.updated_at = new Date().toISOString();
            t.approval_revision = (t.approval_revision || 0) + 1;
            tripsChanged = true;

            manifests.filter(m => m.trip_id === t.id).forEach(m => {
              const p = passengers.find(x => x.id === m.passenger_id);
              notify(p && p.user_id, `Your trip on ${boats[idx].name} is scheduled again now that the boat is active.`, '/passenger/my-trips.html');
            });
            notify(boats[idx].operator_id, `Trip ${t.id} on ${boats[idx].name} is scheduled again — the boat is active.`, '/operator/trips.html');
          }
        });
      }

      if (tripsChanged) api._set('trips', trips);
      if (notified) api._set('notifications', notifs);
      logAuditAction(session, 'UPDATE_STATUS', 'boat', id, { oldStatus, newStatus: boat_status, reason });
      return boats[idx];
    },
    async update(id, data, csrfToken) {
      // FUTURE: PUT /api/boats/:id
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const boats = api._get('boats') || [];
      const idx = boats.findIndex(b => b.id === id);
      if (idx === -1) throw new Error('Boat not found.');
      const oldData = { ...boats[idx] };
      const passengerCapacity = data.passenger_capacity !== undefined ? parseInt(data.passenger_capacity) : boats[idx].passenger_capacity;
      const maxLoadKg = data.max_load_kg !== undefined ? parseInt(data.max_load_kg) : boats[idx].max_load_kg;
      const avgPassengerWeightKg = 65;
      const minRequiredLoadKg = passengerCapacity * avgPassengerWeightKg;
      if (maxLoadKg < minRequiredLoadKg) {
        throw new Error(`Max load (${maxLoadKg} kg) must be at least passenger capacity (${passengerCapacity}) × avg weight (${avgPassengerWeightKg} kg) = ${minRequiredLoadKg} kg.`);
      }
      boats[idx] = {
        ...boats[idx],
        ...data,
        passenger_capacity: data.passenger_capacity !== undefined ? parseInt(data.passenger_capacity) : boats[idx].passenger_capacity,
        cargo_capacity: data.cargo_capacity !== undefined ? parseInt(data.cargo_capacity) : boats[idx].cargo_capacity,
        max_load_kg: data.max_load_kg !== undefined ? parseInt(data.max_load_kg) : boats[idx].max_load_kg,
        home_terminal_id: data.home_terminal_id !== undefined ? data.home_terminal_id : boats[idx].home_terminal_id,
        discount_rates: data.discount_rates !== undefined ? data.discount_rates : boats[idx].discount_rates,
        resubmission_count: data.resubmission_count !== undefined ? parseInt(data.resubmission_count) : (boats[idx].resubmission_count || 0)
      };
      api._set('boats', boats);
      logAuditAction(session, 'UPDATE', 'boat', id, { changes: data, previous: oldData });
      return boats[idx];
    }
  },

  // --- Boat Documents ---
  boatDocuments: {
    async listByBoat(boatId) {
      // FUTURE: GET /api/boats/:boatId/documents
      const docs = api._get('boat_documents') || [];
      return docs.filter(d => d.boat_id === boatId);
    },
    async create(data) {
      // FUTURE: POST /api/boats/:boatId/documents
      const docs = api._get('boat_documents') || [];
      const newDoc = {
        id: 'doc_' + Math.random().toString(36).substring(2, 9),
        boat_id: data.boat_id,
        doc_type: data.doc_type || 'Permit',
        file_name: data.file_name,
        uploaded_at: new Date().toISOString()
      };
      docs.push(newDoc);
      api._set('boat_documents', docs);
      return newDoc;
    }
  },

  // --- Terminals ---
  terminals: {
    // Missing coordinates are allowed, but partial or out-of-range ones break Leaflet.
    // Returns null to indicate "don't update coordinates", or {lat, lng} if both provided and valid.
    _coords(lat, lng) {
      const hasLat = lat !== undefined && lat !== null && String(lat).trim() !== '';
      const hasLng = lng !== undefined && lng !== null && String(lng).trim() !== '';
      if (!hasLat && !hasLng) return { lat: null, lng: null }; // Explicitly clear both
      if (!hasLat || !hasLng) return null; // Partial - don't update
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
        throw new Error('Latitude must be a number between -90 and 90.');
      }
      if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
        throw new Error('Longitude must be a number between -180 and 180.');
      }
      return { lat: latNum, lng: lngNum };
    },
    async list() {
      // FUTURE: GET /api/terminals
      return api._get('terminals') || [];
    },
    async listBoats(terminalId) {
      // FUTURE: GET /api/terminals/:id/boats
      const boats = api._get('boats') || [];
      return boats.filter(b => b.home_terminal_id === terminalId);
    },
    async create(data, csrfToken) {
      // FUTURE: POST /api/terminals
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const terminals = api._get('terminals') || [];
      const coords = api.terminals._coords(data.lat, data.lng);
      const newTerm = {
        id: 'term_' + Math.random().toString(36).substring(2, 9),
        name: data.name,
        location: data.location,
        coast_guard_personnel: data.coast_guard_personnel || 'PCG Officer',
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null
      };
      terminals.push(newTerm);
      api._set('terminals', terminals);
      logAuditAction(session, 'CREATE', 'terminal', newTerm.id, { name: newTerm.name, location: newTerm.location });
      return newTerm;
    },
    async update(id, data, csrfToken) {
      // FUTURE: PUT /api/terminals/:id
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const terminals = api._get('terminals') || [];
      const idx = terminals.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('Terminal not found.');
      const oldData = { ...terminals[idx] };
      if (data.lat !== undefined || data.lng !== undefined) {
        const coords = api.terminals._coords(data.lat, data.lng);
        if (coords) {
          data = { ...data, lat: coords.lat, lng: coords.lng };
        } else {
          // Partial coordinates provided - don't update them
          delete data.lat;
          delete data.lng;
        }
      }
      terminals[idx] = { ...terminals[idx], ...data };
      api._set('terminals', terminals);
      logAuditAction(session, 'UPDATE', 'terminal', id, { changes: data, previous: oldData });
      return terminals[idx];
    },
    async delete(id, csrfToken) {
      // FUTURE: DELETE /api/terminals/:id
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const routes = api._get('routes') || [];
      const routeIds = routes
        .filter(r => r.origin_terminal_id === id || r.destination_terminal_id === id)
        .map(r => r.id);
      if (routeIds.length > 0) {
        throw new Error('Cannot delete terminal associated with active routes.');
      }
      const trips = api._get('trips') || [];
      if (trips.some(t => routeIds.includes(t.route_id))) {
        throw new Error('Cannot delete terminal: trips are using routes that reference it.');
      }
      const manifests = api._get('manifests') || [];
      const tripIds = trips.filter(t => routeIds.includes(t.route_id)).map(t => t.id);
      if (manifests.some(m => tripIds.includes(m.trip_id))) {
        throw new Error('Cannot delete terminal: manifests exist for trips using routes that reference it.');
      }
      const boats = api._get('boats') || [];
      if (boats.some(b => b.home_terminal_id === id)) {
        throw new Error('Cannot delete terminal: boats are assigned to it.');
      }
      let terminals = api._get('terminals') || [];
      const deletedTerm = terminals.find(t => t.id === id);
      terminals = terminals.filter(t => t.id !== id);
      api._set('terminals', terminals);
      logAuditAction(session, 'DELETE', 'terminal', id, { name: deletedTerm?.name });
      return true;
    }
  },

  // --- Routes ---
  routes: {
    async list() {
      // FUTURE: GET /api/routes
      return api._get('routes') || [];
    },
    async create(data, csrfToken) {
      // FUTURE: POST /api/routes
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      if (data.origin_terminal_id === data.destination_terminal_id) {
        throw new Error('Origin and destination terminals must be different.');
      }
      const terminals = api._get('terminals') || [];
      const originTerm = terminals.find(t => t.id === data.origin_terminal_id);
      const destTerm = terminals.find(t => t.id === data.destination_terminal_id);
      if (!originTerm) throw new Error('Origin terminal not found.');
      if (!destTerm) throw new Error('Destination terminal not found.');
      const routes = api._get('routes') || [];
      if (routes.some(r =>
        (r.origin_terminal_id === data.origin_terminal_id && r.destination_terminal_id === data.destination_terminal_id) ||
        (r.origin_terminal_id === data.destination_terminal_id && r.destination_terminal_id === data.origin_terminal_id)
      )) {
        throw new Error('Route already exists (including reverse direction).');
      }
      const newRoute = {
        id: 'rte_' + Math.random().toString(36).substring(2, 9),
        origin_terminal_id: data.origin_terminal_id,
        destination_terminal_id: data.destination_terminal_id,
        route_type: data.route_type || 'Passenger',
        fare: parseFloat(data.fare) || 100.00,
        est_duration_min: parseInt(data.est_duration_min) || 30,
        discount_rates: data.discount_rates || null
      };
      routes.push(newRoute);
      api._set('routes', routes);
      logAuditAction(session, 'CREATE', 'route', newRoute.id, { origin: newRoute.origin_terminal_id, destination: newRoute.destination_terminal_id, fare: newRoute.fare });
      return newRoute;
    },
    async update(id, data, csrfToken) {
      // FUTURE: PUT /api/routes/:id
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const routes = api._get('routes') || [];
      const idx = routes.findIndex(r => r.id === id);
      if (idx === -1) throw new Error('Route not found.');
      const oldData = { ...routes[idx] };
      const origin = data.origin_terminal_id !== undefined ? data.origin_terminal_id : routes[idx].origin_terminal_id;
      const destination = data.destination_terminal_id !== undefined ? data.destination_terminal_id : routes[idx].destination_terminal_id;
      if (origin === destination) {
        throw new Error('Origin and destination terminals must be different.');
      }
      // Validate terminals exist
      const terminals = api._get('terminals') || [];
      if (!terminals.find(t => t.id === origin)) throw new Error('Origin terminal not found.');
      if (!terminals.find(t => t.id === destination)) throw new Error('Destination terminal not found.');
      if (routes.some(r =>
        r.id !== id && (
          (r.origin_terminal_id === origin && r.destination_terminal_id === destination) ||
          (r.origin_terminal_id === destination && r.destination_terminal_id === origin)
        )
      )) {
        throw new Error('Route already exists (including reverse direction).');
      }
      const fare = data.fare !== undefined ? parseFloat(data.fare) : routes[idx].fare;
      if (!Number.isFinite(fare) || fare <= 0) throw new Error('Fare must be a positive number.');
      const validRouteTypes = ['Passenger', 'Cargo', 'Mixed'];
      const routeType = data.route_type !== undefined ? data.route_type : routes[idx].route_type;
      if (!validRouteTypes.includes(routeType)) {
        throw new Error('Route type must be Passenger, Cargo, or Mixed.');
      }
      // If route_type is changing, validate against existing trips' boats
      if (data.route_type !== undefined && data.route_type !== routes[idx].route_type) {
        const trips = api._get('trips') || [];
        const boats = api._get('boats') || [];
        const affectedTrips = trips.filter(t => t.route_id === id && t.trip_status !== 'Cancelled' && t.trip_status !== 'Arrived' && t.trip_status !== 'Held');
        for (const trip of affectedTrips) {
          const boat = boats.find(b => b.id === trip.boat_id);
          if (boat) {
            const boatType = boat.boat_type || 'Normal';
            // Cargo boats can only go on Cargo or Mixed routes
            if (boatType === 'Cargo' && routeType === 'Passenger') {
              throw new Error(`Cannot change route to Passenger-only: trip ${trip.id} uses cargo boat "${boat.name}".`);
            }
            // Passenger-only boats (Normal) cannot go on Cargo-only routes
            if (boatType === 'Normal' && routeType === 'Cargo') {
              throw new Error(`Cannot change route to Cargo-only: trip ${trip.id} uses passenger boat "${boat.name}".`);
            }
            // Fast craft typically for passenger routes
            if (boatType === 'Fast Craft' && routeType === 'Cargo') {
              throw new Error(`Cannot change route to Cargo-only: trip ${trip.id} uses fast craft "${boat.name}".`);
            }
          }
        }
      }
      // Validate discount_rates if provided
      const discountRates = data.discount_rates !== undefined ? data.discount_rates : routes[idx].discount_rates;
      if (discountRates !== null && discountRates !== undefined) {
        const validKeys = ['senior', 'pwd', 'student'];
        for (const key of Object.keys(discountRates)) {
          if (!validKeys.includes(key)) {
            throw new Error(`Invalid discount key: ${key}. Valid keys: senior, pwd, student`);
          }
          const val = discountRates[key];
          if (typeof val !== 'number' || val < 0 || val > 100) {
            throw new Error(`Discount rate for ${key} must be a number between 0 and 100.`);
          }
        }
      }
      routes[idx] = { ...routes[idx], ...data, origin_terminal_id: origin, destination_terminal_id: destination, route_type: routeType, discount_rates: discountRates || {}, fare };
      api._set('routes', routes);
      logAuditAction(session, 'UPDATE', 'route', id, { changes: data, previous: oldData });
      return routes[idx];
    },
    async delete(id, csrfToken) {
      // FUTURE: DELETE /api/routes/:id
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const trips = api._get('trips') || [];
      if (trips.some(t => t.route_id === id)) {
        throw new Error('Cannot delete route: trips are still using it.');
      }
      let routes = api._get('routes') || [];
      const deletedRoute = routes.find(r => r.id === id);
      routes = routes.filter(r => r.id !== id);
      api._set('routes', routes);
      logAuditAction(session, 'DELETE', 'route', id, { origin: deletedRoute?.origin_terminal_id, destination: deletedRoute?.destination_terminal_id });
      return true;
    }
  },

  // --- Trips ---
  _assertBoatActive(boatId, action) {
    const boat = (api._get('boats') || []).find(b => b.id === boatId);
    if (!boat) throw new Error('Boat not found.');
    if (boat.boat_status === 'Active') return boat;
    const held = (api._get('trips') || []).find(t => t.boat_id === boatId && t.held_by_boat_suspension && t.held_reason);
    const reason = held ? ` Reason: ${held.held_reason}.` : '';
    throw new Error(`Boat "${boat.name}" is ${boat.boat_status}. Reactivate it before ${action}.${reason}`);
  },

  _validateTrip(boatId, departureTime, excludeTripId = null) {
    const boats = api._get('boats') || [];
    const boat = boats.find(b => b.id === boatId);
    if (!boat) throw new Error('Boat not found.');
    if (boat.registration_status !== 'Verified' || boat.boat_status !== 'Active') {
      throw new Error('Cannot assign an unverified or suspended boat to a trip.');
    }

    const newTime = new Date(departureTime).getTime();
    if (isNaN(newTime)) throw new Error('Invalid departure time.');
    // No trips scheduled in the past (matching booking validation).
    if (newTime < Date.now()) throw new Error('Cannot schedule a trip in the past.');

    const trips = api._get('trips') || [];
    for (const t of trips) {
      if (excludeTripId && t.id === excludeTripId) continue;
      // Include Held trips in conflict check: a held trip may be released later,
      // creating a conflict if a new trip is scheduled too close.
      if (t.boat_id === boatId && t.trip_status !== 'Cancelled' && t.trip_status !== 'Arrived') {
        const existingTime = new Date(t.departure_time).getTime();
        if (Math.abs(newTime - existingTime) < 60 * 60 * 1000) {
          throw new Error(`Conflict: Same boat cannot have two trips within 60 minutes (${t.departure_time}).`);
        }
      }
    }
  },

  _validateBoatRouteCompatibility(boatId, routeId) {
    const boats = api._get('boats') || [];
    const routes = api._get('routes') || [];
    const boat = boats.find(b => b.id === boatId);
    const route = routes.find(r => r.id === routeId);
    if (!boat || !route) return; // Will be caught by other validation

    const boatType = boat.boat_type || 'Normal';
    const routeType = route.route_type || 'Passenger';

    // Cargo boats can only go on Cargo or Mixed routes
    if (boatType === 'Cargo' && routeType === 'Passenger') {
      throw new Error(`Cargo boat "${boat.name}" cannot be assigned to a Passenger-only route.`);
    }
    // Passenger-only boats (Normal) cannot go on Cargo-only routes
    if (boatType === 'Normal' && routeType === 'Cargo') {
      throw new Error(`Passenger boat "${boat.name}" cannot be assigned to a Cargo-only route.`);
    }
    // Fast craft typically for passenger routes
    if (boatType === 'Fast Craft' && routeType === 'Cargo') {
      throw new Error(`Fast Craft "${boat.name}" cannot be assigned to a Cargo-only route.`);
    }
},
  // --- Trips ---
  trips: {
    async list() {
      // FUTURE: GET /api/trips
      return api._get('trips') || [];
    },
    async create(data, csrfToken) {
      // FUTURE: POST /api/trips
      const session = api._requireRole('port_manager');
      api._requireCSRF(csrfToken);
      api._validateTrip(data.boat_id, data.departure_time);
      api._validateBoatRouteCompatibility(data.boat_id, data.route_id);
      const boats = api._get('boats') || [];
      const boat = boats.find(b => b.id === data.boat_id);
      const requiredPassengers = parseInt(data.required_passengers) || 10;
      if (boat && requiredPassengers > boat.passenger_capacity) {
        throw new Error(`Required passengers (${requiredPassengers}) exceeds boat capacity (${boat.passenger_capacity}).`);
      }
      const trips = api._get('trips') || [];
      const newTrip = {
        id: 'trp_' + Math.random().toString(36).substring(2, 9),
        boat_id: data.boat_id,
        route_id: data.route_id,
        departure_time: data.departure_time,
        required_passengers: parseInt(data.required_passengers) || 10,
        eta: data.eta || data.departure_time,
        trip_status: data.trip_status || 'Scheduled',
        held_reason: data.held_reason || null,
        crew_member_ids: data.crew_member_ids || [],
        created_by: data.created_by || null,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString()
      };
      trips.push(newTrip);
      api._set('trips', trips);
      logAuditAction(session, 'CREATE', 'trip', newTrip.id, { boat_id: newTrip.boat_id, route_id: newTrip.route_id, departure_time: newTrip.departure_time });
      return newTrip;
    },
    async updateStatus(id, trip_status, held_reason = null, csrfToken) {
      // FUTURE: PATCH /api/trips/:id/status
      const session = api._requireRole('port_manager');
      api._requireCSRF(csrfToken);
      const trips = api._get('trips') || [];
      const idx = trips.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('Trip not found.');
      
      const trip = trips[idx];
      const previousStatus = trip.trip_status;

      // Suspension is a hard stop for releasing a held trip or departing. Checked
      // in the shared transition so every caller (pages, markDeparted) is covered.
      if (trip_status === 'Scheduled' || trip_status === 'Departed') {
        api._assertBoatActive(trip.boat_id, trip_status === 'Departed' ? 'departing' : 'releasing the trip');
      }

      // Departure requires a valid coast guard approval for the current schedule
      // revision (a hold or schedule edit bumps approval_revision and invalidates
      // the old clearance). Centralized here so updateStatus and markDeparted share
      // a single source of truth.
      if (trip_status === 'Departed') {
        const approvals = api._get('departure_approvals') || [];
        const latest = approvals
          .filter(a => a.trip_id === id)
          .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))[0];
        if (!latest || latest.decision !== 'Approved') {
          throw new Error('Departure approval required.');
        }
        if ((latest.trip_revision || 0) !== (trip.approval_revision || 0)) {
          throw new Error('Departure approval is no longer valid. Get a new coast guard approval.');
        }
      }

      trip.trip_status = trip_status;
      if (held_reason !== undefined) {
        trip.held_reason = held_reason;
      }
      // A hold invalidates any earlier coast guard clearance.
      if (trip_status === 'Held') {
        trip.approval_revision = (trip.approval_revision || 0) + 1;
      }
      if (trip_status === 'Departed') {
        trip.departed_at = new Date().toISOString();
        const manifests = api._get('manifests') || [];
        const passengers = api._get('passengers') || [];
        const notifs = api._get('notifications') || [];
        manifests.filter(m => m.trip_id === id).forEach(m => {
          const p = passengers.find(x => x.id === m.passenger_id);
          if (p && p.user_id) notifs.push({ id: 'notif_' + Math.random().toString(36).substring(2, 9), user_id: p.user_id, type: 'Trip', message: 'Your trip has departed.', link: '/passenger/my-trips.html', is_read: false, created_at: new Date().toISOString() });
        });
        api._set('notifications', notifs);
      } else if (trip_status === 'Arrived') {
        const departedAt = trip.departed_at ? new Date(trip.departed_at).getTime() : 0;
        if (departedAt && Date.now() - departedAt < 10000) {
          throw new Error('Trip cannot arrive immediately after departure. Please allow transit time.');
        }
        trip.arrived_at = new Date().toISOString();
      } else if (trip_status === 'Scheduled') {
        // Trip released from hold - notify with previous hold reason
        if (previousStatus === 'Held') {
          // Releasing from hold does NOT increment approval_revision;
          // the hold already invalidated prior approval.
          // A new approval is required for departure.
          const manifests = api._get('manifests') || [];
          const passengers = api._get('passengers') || [];
          const notifs = api._get('notifications') || [];
          const reason = trip.held_reason || 'No reason provided';
          manifests.filter(m => m.trip_id === id).forEach(m => {
            const p = passengers.find(x => x.id === m.passenger_id);
            if (p && p.user_id) notifs.push({ id: 'notif_' + Math.random().toString(36).substring(2, 9), user_id: p.user_id, type: 'Trip', message: 'Your trip has been released from hold. Reason for hold: ' + reason, link: '/passenger/my-trips.html', is_read: false, created_at: new Date().toISOString() });
          });
          api._set('notifications', notifs);
        }
        trip.held_reason = null;
      }
      // Notify on hold
      if (trip_status === 'Held' && previousStatus !== 'Held') {
        const manifests = api._get('manifests') || [];
        const passengers = api._get('passengers') || [];
        const notifs = api._get('notifications') || [];
        const reason = held_reason || 'No reason provided';
        manifests.filter(m => m.trip_id === id).forEach(m => {
          const p = passengers.find(x => x.id === m.passenger_id);
          if (p && p.user_id) notifs.push({ id: 'notif_' + Math.random().toString(36).substring(2, 9), user_id: p.user_id, type: 'Trip', message: 'Your trip has been placed on hold. Reason: ' + reason, link: '/passenger/my-trips.html', is_read: false, created_at: new Date().toISOString() });
        });
        // Also notify boat operator/crew if possible
        const boats = api._get('boats') || [];
        const boat = boats.find(b => b.id === trip.boat_id);
        if (boat && boat.operator_id) {
          const users = api._get('users') || [];
          const operator = users.find(u => u.id === boat.operator_id);
          if (operator) {
            notifs.push({ id: 'notif_' + Math.random().toString(36).substring(2, 9), user_id: operator.id, type: 'Trip', message: 'Trip ' + trip.id + ' has been placed on hold. Reason: ' + reason, link: '/operator/trips.html', is_read: false, created_at: new Date().toISOString() });
          }
        }
        api._set('notifications', notifs);
      }
      trip.updated_at = new Date().toISOString();
      api._set('trips', trips);
      logAuditAction(session, 'UPDATE_STATUS', 'trip', id, { oldStatus: previousStatus, newStatus: trip_status, held_reason });
      return trip;
    },
    async update(id, data, csrfToken) {
      // FUTURE: PUT /api/trips/:id
      const session = api._requireRole('port_manager');
      api._requireCSRF(csrfToken);
      const trips = api._get('trips') || [];
      const idx = trips.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('Trip not found.');

      const oldData = { ...trips[idx] };
      const targetBoatId = data.boat_id !== undefined ? data.boat_id : trips[idx].boat_id;
      const targetRouteId = data.route_id !== undefined ? data.route_id : trips[idx].route_id;

      if (data.boat_id !== undefined) {
        api._validateTrip(targetBoatId, trips[idx].departure_time, id);
      }
      if (data.departure_time !== undefined) {
        api._validateTrip(targetBoatId, data.departure_time, id);
      }
      // Validate boat-route compatibility if either changes
      if (data.boat_id !== undefined || data.route_id !== undefined) {
        api._validateBoatRouteCompatibility(targetBoatId, targetRouteId);
      }
      // Validate required_passengers against boat capacity
      if (data.required_passengers !== undefined) {
        const boats = api._get('boats') || [];
        const boat = boats.find(b => b.id === targetBoatId);
        const requiredPassengers = parseInt(data.required_passengers) || 10;
        if (boat && requiredPassengers > boat.passenger_capacity) {
          throw new Error(`Required passengers (${requiredPassengers}) exceeds boat capacity (${boat.passenger_capacity}).`);
        }
      }

      const scheduleChanged =
        (data.boat_id !== undefined && data.boat_id !== trips[idx].boat_id) ||
        (data.route_id !== undefined && data.route_id !== trips[idx].route_id) ||
        (data.departure_time !== undefined && data.departure_time !== trips[idx].departure_time);
      if (scheduleChanged) trips[idx].approval_revision = (trips[idx].approval_revision || 0) + 1;

      // Validate crew members belong to the boat if provided
      if (data.crew_member_ids !== undefined) {
        const crewMembers = api._get('crew_members') || [];
        const validCrewIds = crewMembers
          .filter(m => m.boat_id === targetBoatId && m.status === 'Active')
          .map(m => m.id);
        const invalidIds = data.crew_member_ids.filter(id => !validCrewIds.includes(id));
        if (invalidIds.length > 0) {
          throw new Error(`Invalid crew member(s) for this boat: ${invalidIds.join(', ')}`);
        }
      }

      trips[idx] = { ...trips[idx], ...data, updated_at: new Date().toISOString() };
      api._set('trips', trips);
      logAuditAction(session, 'UPDATE', 'trip', id, { changes: data, previous: oldData });
      return trips[idx];
    },
    async delete(id, csrfToken) {
      // FUTURE: DELETE /api/trips/:id
      const session = api._requireRole('port_manager');
      api._requireCSRF(csrfToken);
      const trips = api._get('trips') || [];
      const idx = trips.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('Trip not found.');
      if (trips[idx].trip_status !== 'Scheduled' && trips[idx].trip_status !== 'Held') {
        throw new Error('Cannot delete a trip that has already departed or arrived.');
      }
      const manifests = api._get('manifests') || [];
      const manifestIds = manifests.filter(m => m.trip_id === id).map(m => m.id);
      if (manifests.some(m => m.trip_id === id)) {
        throw new Error('Cannot delete trip: manifest entries already exist.');
      }
      // Deleting would orphan the passengers who booked it and the coast guard record.
      const bookings = api._get('bookings') || [];
      const bookingIds = bookings.filter(b => b.trip_id === id).map(b => b.id);
      if (bookings.some(b => b.trip_id === id)) {
        throw new Error('Cannot delete trip: passengers already have bookings for it.');
      }
      const payments = api._get('payments') || [];
      if (payments.some(p => (p.booking_id && bookingIds.includes(p.booking_id)) || (p.manifest_id && manifestIds.includes(p.manifest_id)))) {
        throw new Error('Cannot delete trip: payment records exist for bookings or manifest entries.');
      }
      const etickets = api._get('etickets') || [];
      if (etickets.some(e => e.booking_id && bookingIds.includes(e.booking_id))) {
        throw new Error('Cannot delete trip: e-tickets have been issued for bookings.');
      }
      const approvals = api._get('departure_approvals') || [];
      if (approvals.some(a => a.trip_id === id)) {
        throw new Error('Cannot delete trip: it has departure approval records.');
      }
      // Delete associated inspections and risk scans to avoid orphaned records
      const inspections = api._get('inspections') || [];
      const filteredInspections = inspections.filter(i => i.trip_id !== id);
      if (filteredInspections.length !== inspections.length) {
        api._set('inspections', filteredInspections);
      }
      const riskScans = api._get('risk_scans') || [];
      const filteredRiskScans = riskScans.filter(s => s.trip_id !== id);
      if (filteredRiskScans.length !== riskScans.length) {
        api._set('risk_scans', filteredRiskScans);
      }
      trips.splice(idx, 1);
      api._set('trips', trips);
      return true;
    },
    async markDeparted(id) {
      api._requireRole('port_manager');
      const trips = api._get('trips') || [];
      const idx = trips.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('Trip not found.');
      if (trips[idx].trip_status !== 'Scheduled') throw new Error('Trip must be Scheduled.');
      // Departure approval validation and the Scheduled -> Departed transition are
      // centralized in updateStatus; markDeparted is a thin wrapper.
      return api.trips.updateStatus(id, 'Departed');
    },
    async markArrived(id) {
      api._requireRole('port_manager');
      const trips = api._get('trips') || [];
      const idx = trips.findIndex(t=>t.id===id);
      if (idx === -1) throw new Error('Trip not found.');
      if (trips[idx].trip_status !== 'Departed') throw new Error('Trip must be Departed.');
      const departedAt = trips[idx].departed_at ? new Date(trips[idx].departed_at).getTime() : 0;
      if (departedAt && Date.now() - departedAt < 10 * 1000) {
        throw new Error('Trip cannot arrive immediately after departure. Please allow transit time.');
      }
      trips[idx].trip_status = 'Arrived';
      trips[idx].arrived_at = new Date().toISOString();
      trips[idx].updated_at = new Date().toISOString();
      api._set('trips', trips);
      return trips[idx];
    }
  },

  // --- Manifests ---
  manifests: {
    async list() {
      // FUTURE: GET /api/manifests
      return api._get('manifests') || [];
    },
    async listByTrip(tripId) {
      // FUTURE: GET /api/manifests?trip_id=:tripId
      const manifests = api._get('manifests') || [];
      return manifests.filter(m => m.trip_id === tripId);
    },
    async create(data) {
      // FUTURE: POST /api/manifests
      const manifests = api._get('manifests') || [];
      const trips = api._get('trips') || [];
      const trip = trips.find(t => t.id === data.trip_id);
      if (!trip) throw new Error('Trip not found.');

      // Require booking_id unless explicitly marked as walk-in
      const isWalkIn = data.is_walk_in === true;
      if (!isWalkIn && !data.booking_id) {
        throw new Error('booking_id is required for non-walk-in manifests. Use is_walk_in: true for walk-in passengers.');
      }

      // If booking_id provided, validate it matches the trip
      if (data.booking_id) {
        const bookings = api._get('bookings') || [];
        const booking = bookings.find(b => b.id === data.booking_id);
        if (!booking) throw new Error('Booking not found.');
        if (booking.trip_id !== data.trip_id) {
          throw new Error('Booking does not belong to this trip.');
        }
        if (booking.status !== 'Approved' && booking.status !== 'Paid') {
          throw new Error('Booking must be approved or paid to create manifest.');
        }
      }

      const newMan = {
        id: 'mnf_' + Math.random().toString(36).substring(2, 9),
        trip_id: data.trip_id,
        passenger_id: data.passenger_id,
        ticket_no: data.ticket_no || api.generateTicketNo(),
        discount_type: data.discount_type || 'None',
        id_verified: data.id_verified !== undefined ? Boolean(data.id_verified) : false,
        fare: parseFloat(data.fare) || 100.00,
        baggage_weight_kg: parseFloat(data.baggage_weight_kg) || 0.0,
        booking_id: data.booking_id || null,
        is_walk_in: isWalkIn,
        recorded_by: data.recorded_by || null,
        created_at: data.created_at || new Date().toISOString()
      };
      manifests.push(newMan);
      api._set('manifests', manifests);
      return newMan;
    },
    async update(id, data) {
      // FUTURE: PUT /api/manifests/:id
      const manifests = api._get('manifests') || [];
      const idx = manifests.findIndex(m => m.id === id);
      if (idx === -1) throw new Error('Manifest entry not found.');
      manifests[idx] = { ...manifests[idx], ...data };
      api._set('manifests', manifests);
      return manifests[idx];
    },
    async delete(id) {
      // FUTURE: DELETE /api/manifests/:id
      let manifests = api._get('manifests') || [];
      manifests = manifests.filter(m => m.id !== id);
      api._set('manifests', manifests);
      return true;
    }
  },

  // --- Payments ---
  payments: {
    async list() {
      // FUTURE: GET /api/payments
      return api._get('payments') || [];
    },
    async get(id) {
      // FUTURE: GET /api/payments/:id
      const payments = api._get('payments') || [];
      return payments.find(p => p.id === id);
    },
    async listByBoat(boatId) {
      // FUTURE: GET /api/payments?boat_id=:boatId
      const payments = api._get('payments') || [];
      return payments.filter(p => p.boat_id === boatId);
    },
    async listByManifest(manifestId) {
      // FUTURE: GET /api/payments?manifest_id=:manifestId
      const payments = api._get('payments') || [];
      return payments.filter(p => p.manifest_id === manifestId);
    },
    async listByBooking(bookingId) {
      // FUTURE: GET /api/payments?booking_id=:bookingId
      const payments = api._get('payments') || [];
      return payments.filter(p => p.booking_id === bookingId);
    },
    async create(data) {
      // FUTURE: POST /api/payments
      const payments = api._get('payments') || [];
      const newPay = {
        id: 'pay_' + Math.random().toString(36).substring(2, 9),
        manifest_id: data.manifest_id || null,
        booking_id: data.booking_id || null,
        boat_id: data.boat_id || null,
        method: data.method || 'GCash', // Cash | GCash
        amount: parseFloat(data.amount) || 0.0,
        status: data.status || 'Pending', // Pending | Paid | Failed
        reference_no: data.reference_no || null,
        recorded_by: data.recorded_by || null,
        remittance_id: data.remittance_id || null, // null until remitted
        created_at: data.created_at || new Date().toISOString()
      };
      payments.push(newPay);
      api._set('payments', payments);
      return newPay;
    },
    async update(id, data) {
      // FUTURE: PUT /api/payments/:id
      const payments = api._get('payments') || [];
      const idx = payments.findIndex(p => p.id === id);
      if (idx === -1) throw new Error('Payment not found.');
      payments[idx] = { ...payments[idx], ...data };
      api._set('payments', payments);
      return payments[idx];
    },
    async delete(id) {
      // FUTURE: DELETE /api/payments/:id
      let payments = api._get('payments') || [];
      payments = payments.filter(p => p.id !== id);
      api._set('payments', payments);
      return true;
    }
  },

  // --- Remittances ---
  remittances: {
    async list() {
      // FUTURE: GET /api/remittances
      return api._get('remittances') || [];
    },
    async get(id) {
      // FUTURE: GET /api/remittances/:id
      const remittances = api._get('remittances') || [];
      return remittances.find(r => r.id === id);
    },
    async create(data) {
      // FUTURE: POST /api/remittances
      const remittances = api._get('remittances') || [];
      const newRem = {
        id: 'rem_' + Math.random().toString(36).substring(2, 9),
        boat_id: data.boat_id || null,
        date: data.date || uiLocalDateStr(),
        total_amount: parseFloat(data.total_amount) || 0.0,
        received_by_crew_id: data.received_by_crew_id || null,
        recorded_by: data.recorded_by || null,
        remitted_at: data.remitted_at || new Date().toISOString(),
        created_at: data.created_at || new Date().toISOString()
      };
      remittances.push(newRem);
      api._set('remittances', remittances);
      return newRem;
    },
    async update(id, data) {
      // FUTURE: PUT /api/remittances/:id
      const remittances = api._get('remittances') || [];
      const idx = remittances.findIndex(r => r.id === id);
      if (idx === -1) throw new Error('Remittance not found.');
      remittances[idx] = { ...remittances[idx], ...data };
      api._set('remittances', remittances);
      return remittances[idx];
    },
    async delete(id) {
      // FUTURE: DELETE /api/remittances/:id
      let remittances = api._get('remittances') || [];
      remittances = remittances.filter(r => r.id !== id);
      api._set('remittances', remittances);
      return true;
    }
  },

  // --- Bookings ---
  bookings: {
    async list() {
      // FUTURE: GET /api/bookings
      return api._get('bookings') || [];
    },
    // Payment moves a booking from 'Approved' to 'Paid'; both are approved records.
    isApproved(booking) {
      return !!booking && (booking.status === 'Approved' || booking.status === 'Paid');
    },
    async create(data) {
      // FUTURE: POST /api/bookings
      const trips = api._get('trips') || [];
      const trip = trips.find(t => t.id === data.trip_id);
      if (!trip) throw new Error('Trip not found.');
      if (trip.trip_status !== 'Scheduled') throw new Error('Trip is not available for booking.');
      if (new Date(trip.departure_time) < new Date()) throw new Error('Cannot book past trips.');
      const routes = api._get('routes') || [];
      if (!routes.some(r => r.id === trip.route_id)) {
        throw new Error('This trip has no valid route. Please contact the operator.');
      }

      const bookings = api._get('bookings') || [];
      const duplicate = bookings.find(b => b.passenger_id === data.passenger_id && b.trip_id === data.trip_id && b.booking_type === data.booking_type && (b.status === 'Reviewing' || b.status === 'Approved'));
      if (duplicate) throw new Error('You already have an open booking for this trip.');

      const bookingType = data.booking_type || 'Passenger';
      const passengerCount = parseInt(data.passenger_count) || 1;
      const cargoWeightKg = parseFloat(data.cargo_weight_kg) || 0;
      const discountType = data.discount_type || 'Adult';
      const amountDue = api._calculateAmountDue(data.trip_id, bookingType, passengerCount, cargoWeightKg, discountType);

      const newBook = {
        id: 'bok_' + Math.random().toString(36).substring(2, 9),
        passenger_id: data.passenger_id || null,
        trip_id: data.trip_id,
        booking_type: bookingType,
        passenger_count: passengerCount,
        cargo_weight_kg: cargoWeightKg,
        discount_type: discountType,
        cargo_area_sqm: parseFloat(data.cargo_area_sqm) || 0,
        cargo_crowding: data.cargo_crowding || 'Low',
        notes: data.notes || '',
        status: data.status || 'Reviewing',
        amount_due: amountDue,
        reviewed_by: data.reviewed_by || null,
        reviewed_at: data.reviewed_at || null,
        review_remarks: data.review_remarks || '',
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString()
      };
      bookings.push(newBook);
      api._set('bookings', bookings);
      return newBook;
    },
    async updateStatus(id, status) {
      // FUTURE: PATCH /api/bookings/:id/status
      const bookings = api._get('bookings') || [];
      const idx = bookings.findIndex(b => b.id === id);
      if (idx === -1) throw new Error('Booking not found.');
      bookings[idx].status = status;
      bookings[idx].updated_at = new Date().toISOString();
      api._set('bookings', bookings);
      return bookings[idx];
    },
    async updateReview(id, data) {
      // FUTURE: PATCH /api/bookings/:id/review
      const bookings = api._get('bookings') || [];
      const idx = bookings.findIndex(b => b.id === id);
      if (idx === -1) throw new Error('Booking not found.');
      
      const newStatus = data.status || bookings[idx].status;
      const amountDue = api._calculateAmountDue(
        bookings[idx].trip_id,
        bookings[idx].booking_type,
        bookings[idx].passenger_count,
        bookings[idx].cargo_weight_kg,
        bookings[idx].discount_type
      );

      bookings[idx] = {
        ...bookings[idx],
        status: newStatus,
        amount_due: amountDue,
        reviewed_by: data.reviewed_by || bookings[idx].reviewed_by,
        reviewed_at: data.reviewed_at || new Date().toISOString(),
        review_remarks: data.review_remarks !== undefined ? data.review_remarks : bookings[idx].review_remarks,
        updated_at: new Date().toISOString()
      };
      api._set('bookings', bookings);

      // Create notification for passenger if user_id exists
      const passengers = api._get('passengers') || [];
      const passenger = passengers.find(p => p.id === bookings[idx].passenger_id);
      if (passenger && passenger.user_id) {
        let msg = '';
        if (newStatus === 'Approved') {
          msg = `Your booking for Trip ${bookings[idx].trip_id} has been approved. Amount Due: ₱${amountDue.toFixed(2)}. Please proceed to payment.`;
        } else if (newStatus === 'Rejected') {
          msg = `Your booking for Trip ${bookings[idx].trip_id} has been rejected. Remarks: ${bookings[idx].review_remarks}`;
        }
        if (msg) {
          const notifs = api._get('notifications') || [];
          notifs.push({
            id: 'notif_' + Math.random().toString(36).substring(2, 9),
            user_id: passenger.user_id,
            type: 'Booking',
            message: msg,
            link: '/passenger/my-bookings.html',
            is_read: false,
            created_at: new Date().toISOString()
          });
          api._set('notifications', notifs);
        }
      }

      return bookings[idx];
    }
  },

  // --- E-Tickets ---
  etickets: {
    async list() {
      // FUTURE: GET /api/etickets
      return api._get('etickets') || [];
    },
    async create(data) {
      // FUTURE: POST /api/etickets
      const etickets = api._get('etickets') || [];
      const newEticket = {
        id: 'etk_' + Math.random().toString(36).substring(2, 9),
        booking_id: data.booking_id || null,
        ticket_no: data.ticket_no || api.generateEticketNo(),
        passenger_name: data.passenger_name || 'Passenger',
        gcash_ref: data.gcash_ref || null,
        issued_at: data.issued_at || new Date().toISOString()
      };
      etickets.push(newEticket);
      api._set('etickets', etickets);
      return newEticket;
    }
  },

  // --- Notifications ---
  notifications: {
    async list() {
      // FUTURE: GET /api/notifications
      return api._get('notifications') || [];
    },
    async listByUser(userId) {
      // FUTURE: GET /api/notifications?user_id=:userId
      const notifs = api._get('notifications') || [];
      return notifs.filter(n => n.user_id === userId);
    },
    async create(data) {
      // FUTURE: POST /api/notifications
      const notifs = api._get('notifications') || [];
      const newNotif = {
        id: 'notif_' + Math.random().toString(36).substring(2, 9),
        user_id: data.user_id || null,
        type: data.type || 'System',
        message: data.message || '',
        link: data.link || null,
        is_read: data.is_read !== undefined ? Boolean(data.is_read) : false,
        created_at: new Date().toISOString()
      };
      notifs.push(newNotif);
      api._set('notifications', notifs);
      return newNotif;
    },
    async markAsRead(id) {
      // FUTURE: PATCH /api/notifications/:id/read
      const notifs = api._get('notifications') || [];
      const idx = notifs.findIndex(n => n.id === id);
      if (idx !== -1) {
        notifs[idx].is_read = true;
        api._set('notifications', notifs);
      }
      return notifs[idx];
    }
  },

  // --- Inspections ---
  inspections: {
    async list() {
      // FUTURE: GET /api/inspections
      return api._get('inspections') || [];
    },
    async listByTrip(tripId) {
      // FUTURE: GET /api/inspections?trip_id=:tripId
      const inspections = api._get('inspections') || [];
      return inspections.filter(i => i.trip_id === tripId);
    },
    async listByBoat(boatId) {
      // FUTURE: GET /api/inspections?boat_id=:boatId
      const inspections = api._get('inspections') || [];
      return inspections.filter(i => i.boat_id === boatId);
    },
    async create(data) {
      // FUTURE: POST /api/inspections
      const inspections = api._get('inspections') || [];
      const newInsp = {
        id: 'insp_' + Math.random().toString(36).substring(2, 9),
        trip_id: data.trip_id || null,
        boat_id: data.boat_id || null,
        inspection_type: data.inspection_type || 'Pre-departure', // Pre-departure | Post-arrival
        items: data.items || [], // Array of {item: Life jackets|Engine|Fuel|Hull|Passenger count, result: Pass|Fail, note}
        counted_passengers: parseInt(data.counted_passengers) || 0,
        manifest_count: parseInt(data.manifest_count) || 0,
        overall: data.overall || 'Passed', // Passed | Failed
        remarks: data.remarks || '',
        inspected_by: data.inspected_by || null,
        inspected_at: data.inspected_at || new Date().toISOString()
      };
      inspections.push(newInsp);
      api._set('inspections', inspections);
      return newInsp;
    }
  },

  // --- GPS Logs ---
  gpsLogs: {
    async list() { return api._get('gps_logs') || []; },
    // Demo water box west of Talim Island; random positions used to land on shore.
    demoPosition() {
      return {
        lat: parseFloat((14.395 + Math.random() * 0.018).toFixed(4)),
        lng: parseFloat((121.195 + Math.random() * 0.015).toFixed(4))
      };
    },
    safePosition(log) {
      const p = log || api.gpsLogs.demoPosition();
      const inWater = p.lat >= 14.395 && p.lat <= 14.413 && p.lng >= 121.195 && p.lng <= 121.210;
      return inWater ? p : api.gpsLogs.demoPosition();
    },
    async simulateMovement() {
      const trips = api._get('trips') || [];
      // Move boats on Scheduled and Departed trips (not Held, Arrived, Cancelled)
      const activeBoatIds = trips
        .filter(t => t.trip_status === 'Scheduled' || t.trip_status === 'Departed')
        .map(t => t.boat_id);
      const boats = (api._get('boats') || []).filter(b => activeBoatIds.includes(b.id));
      const logs = api._get('gps_logs') || [];
      boats.forEach(boat => {
        // move proportionally not implemented; simple jitter toward destination
        logs.push({ id:'gps_'+Math.random().toString(36).substring(2,9), boat_id:boat.id, ...api.gpsLogs.demoPosition(), recorded_at:new Date().toISOString() });
      });
      api._set('gps_logs', logs);
      return logs;
    }
  },

  // --- Alerts ---
  alerts: {
    async list() {
      // FUTURE: GET /api/alerts
      return api._get('alerts') || [];
    },
    async create(data) {
      // FUTURE: POST /api/alerts
      const alerts = api._get('alerts') || [];

      // Auto-populate trip_id and boat_id from sender's current trip if not provided
      let tripId = data.trip_id;
      let boatId = data.boat_id;

      if (!tripId || !boatId) {
        const session = api._get('session');
        if (session && session.user_id) {
          // Check if sender is a crew member
          const crewMembers = api._get('crew_members') || [];
          const crewMember = crewMembers.find(m => m.user_id === session.user_id);
          if (crewMember && crewMember.boat_id) {
            // Find the active trip for this boat
            const trips = api._get('trips') || [];
            const activeTrip = trips.find(t =>
              t.boat_id === crewMember.boat_id &&
              (t.trip_status === 'Scheduled' || t.trip_status === 'Departed')
            );
            if (activeTrip) {
              tripId = tripId || activeTrip.id;
              boatId = boatId || activeTrip.boat_id;
            }
          }
        }
      }

      const newAlert = {
        id: 'alt_' + Math.random().toString(36).substring(2, 9),
        trip_id: tripId || null,
        boat_id: boatId || null,
        sent_by_user_id: data.sent_by_user_id || null,
        sender_role: data.sender_role || 'Crew',
        message: data.message || 'SOS Emergency Alert triggered!',
        status: data.status || 'Open',
        created_at: new Date().toISOString(),
        acknowledged_at: data.acknowledged_at || null
      };
      alerts.push(newAlert);
      api._set('alerts', alerts);
      api._broadcastAlertsChanged();
      return newAlert;
    },
    async acknowledge(id, acknowledgedBy = null, csrfToken) {
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const alerts = api._get('alerts') || [];
      const idx = alerts.findIndex(a => a.id === id);
      if (idx === -1) throw new Error('Alert not found.');
      // Idempotent: if already acknowledged, return as-is (no error).
      if (alerts[idx].status === 'Acknowledged') {
        return alerts[idx];
      }
      const oldStatus = alerts[idx].status;
      alerts[idx].status = 'Acknowledged';
      alerts[idx].acknowledged_by = acknowledgedBy || (session && session.user_id) || null;
      alerts[idx].acknowledged_at = new Date().toISOString();
      api._set('alerts', alerts);
      api._broadcastAlertsChanged();
      logAuditAction(session, 'ACKNOWLEDGE', 'alert', id, { oldStatus, newStatus: 'Acknowledged' });
      return alerts[idx];
    }
  },

  // --- Settings ---
  settings: {
    async get() {
      // FUTURE: GET /api/settings
      return api._get('settings') || { discount_rate_senior: 20, discount_rate_pwd: 20, discount_rate_student: 20, cargo_rate_per_kg: 2.00 };
    },
    async update(data, csrfToken) {
      // FUTURE: PUT /api/settings
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const current = api._get('settings') || { discount_rate_senior: 20, discount_rate_pwd: 20, discount_rate_student: 20, cargo_rate_per_kg: 2.00 };
      const oldData = { ...current };
      const updated = { ...current, ...data };
      api._set('settings', updated);
      logAuditAction(session, 'UPDATE', 'settings', 'global', { changes: data, previous: oldData });
      return updated;
    }
  },

  // --- Crew Applications ---
  crewApplications: {
    async list() {
      // FUTURE: GET /api/crew_applications
      return api._get('crew_applications') || [];
    },
    async get(id) {
      // FUTURE: GET /api/crew_applications/:id
      const apps = api._get('crew_applications') || [];
      return apps.find(a => a.id === id);
    },
    async create(data, csrfToken) {
      // FUTURE: POST /api/crew_applications
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const apps = api._get('crew_applications') || [];
      
      // Validate boat if provided
      if (data.boat_id) {
        const boats = api._get('boats') || [];
        const boat = boats.find(b => b.id === data.boat_id);
        if (!boat) throw new Error('Boat not found.');
        if (boat.registration_status !== 'Verified') {
          throw new Error(`Cannot apply to boat "${boat.name}": registration is ${boat.registration_status}. Only Verified boats can accept crew.`);
        }
        if (boat.boat_status !== 'Active') {
          throw new Error(`Cannot apply to boat "${boat.name}": boat is ${boat.boat_status}. Only Active boats can accept crew.`);
        }
      }
      
      const newApp = {
        id: 'capp_' + Math.random().toString(36).substring(2, 9),
        applicant_user_id: data.applicant_user_id || null,
        full_name: data.full_name,
        contact: data.contact || null,
        boat_id: data.boat_id || null,
        stage: data.stage || 'Requested',
        decided_at: data.decided_at || null,
        crew_member_id: data.crew_member_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      apps.push(newApp);
      api._set('crew_applications', apps);
      logAuditAction(session, 'CREATE', 'crew_application', newApp.id, { full_name: newApp.full_name, boat_id: newApp.boat_id });
      return newApp;
    },
    async update(id, data, csrfToken) {
      // FUTURE: PUT /api/crew_applications/:id
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const apps = api._get('crew_applications') || [];
      const idx = apps.findIndex(a => a.id === id);
      if (idx === -1) throw new Error('Crew application not found.');
      const oldData = { ...apps[idx] };
      
      // Validate boat_id if being changed
      if (data.boat_id !== undefined && data.boat_id !== apps[idx].boat_id) {
        if (data.boat_id) {
          const boats = api._get('boats') || [];
          const boat = boats.find(b => b.id === data.boat_id);
          if (!boat) throw new Error('Boat not found.');
          if (boat.registration_status !== 'Verified') {
            throw new Error(`Cannot assign to boat "${boat.name}": registration is ${boat.registration_status}. Only Verified boats can accept crew.`);
          }
          if (boat.boat_status !== 'Active') {
            throw new Error(`Cannot assign to boat "${boat.name}": boat is ${boat.boat_status}. Only Active boats can accept crew.`);
          }
        }
      }
      
      apps[idx] = { ...apps[idx], ...data, updated_at: new Date().toISOString() };
      api._set('crew_applications', apps);
      logAuditAction(session, 'UPDATE', 'crew_application', id, { changes: data, previous: oldData });
      return apps[idx];
    },
    async decide(id, decision, csrfToken) {
      // FUTURE: PATCH /api/crew_applications/:id/decide
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const apps = api._get('crew_applications') || [];
      const idx = apps.findIndex(a => a.id === id);
      if (idx === -1) throw new Error('Crew application not found.');
      const oldStage = apps[idx].stage;
      const accepted = decision === 'Accepted';
      apps[idx] = {
        ...apps[idx],
        stage: decision,
        decided_at: new Date().toISOString(),
        crew_member_id: accepted ? (apps[idx].crew_member_id || null) : null,
        updated_at: new Date().toISOString()
      };
      api._set('crew_applications', apps);
      logAuditAction(session, 'DECIDE', 'crew_application', id, { decision, oldStage });
      return apps[idx];
    },
    async verifyAndProvision(id, data = {}, csrfToken) {
      // FUTURE: POST /api/crew_applications/:id/verify
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const apps = api._get('crew_applications') || [];
      const idx = apps.findIndex(a => a.id === id);
      if (idx === -1) throw new Error('Crew application not found.');
      const app = apps[idx];
      if (app.stage !== 'Pending Admin Verification') {
        throw new Error('Crew application is not awaiting admin verification.');
      }

      // Re-check uniqueness at submission time in case another admin claimed it.
      const users = api._get('users') || [];
      const applicantUserId = app.applicant_user_id || null;
      if (data.email && users.some(u => u.id !== applicantUserId && u.email === data.email)) {
        throw new Error('Email already exists.');
      }
      if (data.username && users.some(u => u.id !== applicantUserId && u.username === data.username)) {
        throw new Error('Username already exists.');
      }

      const { hashPassword } = await import('./auth.js');
      let userId = app.applicant_user_id;
      if (userId) {
        // Reuse the applicant's existing login, but promote it: otherwise they keep
        // their old role and cannot enter /crew/. Apply the email/username the admin
        // edited in the provisioning form instead of silently ignoring them.
        const updates = {
          role: 'crew',
          must_change_password: true,
          password_hash: await hashPassword(data.password || '123')
        };
        if (data.email) updates.email = data.email;
        if (data.username) updates.username = data.username;
        await api.users.update(userId, updates, csrfToken);
      } else {
        const email = data.email || `${app.full_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@boattrack.local`;
        const username = data.username || `crew_${Math.random().toString(36).substring(2, 7)}`;
        const password = data.password || '123';
        // Store a real hash: login and change-password compare hashes only, so a
        // plaintext value here would lock the crew member out of the forced change.
        const newUser = await api.users.create({
          full_name: app.full_name,
          email,
          username,
          password_hash: await hashPassword(password),
          role: 'crew',
          must_change_password: true
        }, csrfToken);
        userId = newUser.id;
      }

      const crewData = {
        boat_id: app.boat_id,
        full_name: app.full_name,
        role: data.role || 'Crew',
        status: 'Active'
      };
      const members = api._get('crew_members') || [];
      let crewMember = members.find(m => m.user_id === userId);
      if (crewMember) {
        crewMember = { ...crewMember, ...crewData };
        const idx = members.findIndex(m => m.id === crewMember.id);
        members[idx] = crewMember;
        api._set('crew_members', members);
      } else {
        crewMember = await api.crewMembers.create({ user_id: userId, ...crewData }, csrfToken);
      }

      apps[idx] = {
        ...app,
        stage: 'Accepted',
        applicant_user_id: userId,
        crew_member_id: crewMember.id,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      api._set('crew_applications', apps);
      logAuditAction(session, 'VERIFY_PROVISION', 'crew_application', id, { userId, crewMemberId: crewMember.id, role: data.role });
      return apps[idx];
    },
    async delete(id, csrfToken) {
      // FUTURE: DELETE /api/crew_applications/:id
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      let apps = api._get('crew_applications') || [];
      const deletedApp = apps.find(a => a.id === id);
      apps = apps.filter(a => a.id !== id);
      api._set('crew_applications', apps);
      logAuditAction(session, 'DELETE', 'crew_application', id, { full_name: deletedApp?.full_name });
      return true;
    }
  },

  // --- Crew Members ---
  crewMembers: {
    async list() {
      // FUTURE: GET /api/crew_members
      return api._get('crew_members') || [];
    },
    async get(id) {
      // FUTURE: GET /api/crew_members/:id
      const members = api._get('crew_members') || [];
      return members.find(m => m.id === id);
    },
    async getByUser(userId) {
      // FUTURE: GET /api/crew_members?user_id=:userId
      const members = api._get('crew_members') || [];
      return members.find(m => m.user_id === userId);
    },
    async create(data) {
      // FUTURE: POST /api/crew_members
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const members = api._get('crew_members') || [];
      const newMember = {
        id: 'cm_' + Math.random().toString(36).substring(2, 9),
        user_id: data.user_id || null,
        boat_id: data.boat_id || null,
        full_name: data.full_name,
        role: data.role || 'Crew',
        status: data.status || 'Active',
        created_at: new Date().toISOString()
      };
      members.push(newMember);
      api._set('crew_members', members);
      logAuditAction(session, 'CREATE', 'crew_member', newMember.id, { user_id: newMember.user_id, boat_id: newMember.boat_id });
      return newMember;
    },
    async update(id, data, csrfToken) {
      // FUTURE: PUT /api/crew_members/:id
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      const members = api._get('crew_members') || [];
      const idx = members.findIndex(m => m.id === id);
      if (idx === -1) throw new Error('Crew member not found.');
      const oldData = { ...members[idx] };
      members[idx] = { ...members[idx], ...data };
      api._set('crew_members', members);
      logAuditAction(session, 'UPDATE', 'crew_member', id, { changes: data, previous: oldData });
      return members[idx];
    },
    async delete(id, csrfToken) {
      // FUTURE: DELETE /api/crew_members/:id
      const session = api._requireRole('administrator');
      api._requireCSRF(csrfToken);
      let members = api._get('crew_members') || [];
      const deletedMember = members.find(m => m.id === id);
      members = members.filter(m => m.id !== id);
      api._set('crew_members', members);
      logAuditAction(session, 'DELETE', 'crew_member', id, { user_id: deletedMember?.user_id });
      return true;
    }
  },

  // --- Crew Attendance ---
  crewAttendance: {
    async list() {
      // FUTURE: GET /api/crew_attendance
      return api._get('crew_attendance') || [];
    },
    async get(id) {
      // FUTURE: GET /api/crew_attendance/:id
      const records = api._get('crew_attendance') || [];
      return records.find(r => r.id === id);
    },
    async listByCrewMember(crewMemberId) {
      // FUTURE: GET /api/crew_attendance?crew_member_id=:id
      const records = api._get('crew_attendance') || [];
      return records.filter(r => r.crew_member_id === crewMemberId);
    },
    async create(data) {
      // FUTURE: POST /api/crew_attendance
      const records = api._get('crew_attendance') || [];
      const newRecord = {
        id: 'att_' + Math.random().toString(36).substring(2, 9),
        crew_member_id: data.crew_member_id,
        date: data.date,
        time_in: data.time_in || null,
        time_out: data.time_out || null,
        status: data.status || 'Present',
        remarks: data.remarks || '',
        created_at: new Date().toISOString()
      };
      records.push(newRecord);
      api._set('crew_attendance', records);
      return newRecord;
    },
    async update(id, data) {
      // FUTURE: PUT /api/crew_attendance/:id
      const records = api._get('crew_attendance') || [];
      const idx = records.findIndex(r => r.id === id);
      if (idx === -1) throw new Error('Attendance record not found.');
      records[idx] = { ...records[idx], ...data };
      api._set('crew_attendance', records);
      return records[idx];
    },
    async delete(id) {
      // FUTURE: DELETE /api/crew_attendance/:id
      let records = api._get('crew_attendance') || [];
      records = records.filter(r => r.id !== id);
      api._set('crew_attendance', records);
      return true;
    }
  },

  // --- Weather Records ---
  weatherRecords: {
    async list() { return api._get('weather_records') || []; },
    async create(data) {
      const recs = api._get('weather_records') || [];
      const r = { id: 'wr_' + Math.random().toString(36).substring(2,9), ...data };
      recs.push(r); api._set('weather_records', recs); return r;
    }
  },
  // --- Risk Scans ---
  riskScans: {
    async list() { return api._get('risk_scans') || []; },
    async listByTrip(tripId) { return (api._get('risk_scans')||[]).filter(r=>r.trip_id===tripId); },
    async create(data) {
      api._requireRole('port_manager');
      const recs = api._get('risk_scans') || [];
      const r = { id: 'rs_' + Math.random().toString(36).substring(2,9), ...data };
      recs.push(r); api._set('risk_scans', recs); return r;
    },
    async update(id,data){ const recs=api._get('risk_scans')||[]; const i=recs.findIndex(r=>r.id===id); if(i>-1){recs[i]={...recs[i],...data};api._set('risk_scans',recs);return recs[i];} return null;}
  },
  // --- Departure Approvals ---
  departureApprovals: {
    async list() { return api._get('departure_approvals') || []; },
    async listByTrip(tripId) { return (api._get('departure_approvals')||[]).filter(a=>a.trip_id===tripId); },
    async create(data) {
      api._requireRole('port_manager');
      const recs = api._get('departure_approvals') || [];
      const trip = (api._get('trips') || []).find(t => t.id === data.trip_id);
      // Suspended boats cannot be cleared for departure.
      if (data.decision === 'Approved' && trip) {
        api._assertBoatActive(trip.boat_id, 'approving its departure');
      }
      const tripRev = trip ? (trip.approval_revision || 0) : 0;
      // Idempotency check: avoid appending duplicate identical decisions for the same trip revision
      const tripApprovals = recs.filter(a => a.trip_id === data.trip_id);
      if (tripApprovals.length > 0) {
        tripApprovals.sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
        const last = tripApprovals[0];
        if (last.decision === data.decision && (last.trip_revision || 0) === tripRev) {
          return last;
        }
      }
      const r = { id: 'da_' + Math.random().toString(36).substring(2,9), ...data, trip_revision: tripRev };
      recs.push(r); api._set('departure_approvals', recs);

      // A Held departure approval is the single source of truth for holding a trip:
      // it drives the trip to Held status so the approval record owns the transition.
      if (data.decision === 'Held' && trip && trip.trip_status !== 'Held') {
        const allTrips = api._get('trips') || [];
        const tIdx = allTrips.findIndex(t => t.id === data.trip_id);
        if (tIdx !== -1) {
          allTrips[tIdx].trip_status = 'Held';
          allTrips[tIdx].held_reason = data.remarks || null;
          allTrips[tIdx].updated_at = new Date().toISOString();
          allTrips[tIdx].approval_revision = (allTrips[tIdx].approval_revision || 0) + 1;
          api._set('trips', allTrips);
        }
      }
      return r;
    },
    async update(id,data){ const recs=api._get('departure_approvals')||[]; const i=recs.findIndex(a=>a.id===id); if(i>-1){recs[i]={...recs[i],...data};api._set('departure_approvals',recs);return recs[i];} return null;}
  },
  // --- Role guard helper ---
  // Administrators intentionally bypass every role check (full-access role).
  // Page-level access is still restricted by auth.requireAuth(), which only
  // allows an administrator into /admin/ pages.
  _requireRole(role) {
    const s = JSON.parse(localStorage.getItem('session')||'null');
    if (!s) throw new Error('Unauthorized: login required.');
    if (s.expires_at && new Date(s.expires_at) < new Date()) {
      localStorage.removeItem('session');
      throw new Error('Session expired. Please log in again.');
    }
    if (s.role !== role && s.role !== 'administrator') throw new Error('Forbidden: ' + role + ' only.');
    return s;
  },

  _requireCSRF(csrfToken) {
    // prototype: CSRF disabled
    return;
  },

  _getSession() {
    return JSON.parse(localStorage.getItem('session') || 'null');
  },

  audit: {
    async list() {
      return api._get('audit_logs') || [];
    }
  }
};

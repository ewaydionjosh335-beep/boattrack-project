/**
 * BoatTrack Data Access Layer (API simulation using localStorage)
 * FUTURE: Replace internal implementations with fetch() calls to Node/Express/Prisma backend.
 */

const STORAGE_KEYS = [
  'users', 'passengers', 'boats', 'boat_documents', 'terminals',
  'routes', 'trips', 'manifests', 'payments', 'bookings',
  'etickets', 'gps_logs', 'alerts', 'settings', 'session',
  'crew_applications', 'crew_members', 'crew_attendance',
  'remittances', 'notifications', 'inspections', 'payment_gateway',
  'weather_records', 'risk_scans', 'departure_approvals'
];

export const api = {
  // Helper for reading/writing storage
  _get(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },

  _set(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
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
  _calculateAmountDue(tripId, bookingType, passengerCount, cargoWeightKg) {
    const settings = api._get('settings') || { cargo_rate_per_kg: 2.00 };
    const ratePerKg = settings.cargo_rate_per_kg !== undefined ? settings.cargo_rate_per_kg : 2.00;

    if (bookingType === 'Cargo') {
      const weight = parseFloat(cargoWeightKg) || 0;
      return parseFloat((weight * ratePerKg).toFixed(2));
    } else {
      const trips = api._get('trips') || [];
      const routes = api._get('routes') || [];
      const trip = trips.find(t => t.id === tripId);
      let fare = 100.00;
      if (trip) {
        const route = routes.find(r => r.id === trip.route_id);
        if (route && route.fare) {
          fare = parseFloat(route.fare);
        }
      }
      const count = parseInt(passengerCount) || 1;
      return parseFloat((fare * count).toFixed(2));
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
      
      if (user.password_hash !== passwordHash) {
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
      return session;
    },

    async logout() {
      // FUTURE: POST /api/auth/logout
      localStorage.removeItem('session');
      return true;
    },

    async impersonate(userId) {
      const users = api._get('users') || [];
      const user = users.find(u => u.id === userId);
      if (!user) throw new Error('User not found.');
      const session = {
        token: 'mock_jwt_token_' + Math.random().toString(36).substring(2),
        user_id: user.id,
        role: user.role,
        full_name: user.full_name,
        expires_at: new Date(Date.now() + 86400000).toISOString()
      };
      api._set('session', session);
      return session;
    },

    async getSession() {
      // FUTURE: GET /api/auth/session
      const session = api._get('session');
      if (!session) return null;
      if (new Date(session.expires_at) < new Date()) {
        localStorage.removeItem('session');
        return null;
      }
      return session;
    },

    async registerUser(userData) {
      // FUTURE: POST /api/auth/register
      const users = api._get('users') || [];
      if (users.some(u => u.email === userData.email)) throw new Error('Email is already registered.');
      if (users.some(u => u.username === userData.username)) throw new Error('Username is already taken.');

      const newUser = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        full_name: userData.full_name,
        email: userData.email,
        username: userData.username,
        password: userData.password || null,
        password_hash: userData.password_hash,
        role: userData.role || 'passenger',
        status: 'Active',
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      api._set('users', users);

      if (newUser.role === 'passenger') {
        const passengers = api._get('passengers') || [];
        const passengerId = 'psg_' + Math.random().toString(36).substring(2, 9);
        const qrPayload = JSON.stringify({
          passenger_id: passengerId,
          full_name: newUser.full_name,
          weight_kg: userData.weight_kg || 65
        });
        const newPassenger = {
          id: passengerId,
          user_id: newUser.id,
          full_name: newUser.full_name,
          weight_kg: userData.weight_kg || 65,
          qr_code: qrPayload,
          created_at: new Date().toISOString()
        };
        passengers.push(newPassenger);
        api._set('passengers', passengers);
        return { user: newUser, passenger: newPassenger };
      }

      return { user: newUser };
    }
  },

  // --- Users & Accounts ---
  users: {
    async list() {
      // FUTURE: GET /api/users
      return api._get('users') || [];
    },
    async create(data) {
      // FUTURE: POST /api/users
      const users = api._get('users') || [];
      if (users.some(u => u.email === data.email)) throw new Error('Email already exists.');
      if (users.some(u => u.username === data.username)) throw new Error('Username already exists.');
      const newUser = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        full_name: data.full_name,
        email: data.email,
        username: data.username,
        password: data.password || null,
        password_hash: data.password_hash || 'hashed_default',
        role: data.role,
        status: data.status || 'Active',
        cluster: data.cluster || null,
        must_change_password: data.must_change_password || false,
        created_at: new Date().toISOString()
      };
      users.push(newUser);
      api._set('users', users);
      return newUser;
    },
    async update(id, data) {
      // FUTURE: PUT /api/users/:id
      const users = api._get('users') || [];
      const idx = users.findIndex(u => u.id === id);
      if (idx === -1) throw new Error('User not found.');
      users[idx] = { ...users[idx], ...data };
      api._set('users', users);
      return users[idx];
    },
    async delete(id) {
      // FUTURE: DELETE /api/users/:id
      let users = api._get('users') || [];
      users = users.filter(u => u.id !== id);
      api._set('users', users);
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
    async create(data) {
      // FUTURE: POST /api/boats
      const boats = api._get('boats') || [];
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
        created_at: new Date().toISOString()
      };
      boats.push(newBoat);
      api._set('boats', boats);
      return newBoat;
    },
    async verify(id, data) {
      // FUTURE: PATCH /api/boats/:id/verify
      const boats = api._get('boats') || [];
      const idx = boats.findIndex(b => b.id === id);
      if (idx === -1) throw new Error('Boat not found.');
      boats[idx] = {
        ...boats[idx],
        registration_status: data.registration_status,
        registration_type: data.registration_type || boats[idx].registration_type,
        verified_by: data.verified_by,
        remarks: data.remarks || '',
        operator_id: data.operator_id !== undefined ? data.operator_id : boats[idx].operator_id,
        boat_status: data.registration_status === 'Verified' ? 'Active' : boats[idx].boat_status
      };
      api._set('boats', boats);
      return boats[idx];
    },
    async updateStatus(id, boat_status, reason = null) {
      // FUTURE: PATCH /api/boats/:id/status
      const boats = api._get('boats') || [];
      const idx = boats.findIndex(b => b.id === id);
      if (idx === -1) throw new Error('Boat not found.');
      boats[idx].boat_status = boat_status;
      api._set('boats', boats);

      if (boat_status === 'Suspended') {
        const trips = api._get('trips') || [];
        let updated = false;
        trips.forEach(t => {
          if (t.boat_id === id && t.trip_status === 'Scheduled') {
            t.trip_status = 'Held';
            t.held_reason = reason || 'Boat suspended';
            t.updated_at = new Date().toISOString();
            updated = true;
          }
        });
        if (updated) {
          api._set('trips', trips);
        }
      }
      return boats[idx];
    },
    async update(id, data) {
      // FUTURE: PUT /api/boats/:id
      const boats = api._get('boats') || [];
      const idx = boats.findIndex(b => b.id === id);
      if (idx === -1) throw new Error('Boat not found.');
      boats[idx] = {
        ...boats[idx],
        ...data,
        passenger_capacity: data.passenger_capacity !== undefined ? parseInt(data.passenger_capacity) : boats[idx].passenger_capacity,
        cargo_capacity: data.cargo_capacity !== undefined ? parseInt(data.cargo_capacity) : boats[idx].cargo_capacity,
        max_load_kg: data.max_load_kg !== undefined ? parseInt(data.max_load_kg) : boats[idx].max_load_kg,
        resubmission_count: data.resubmission_count !== undefined ? parseInt(data.resubmission_count) : (boats[idx].resubmission_count || 0)
      };
      api._set('boats', boats);
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
    async list() {
      // FUTURE: GET /api/terminals
      return api._get('terminals') || [];
    },
    async create(data) {
      // FUTURE: POST /api/terminals
      const terminals = api._get('terminals') || [];
      const newTerm = {
        id: 'term_' + Math.random().toString(36).substring(2, 9),
        name: data.name,
        location: data.location,
        coast_guard_personnel: data.coast_guard_personnel || 'PCG Officer'
      };
      terminals.push(newTerm);
      api._set('terminals', terminals);
      return newTerm;
    },
    async update(id, data) {
      // FUTURE: PUT /api/terminals/:id
      const terminals = api._get('terminals') || [];
      const idx = terminals.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('Terminal not found.');
      terminals[idx] = { ...terminals[idx], ...data };
      api._set('terminals', terminals);
      return terminals[idx];
    },
    async delete(id) {
      // FUTURE: DELETE /api/terminals/:id
      const routes = api._get('routes') || [];
      if (routes.some(r => r.origin_terminal_id === id || r.destination_terminal_id === id)) {
        throw new Error('Cannot delete terminal associated with active routes.');
      }
      let terminals = api._get('terminals') || [];
      terminals = terminals.filter(t => t.id !== id);
      api._set('terminals', terminals);
      return true;
    }
  },

  // --- Routes ---
  routes: {
    async list() {
      // FUTURE: GET /api/routes
      return api._get('routes') || [];
    },
    async create(data) {
      // FUTURE: POST /api/routes
      if (data.origin_terminal_id === data.destination_terminal_id) {
        throw new Error('Origin and destination terminals must be different.');
      }
      const routes = api._get('routes') || [];
      if (routes.some(r => r.origin_terminal_id === data.origin_terminal_id && r.destination_terminal_id === data.destination_terminal_id)) {
        throw new Error('Route already exists.');
      }
      const newRoute = {
        id: 'rte_' + Math.random().toString(36).substring(2, 9),
        origin_terminal_id: data.origin_terminal_id,
        destination_terminal_id: data.destination_terminal_id,
        fare: parseFloat(data.fare) || 100.00,
        est_duration_min: parseInt(data.est_duration_min) || 30
      };
      routes.push(newRoute);
      api._set('routes', routes);
      return newRoute;
    },
    async update(id, data) {
      // FUTURE: PUT /api/routes/:id
      const routes = api._get('routes') || [];
      const idx = routes.findIndex(r => r.id === id);
      if (idx === -1) throw new Error('Route not found.');
      routes[idx] = { ...routes[idx], ...data, fare: parseFloat(data.fare) };
      api._set('routes', routes);
      return routes[idx];
    },
    async delete(id) {
      // FUTURE: DELETE /api/routes/:id
      let routes = api._get('routes') || [];
      routes = routes.filter(r => r.id !== id);
      api._set('routes', routes);
      return true;
    }
  },

  // --- Trips ---
  _validateTrip(boatId, departureTime, excludeTripId = null) {
    const boats = api._get('boats') || [];
    const boat = boats.find(b => b.id === boatId);
    if (!boat) throw new Error('Boat not found.');
    if (boat.registration_status !== 'Verified' || boat.boat_status !== 'Active') {
      throw new Error('Cannot assign an unverified or suspended boat to a trip.');
    }

    const newTime = new Date(departureTime).getTime();
    if (isNaN(newTime)) throw new Error('Invalid departure time.');

    const trips = api._get('trips') || [];
    for (const t of trips) {
      if (excludeTripId && t.id === excludeTripId) continue;
      if (t.boat_id === boatId && t.trip_status !== 'Cancelled' && t.trip_status !== 'Arrived') {
        const existingTime = new Date(t.departure_time).getTime();
        if (Math.abs(newTime - existingTime) < 60 * 60 * 1000) {
          throw new Error(`Conflict: Same boat cannot have two trips within 60 minutes (${t.departure_time}).`);
        }
      }
    }
  },

  trips: {
    async list() {
      // FUTURE: GET /api/trips
      return api._get('trips') || [];
    },
    async create(data) {
      // FUTURE: POST /api/trips
      api._validateTrip(data.boat_id, data.departure_time);
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
        created_by: data.created_by || null,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString()
      };
      trips.push(newTrip);
      api._set('trips', trips);
      return newTrip;
    },
    async updateStatus(id, trip_status, held_reason = null) {
      // FUTURE: PATCH /api/trips/:id/status
      const trips = api._get('trips') || [];
      const idx = trips.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('Trip not found.');
      trips[idx].trip_status = trip_status;
      if (held_reason !== undefined) {
        trips[idx].held_reason = held_reason;
      }
      if (trip_status === 'Departed') {
        trips[idx].departed_at = new Date().toISOString();
        const manifests = api._get('manifests') || [];
        const passengers = api._get('passengers') || [];
        const notifs = api._get('notifications') || [];
        manifests.filter(m => m.trip_id === id).forEach(m => {
          const p = passengers.find(x => x.id === m.passenger_id);
          if (p && p.user_id) notifs.push({ id: 'notif_' + Math.random().toString(36).substring(2, 9), user_id: p.user_id, type: 'Trip', message: 'Your trip has departed.', link: '/passenger/my-trips.html', is_read: false, created_at: new Date().toISOString() });
        });
        api._set('notifications', notifs);
      } else if (trip_status === 'Arrived') {
        trips[idx].arrived_at = new Date().toISOString();
      } else if (trip_status === 'Scheduled') {
        trips[idx].held_reason = null;
      }
      trips[idx].updated_at = new Date().toISOString();
      api._set('trips', trips);
      return trips[idx];
    },
    async update(id, data) {
      // FUTURE: PUT /api/trips/:id
      const trips = api._get('trips') || [];
      const idx = trips.findIndex(t => t.id === id);
      if (idx === -1) throw new Error('Trip not found.');

      const targetBoatId = data.boat_id !== undefined ? data.boat_id : trips[idx].boat_id;
      const targetTime = data.departure_time !== undefined ? data.departure_time : trips[idx].departure_time;

      if (data.boat_id !== undefined || data.departure_time !== undefined) {
        api._validateTrip(targetBoatId, targetTime, id);
      }

      trips[idx] = { ...trips[idx], ...data, updated_at: new Date().toISOString() };
      api._set('trips', trips);
      return trips[idx];
    },
    async markDeparted(id) {
      api._requireRole('port_manager');
      const trips = api._get('trips') || [];
      const idx = trips.findIndex(t=>t.id===id);
      if (idx === -1) throw new Error('Trip not found.');
      if (trips[idx].trip_status !== 'Scheduled') throw new Error('Trip must be Scheduled.');
      const approvals = api._get('departure_approvals') || [];
      const latest = approvals.filter(a=>a.trip_id===id).sort((a,b)=>new Date(b.recorded_at)-new Date(a.recorded_at))[0];
      if (!latest || latest.decision !== 'Approved') throw new Error('Departure approval required.');
      trips[idx].trip_status = 'Departed';
      trips[idx].departed_at = new Date().toISOString();
      trips[idx].updated_at = new Date().toISOString();
      api._set('trips', trips);
      // notify passengers
      const manifests = api._get('manifests') || [];
      const passengers = api._get('passengers') || [];
      const notifs = api._get('notifications') || [];
      manifests.filter(m=>m.trip_id===id).forEach(m=>{
        const p = passengers.find(x=>x.id===m.passenger_id);
        if (p && p.user_id) notifs.push({ id:'notif_'+Math.random().toString(36).substring(2,9), user_id:p.user_id, type:'Trip', message:'Your trip has departed.', link:'/passenger/my-trips.html', is_read:false, created_at:new Date().toISOString()});
      });
      api._set('notifications', notifs);
      return trips[idx];
    },
    async markArrived(id) {
      api._requireRole('port_manager');
      const trips = api._get('trips') || [];
      const idx = trips.findIndex(t=>t.id===id);
      if (idx === -1) throw new Error('Trip not found.');
      if (trips[idx].trip_status !== 'Departed') throw new Error('Trip must be Departed.');
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
        date: data.date || new Date().toISOString().split('T')[0],
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
    async create(data) {
      // FUTURE: POST /api/bookings
      const trips = api._get('trips') || [];
      const trip = trips.find(t => t.id === data.trip_id);
      if (!trip) throw new Error('Trip not found.');
      if (trip.trip_status !== 'Scheduled') throw new Error('Trip is not available for booking.');
      if (new Date(trip.departure_time) < new Date()) throw new Error('Cannot book past trips.');

      const bookings = api._get('bookings') || [];
      const duplicate = bookings.find(b => b.passenger_id === data.passenger_id && b.trip_id === data.trip_id && b.booking_type === data.booking_type && (b.status === 'Reviewing' || b.status === 'Approved'));
      if (duplicate) throw new Error('You already have an open booking for this trip.');

      const bookingType = data.booking_type || 'Passenger';
      const passengerCount = parseInt(data.passenger_count) || 1;
      const cargoWeightKg = parseFloat(data.cargo_weight_kg) || 0;
      const amountDue = api._calculateAmountDue(data.trip_id, bookingType, passengerCount, cargoWeightKg);

      const newBook = {
        id: 'bok_' + Math.random().toString(36).substring(2, 9),
        passenger_id: data.passenger_id || null,
        trip_id: data.trip_id,
        booking_type: bookingType,
        passenger_count: passengerCount,
        cargo_weight_kg: cargoWeightKg,
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
        bookings[idx].cargo_weight_kg
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

  // --- Payment Gateway Adapter (Mock PayMongo) ---
  paymentGateway: {
    async createPayment(booking) {
      // FUTURE: POST /api/payment-gateway/create-payment
      // REAL PAYMONGO INTEGRATION NOTE (REPLACE MOCK HERE):
      // 1. Replace this mock implementation with a fetch() call to backend POST /api/payment-gateway/create-checkout-session
      //    or PayMongo Sources API (e.g. GCash source creation returning checkout_url).
      // 2. Webhook handling: Configure a backend webhook endpoint (POST /api/webhooks/paymongo) listening for
      //    'payment.intent.succeeded' or 'source.chargeable' / 'payment.paid' events. Upon receiving the webhook event,
      //    the backend server automatically updates the payment status to 'Paid', generates the e-ticket (ET-YYYYMMDD-XXXX),
      //    updates the booking status, and issues a notification to the passenger.
      // 3. Client-side polling or redirect: Redirect the browser to the returned PayMongo checkout URL or handle success/failure return URLs.

      const gatewayRecords = api._get('payment_gateway') || [];
      const payId = 'pgw_' + Math.random().toString(36).substring(2, 9);
      const referenceNo = 'PAY_REF_' + Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const gatewayRecord = {
        id: payId,
        booking_id: booking.id,
        amount: booking.amount_due || 0,
        method: 'GCash',
        status: 'Pending',
        reference_no: referenceNo,
        checkout_url: `https://checkout.paymongo.com/mock/${payId}`,
        created_at: new Date().toISOString()
      };
      gatewayRecords.push(gatewayRecord);
      api._set('payment_gateway', gatewayRecords);

      // Create corresponding payment record in payments table
      await api.payments.create({
        booking_id: booking.id,
        boat_id: null,
        method: 'GCash',
        amount: booking.amount_due || 0,
        status: 'Pending',
        reference_no: referenceNo
      });

      return gatewayRecord;
    },
    async getPaymentStatus(id) {
      // FUTURE: GET /api/payment-gateway/status/:id
      // REAL PAYMONGO INTEGRATION NOTE:
      // Replace with fetch() to backend checking PayMongo payment intent / source status.
      const gatewayRecords = api._get('payment_gateway') || [];
      const record = gatewayRecords.find(g => g.id === id || g.booking_id === id);
      return record || { status: 'Pending' };
    }
  },

  // --- GPS Logs ---
  gpsLogs: {
    async list() { return api._get('gps_logs') || []; },
    async simulateMovement() {
      const trips = api._get('trips') || [];
      const departedBoatIds = trips.filter(t=>t.trip_status==='Departed').map(t=>t.boat_id);
      const boats = (api._get('boats') || []).filter(b=>departedBoatIds.includes(b.id));
      const logs = api._get('gps_logs') || [];
      boats.forEach(boat => {
        const t = trips.find(x=>x.boat_id===boat.id && x.trip_status==='Departed');
        // move proportionally not implemented; simple jitter toward destination
        const lat = 14.38 + Math.random() * 0.08;
        const lng = 121.16 + Math.random() * 0.10;
        logs.push({ id:'gps_'+Math.random().toString(36).substring(2,9), boat_id:boat.id, lat:parseFloat(lat.toFixed(4)), lng:parseFloat(lng.toFixed(4)), recorded_at:new Date().toISOString() });
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
      const newAlert = {
        id: 'alt_' + Math.random().toString(36).substring(2, 9),
        trip_id: data.trip_id || null,
        boat_id: data.boat_id || null,
        sent_by_user_id: data.sent_by_user_id || null,
        sender_role: data.sender_role || 'Crew',
        message: data.message || 'SOS Emergency Alert triggered!',
        status: data.status || 'Open',
        created_at: new Date().toISOString(),
        acknowledged_at: data.acknowledged_at || null
      };
      alerts.push(newAlert);
      api._set('alerts', alerts);
      return newAlert;
    },
    async acknowledge(id, acknowledgedBy = null) {
      api._requireRole('port_manager');
      const alerts = api._get('alerts') || [];
      const idx = alerts.findIndex(a => a.id === id);
      if (idx === -1) throw new Error('Alert not found.');
      if (alerts[idx].status === 'Acknowledged') throw new Error('Already acknowledged.');
      alerts[idx].status = 'Acknowledged';
      alerts[idx].acknowledged_by = acknowledgedBy;
      alerts[idx].acknowledged_at = new Date().toISOString();
      api._set('alerts', alerts);
      // notify sender
      const users = api._get('users') || [];
      // no-op mapping; sender notified via status change
      return alerts[idx];
    }
  },

  // --- Settings ---
  settings: {
    async get() {
      // FUTURE: GET /api/settings
      return api._get('settings') || { discount_rate_senior: 20, discount_rate_pwd: 20, discount_rate_student: 20, cargo_rate_per_kg: 2.00 };
    },
    async update(data) {
      // FUTURE: PUT /api/settings
      const current = api._get('settings') || { discount_rate_senior: 20, discount_rate_pwd: 20, discount_rate_student: 20, cargo_rate_per_kg: 2.00 };
      const updated = { ...current, ...data };
      api._set('settings', updated);
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
    async create(data) {
      // FUTURE: POST /api/crew_applications
      const apps = api._get('crew_applications') || [];
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
      return newApp;
    },
    async update(id, data) {
      // FUTURE: PUT /api/crew_applications/:id
      const apps = api._get('crew_applications') || [];
      const idx = apps.findIndex(a => a.id === id);
      if (idx === -1) throw new Error('Crew application not found.');
      apps[idx] = { ...apps[idx], ...data, updated_at: new Date().toISOString() };
      api._set('crew_applications', apps);
      return apps[idx];
    },
    async decide(id, decision) {
      // FUTURE: PATCH /api/crew_applications/:id/decide
      const apps = api._get('crew_applications') || [];
      const idx = apps.findIndex(a => a.id === id);
      if (idx === -1) throw new Error('Crew application not found.');
      const accepted = decision === 'Accepted';
      apps[idx] = {
        ...apps[idx],
        stage: decision,
        decided_at: new Date().toISOString(),
        crew_member_id: accepted ? (apps[idx].crew_member_id || null) : null,
        updated_at: new Date().toISOString()
      };
      api._set('crew_applications', apps);
      return apps[idx];
    },
    async verifyAndProvision(id, data = {}) {
      // FUTURE: POST /api/crew_applications/:id/verify
      const apps = api._get('crew_applications') || [];
      const idx = apps.findIndex(a => a.id === id);
      if (idx === -1) throw new Error('Crew application not found.');
      const app = apps[idx];

      let userId = app.applicant_user_id;
      if (!userId) {
        const email = data.email || `${app.full_name.toLowerCase().replace(/[^a-z0-9]/g, '')}@boattrack.local`;
        const username = data.username || `crew_${Math.random().toString(36).substring(2, 7)}`;
        const password = data.password || '123';
        const newUser = await api.users.create({
          full_name: app.full_name,
          email,
          username,
          password,
          password_hash: password,
          role: 'crew',
          must_change_password: true
        });
        userId = newUser.id;
      }

      const newCrewMember = await api.crewMembers.create({
        user_id: userId,
        boat_id: app.boat_id,
        full_name: app.full_name,
        role: data.role || 'Crew',
        status: 'Active'
      });

      apps[idx] = {
        ...app,
        stage: 'Accepted',
        applicant_user_id: userId,
        crew_member_id: newCrewMember.id,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      api._set('crew_applications', apps);
      return apps[idx];
    },
    async delete(id) {
      // FUTURE: DELETE /api/crew_applications/:id
      let apps = api._get('crew_applications') || [];
      apps = apps.filter(a => a.id !== id);
      api._set('crew_applications', apps);
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
      return newMember;
    },
    async update(id, data) {
      // FUTURE: PUT /api/crew_members/:id
      const members = api._get('crew_members') || [];
      const idx = members.findIndex(m => m.id === id);
      if (idx === -1) throw new Error('Crew member not found.');
      members[idx] = { ...members[idx], ...data };
      api._set('crew_members', members);
      return members[idx];
    },
    async delete(id) {
      // FUTURE: DELETE /api/crew_members/:id
      let members = api._get('crew_members') || [];
      members = members.filter(m => m.id !== id);
      api._set('crew_members', members);
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
      const recs = api._get('departure_approvals') || [];
      const r = { id: 'da_' + Math.random().toString(36).substring(2,9), ...data };
      recs.push(r); api._set('departure_approvals', recs); return r;
    },
    async update(id,data){ const recs=api._get('departure_approvals')||[]; const i=recs.findIndex(a=>a.id===id); if(i>-1){recs[i]={...recs[i],...data};api._set('departure_approvals',recs);return recs[i];} return null;}
  },
  // --- Role guard helper ---
  _requireRole(role) {
    const s = JSON.parse(localStorage.getItem('session')||'null');
    if (!s || s.role !== role) throw new Error('Forbidden: ' + role + ' only.');
  }
};

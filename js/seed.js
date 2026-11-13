import { api } from './api.js';
import { hashPassword } from './auth.js';

export async function seedDatabase(force = false) {
  const existingUsers = api._get('users');
  const existingTrips = api._get('trips');
  const existingBoats = api._get('boats');
  const existingCrew = api._get('crew_members');
  const COMMON_HASH = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';
  if (!force && existingUsers && existingUsers.length > 0 && existingTrips && existingTrips.length > 0 && existingBoats && existingBoats.length > 0 && existingCrew && existingCrew.length > 0) {
    let changed = false;
    existingUsers.forEach(u => {
      if (u.role === 'crew' && u.must_change_password) return;
      u.password_hash = COMMON_HASH;
      u.password = '123';
      changed = true;
    });
    if (changed) api._set('users', existingUsers);
    return;
  }

  if (force) {
    localStorage.clear();
  }

  api._set('settings', { discount_rate_senior: 20, discount_rate_pwd: 20, discount_rate_student: 20, cargo_rate_per_kg: 2.00 });

  const users = [
    {
      id: 'usr_admin',
      full_name: 'System Administrator',
      email: 'admin@boattrack.local',
      username: 'admin',
      password: '123',
      password_hash: COMMON_HASH,
      role: 'administrator',
      status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_mgr',
      full_name: 'Port Manager Juan',
      email: 'manager@boattrack.local',
      username: 'manager',
      password: '123',
      password_hash: COMMON_HASH,
      role: 'port_manager',
      status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_rec',
      full_name: 'Receptionist Maria',
      email: 'receptionist@boattrack.local',
      username: 'receptionist',
      password: '123',
      password_hash: COMMON_HASH,
      role: 'receptionist',
      status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_owner1',
      full_name: 'Capt. Roberto Santos',
      email: 'owner1@boattrack.local',
      username: 'roberto',
      password: '123',
      password_hash: COMMON_HASH,
      role: 'boat_owner',
      status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_oper1',
      full_name: 'Operator Nestor Cruz',
      email: 'operator1@boattrack.local',
      username: 'nestor',
      password: '123',
      password_hash: COMMON_HASH,
      role: 'boat_operator',
      status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_crew1',
      full_name: 'Crew Dante Reyes',
      email: 'crew1@boattrack.local',
      username: 'dante',
      password: '123',
      password_hash: COMMON_HASH,
      role: 'crew',
      status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_psg1',
      full_name: 'Angelica Dela Cruz',
      email: 'passenger@boattrack.local',
      username: 'angelica',
      password: '123',
      password_hash: COMMON_HASH,
      role: 'passenger',
      status: 'Active',
      created_at: new Date().toISOString()
    },
    // Phase 4 New Seed Passenger Accounts
    {
      id: 'usr_psg_review',
      full_name: 'Carlos Roxas',
      email: 'carlos@boattrack.local',
      username: 'pax_review',
      password: '123',
      password_hash: COMMON_HASH,
      role: 'passenger',
      status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_psg_unpaid',
      full_name: 'Elena Blanco',
      email: 'elena@boattrack.local',
      username: 'pax_unpaid',
      password: '123',
      password_hash: COMMON_HASH,
      role: 'passenger',
      status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_psg_paid',
      full_name: 'Marco Alcantara',
      email: 'marco@boattrack.local',
      username: 'pax_paid',
      password: '123',
      password_hash: COMMON_HASH,
      role: 'passenger',
      status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_psg_cargo',
      full_name: 'Diana Cargo',
      email: 'diana@boattrack.local',
      username: 'pax_cargo',
      password: '123',
      password_hash: COMMON_HASH,
      role: 'passenger',
      status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_psg_rejected',
      full_name: 'Felipe Rejected',
      email: 'felipe@boattrack.local',
      username: 'pax_rejected',
      password: '123',
      password_hash: COMMON_HASH,
      role: 'passenger',
      status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 'usr_psg_cancelled',
      full_name: 'Grace Cancelled',
      email: 'grace@boattrack.local',
      username: 'pax_cancelled',
      password: '123',
      password_hash: COMMON_HASH,
      role: 'passenger',
      status: 'Active',
      created_at: new Date().toISOString()
    }
  ];
  api._set('users', users);

  const passengers = [
    {
      id: 'psg_1',
      user_id: 'usr_psg1',
      full_name: 'Angelica Dela Cruz',
      weight_kg: 58,
      qr_code: JSON.stringify({ passenger_id: 'psg_1', full_name: 'Angelica Dela Cruz', weight_kg: 58 }),
      created_at: new Date().toISOString()
    },
    {
      id: 'psg_3',
      user_id: null,
      full_name: 'Juan Carlos Santos',
      weight_kg: 68,
      qr_code: JSON.stringify({ passenger_id: 'psg_3', full_name: 'Juan Carlos Santos', weight_kg: 68 }),
      created_at: new Date().toISOString()
    },
    {
      id: 'psg_senior',
      user_id: null,
      full_name: 'Lolo Jose Bautista',
      weight_kg: 60,
      qr_code: JSON.stringify({ passenger_id: 'psg_senior', full_name: 'Lolo Jose Bautista', weight_kg: 60 }),
      created_at: new Date().toISOString()
    },
    {
      id: 'psg_pwd',
      user_id: null,
      full_name: 'Pedro Reyes PWD',
      weight_kg: 65,
      qr_code: JSON.stringify({ passenger_id: 'psg_pwd', full_name: 'Pedro Reyes PWD', weight_kg: 65 }),
      created_at: new Date().toISOString()
    },
    {
      id: 'psg_student',
      user_id: null,
      full_name: 'Maria Santos Student',
      weight_kg: 50,
      qr_code: JSON.stringify({ passenger_id: 'psg_student', full_name: 'Maria Santos Student', weight_kg: 50 }),
      created_at: new Date().toISOString()
    },
    // Phase 4 passengers
    {
      id: 'psg_review',
      user_id: 'usr_psg_review',
      full_name: 'Carlos Roxas',
      weight_kg: 70,
      qr_code: JSON.stringify({ passenger_id: 'psg_review', full_name: 'Carlos Roxas', weight_kg: 70 }),
      created_at: new Date().toISOString()
    },
    {
      id: 'psg_unpaid',
      user_id: 'usr_psg_unpaid',
      full_name: 'Elena Blanco',
      weight_kg: 55,
      qr_code: JSON.stringify({ passenger_id: 'psg_unpaid', full_name: 'Elena Blanco', weight_kg: 55 }),
      created_at: new Date().toISOString()
    },
    {
      id: 'psg_paid',
      user_id: 'usr_psg_paid',
      full_name: 'Marco Alcantara',
      weight_kg: 72,
      qr_code: JSON.stringify({ passenger_id: 'psg_paid', full_name: 'Marco Alcantara', weight_kg: 72 }),
      created_at: new Date().toISOString()
    },
    {
      id: 'psg_cargo',
      user_id: 'usr_psg_cargo',
      full_name: 'Diana Cargo',
      weight_kg: 62,
      qr_code: JSON.stringify({ passenger_id: 'psg_cargo', full_name: 'Diana Cargo', weight_kg: 62 }),
      created_at: new Date().toISOString()
    },
    {
      id: 'psg_rejected',
      user_id: 'usr_psg_rejected',
      full_name: 'Felipe Rejected',
      weight_kg: 66,
      qr_code: JSON.stringify({ passenger_id: 'psg_rejected', full_name: 'Felipe Rejected', weight_kg: 66 }),
      created_at: new Date().toISOString()
    },
    {
      id: 'psg_cancelled',
      user_id: 'usr_psg_cancelled',
      full_name: 'Grace Cancelled',
      weight_kg: 54,
      qr_code: JSON.stringify({ passenger_id: 'psg_cancelled', full_name: 'Grace Cancelled', weight_kg: 54 }),
      created_at: new Date().toISOString()
    }
  ];
  api._set('passengers', passengers);

  const terminals = [
    { id: 'term_binangonan', name: 'Binangonan Main Port', location: 'Binangonan, Rizal (Main Terminal)', coast_guard_personnel: 'PCG Cdr. Edgardo Mendoza', lat: 14.4645, lng: 121.1918 },
    { id: 'term_talim_bubukal', name: 'Talim Island - Bubukal Wharf', location: 'Cardona/Binangonan, Talim Island', coast_guard_personnel: 'PCG PO2 Ronald Gomez', lat: 14.3650, lng: 121.2140 },
    { id: 'term_talim_libtong', name: 'Talim Island - Libtong Landing', location: 'Binangonan, Talim Island', coast_guard_personnel: 'PCG PO1 Jojo Alcantara', lat: 14.4050, lng: 121.2050 },
    { id: 'term_cardona', name: 'Cardona Port', location: 'Cardona, Rizal', coast_guard_personnel: 'PCG Cpl. Ramil Santos', lat: 14.4815, lng: 121.2285 }
  ];
  api._set('terminals', terminals);

  const routes = [
    { id: 'rte_1', origin_terminal_id: 'term_binangonan', destination_terminal_id: 'term_talim_bubukal', fare: 85.00 },
    { id: 'rte_2', origin_terminal_id: 'term_binangonan', destination_terminal_id: 'term_talim_libtong', fare: 90.00 },
    { id: 'rte_3', origin_terminal_id: 'term_binangonan', destination_terminal_id: 'term_cardona', fare: 60.00 }
  ];
  api._set('routes', routes);

  const boats = [
    {
      id: 'boat_1',
      name: 'M/B Sto. Niño Express',
      owner_id: 'usr_owner1',
      operator_id: 'usr_oper1',
      boat_type: 'Normal',
      registration_type: 'Franchised',
      registration_status: 'Verified',
      verified_by: 'System Administrator',
      remarks: 'All safety gear and life jackets verified.',
      passenger_capacity: 45,
      cargo_capacity: 800,
      max_load_kg: 3500,
      boat_status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 'boat_2',
      name: 'M/B Laguna Star',
      owner_id: 'usr_owner1',
      operator_id: 'usr_oper1',
      boat_type: 'Cargo',
      registration_type: 'Licensed',
      registration_status: 'Verified',
      verified_by: 'System Administrator',
      remarks: 'Cargo hold and outriggers inspected.',
      passenger_capacity: 30,
      cargo_capacity: 1500,
      max_load_kg: 4000,
      boat_status: 'Active',
      created_at: new Date().toISOString()
    },
    {
      id: 'boat_3',
      name: 'M/B Lake Voyager',
      owner_id: 'usr_owner1',
      operator_id: 'usr_oper1',
      boat_type: 'Normal',
      registration_type: 'Franchised',
      registration_status: 'Verified',
      verified_by: 'System Administrator',
      remarks: 'Verified for inter-island passenger transport.',
      passenger_capacity: 40,
      cargo_capacity: 600,
      max_load_kg: 3000,
      boat_status: 'Active',
      created_at: new Date().toISOString()
    }
  ];
  api._set('boats', boats);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const todayNoHyphen = todayStr.replace(/-/g, '');

  const trips = [
    {
      id: 'trp_1',
      boat_id: 'boat_1',
      route_id: 'rte_1',
      departure_time: `${todayStr}T06:30:00`,
      required_passengers: 20,
      eta: `${todayStr}T07:15:00`,
      trip_status: 'Departed',
      held_reason: null,
      created_by: 'usr_mgr',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'trp_2',
      boat_id: 'boat_2',
      route_id: 'rte_2',
      departure_time: `${todayStr}T09:00:00`,
      required_passengers: 15,
      eta: `${todayStr}T10:00:00`,
      trip_status: 'Scheduled',
      held_reason: null,
      created_by: 'usr_mgr',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'trp_3',
      boat_id: 'boat_3',
      route_id: 'rte_1',
      departure_time: `${todayStr}T14:30:00`,
      required_passengers: 25,
      eta: `${todayStr}T15:30:00`,
      trip_status: 'Held',
      held_reason: 'Coast Guard gale warning issued for Laguna de Bay',
      created_by: 'usr_mgr',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'trp_4',
      boat_id: 'boat_1',
      route_id: 'rte_3',
      departure_time: `${tomorrowStr}T07:00:00`,
      required_passengers: 20,
      eta: `${tomorrowStr}T07:45:00`,
      trip_status: 'Scheduled',
      held_reason: null,
      created_by: 'usr_mgr',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    // Phase 4 Arrived Trip for post-arrival inspection testing
    {
      id: 'trp_arrived',
      boat_id: 'boat_3',
      route_id: 'rte_2',
      departure_time: `${yesterdayStr}T08:00:00`,
      required_passengers: 10,
      eta: `${yesterdayStr}T09:00:00`,
      trip_status: 'Arrived',
      held_reason: null,
      created_by: 'usr_mgr',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
  api._set('trips', trips);

  const manifests = [
    {
      id: 'mnf_1',
      trip_id: 'trp_1',
      passenger_id: 'psg_1',
      ticket_no: `BT-${todayNoHyphen}-0001`,
      discount_type: 'Student',
      id_verified: true,
      fare: 68.00,
      baggage_weight_kg: 4.5,
      booking_id: null,
      recorded_by: 'usr_rec',
      created_at: new Date().toISOString()
    },
    {
      id: 'mnf_2',
      trip_id: 'trp_1',
      passenger_id: 'psg_senior',
      ticket_no: `BT-${todayNoHyphen}-0002`,
      discount_type: 'Senior',
      id_verified: true,
      fare: 68.00,
      baggage_weight_kg: 3.0,
      booking_id: 'bok_1',
      recorded_by: 'usr_rec',
      created_at: new Date().toISOString()
    },
    {
      id: 'mnf_3',
      trip_id: 'trp_2',
      passenger_id: 'psg_pwd',
      ticket_no: `BT-${todayNoHyphen}-0003`,
      discount_type: 'PWD',
      id_verified: true,
      fare: 72.00,
      baggage_weight_kg: 5.0,
      booking_id: 'bok_2',
      recorded_by: 'usr_rec',
      created_at: new Date().toISOString()
    },
    {
      id: 'mnf_4',
      trip_id: 'trp_2',
      passenger_id: 'psg_3',
      ticket_no: `BT-${todayNoHyphen}-0004`,
      discount_type: 'None',
      id_verified: false,
      fare: 90.00,
      baggage_weight_kg: 10.0,
      booking_id: null,
      recorded_by: 'usr_rec',
      created_at: new Date().toISOString()
    }
  ];
  api._set('manifests', manifests);

  const remittances = [
    {
      id: 'rem_1',
      boat_id: 'boat_1',
      date: todayStr,
      total_amount: 136.00,
      received_by_crew_id: 'cm_1',
      recorded_by: 'usr_rec',
      remitted_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    }
  ];
  api._set('remittances', remittances);

  const crewMembers = [
    {
      id: 'cm_1',
      user_id: 'usr_crew1',
      boat_id: 'boat_1',
      full_name: 'Crew Dante Reyes',
      role: 'Crew',
      status: 'Active',
      created_at: new Date().toISOString()
    }
  ];
  api._set('crew_members', crewMembers);

  const payments = [
    {
      id: 'pay_1',
      manifest_id: 'mnf_1',
      booking_id: null,
      boat_id: 'boat_1',
      method: 'GCash',
      amount: 68.00,
      status: 'Paid',
      reference_no: 'REF111222333',
      recorded_by: 'usr_rec',
      remittance_id: 'rem_1',
      created_at: new Date().toISOString()
    },
    {
      id: 'pay_2',
      manifest_id: 'mnf_2',
      booking_id: 'bok_1',
      boat_id: 'boat_1',
      method: 'Cash',
      amount: 68.00,
      status: 'Paid',
      reference_no: null,
      recorded_by: 'usr_rec',
      remittance_id: 'rem_1',
      created_at: new Date().toISOString()
    },
    {
      id: 'pay_3',
      manifest_id: 'mnf_3',
      booking_id: 'bok_2',
      boat_id: 'boat_2',
      method: 'GCash',
      amount: 72.00,
      status: 'Paid',
      reference_no: 'REF444555666',
      recorded_by: 'usr_rec',
      remittance_id: null,
      created_at: new Date().toISOString()
    },
    {
      id: 'pay_4',
      manifest_id: 'mnf_4',
      booking_id: null,
      boat_id: 'boat_2',
      method: 'Cash',
      amount: 90.00,
      status: 'Pending',
      reference_no: null,
      recorded_by: 'usr_rec',
      remittance_id: null,
      created_at: new Date().toISOString()
    },
    // Phase 4 payments for paid booking and cargo booking
    {
      id: 'pay_pax_paid',
      manifest_id: null,
      booking_id: 'bok_pax_paid',
      boat_id: 'boat_1',
      method: 'GCash',
      amount: 85.00,
      status: 'Paid',
      reference_no: 'GCASH_REF_MARCO01',
      recorded_by: 'usr_rec',
      remittance_id: null,
      created_at: new Date().toISOString()
    },
    {
      id: 'pay_cargo',
      manifest_id: null,
      booking_id: 'bok_cargo',
      boat_id: 'boat_2',
      method: 'GCash',
      amount: 200.00,
      status: 'Paid',
      reference_no: 'GCASH_REF_CARGO01',
      recorded_by: 'usr_rec',
      remittance_id: null,
      created_at: new Date().toISOString()
    }
  ];
  api._set('payments', payments);

  const bookings = [
    {
      id: 'bok_1',
      passenger_id: 'psg_senior',
      trip_id: 'trp_1',
      booking_type: 'Passenger',
      passenger_count: 1,
      cargo_weight_kg: 3.0,
      cargo_area_sqm: 0.5,
      cargo_crowding: 'Low',
      notes: 'Senior booking',
      status: 'Approved',
      amount_due: 85.00,
      reviewed_by: 'usr_mgr',
      reviewed_at: new Date().toISOString(),
      review_remarks: 'Senior documents verified and payment collected.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'bok_2',
      passenger_id: 'psg_pwd',
      trip_id: 'trp_2',
      booking_type: 'Passenger',
      passenger_count: 1,
      cargo_weight_kg: 5.0,
      cargo_area_sqm: 0.8,
      cargo_crowding: 'Low',
      notes: 'PWD booking',
      status: 'Approved',
      amount_due: 90.00,
      reviewed_by: 'usr_mgr',
      reviewed_at: new Date().toISOString(),
      review_remarks: 'PWD ID verified and payment collected.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'bok_3',
      passenger_id: 'psg_1',
      trip_id: 'trp_4',
      booking_type: 'Passenger',
      passenger_count: 2,
      cargo_weight_kg: 8.0,
      cargo_area_sqm: 1.0,
      cargo_crowding: 'Medium',
      notes: 'Family trip',
      status: 'Reviewing',
      amount_due: 120.00,
      reviewed_by: null,
      reviewed_at: null,
      review_remarks: 'Awaiting payment confirmation upload.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'bok_4',
      passenger_id: 'psg_3',
      trip_id: 'trp_3',
      booking_type: 'Passenger',
      passenger_count: 1,
      cargo_weight_kg: 4.0,
      cargo_area_sqm: 0.5,
      cargo_crowding: 'Low',
      notes: 'Weather check',
      status: 'Reviewing',
      amount_due: 85.00,
      reviewed_by: null,
      reviewed_at: null,
      review_remarks: 'Pending review for Trip 3 weather status.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'bok_5',
      passenger_id: 'psg_student',
      trip_id: 'trp_3',
      booking_type: 'Passenger',
      passenger_count: 1,
      cargo_weight_kg: 2.0,
      cargo_area_sqm: 0.3,
      cargo_crowding: 'Low',
      notes: 'Student booking',
      status: 'Rejected',
      amount_due: 85.00,
      reviewed_by: 'usr_mgr',
      reviewed_at: new Date().toISOString(),
      review_remarks: 'Trip is currently held due to Coast Guard gale warning.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    // Phase 4 bookings covering all statuses + cargo booking
    {
      id: 'bok_pax_review',
      passenger_id: 'psg_review',
      trip_id: 'trp_2',
      booking_type: 'Passenger',
      passenger_count: 1,
      cargo_weight_kg: 2.0,
      cargo_area_sqm: 0.2,
      cargo_crowding: 'Low',
      notes: 'Reviewing booking by Carlos',
      status: 'Reviewing',
      amount_due: 90.00,
      reviewed_by: null,
      reviewed_at: null,
      review_remarks: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'bok_pax_unpaid',
      passenger_id: 'psg_unpaid',
      trip_id: 'trp_2',
      booking_type: 'Passenger',
      passenger_count: 1,
      cargo_weight_kg: 0,
      cargo_area_sqm: 0,
      cargo_crowding: 'Low',
      notes: 'Approved unpaid booking by Elena',
      status: 'Approved',
      amount_due: 90.00,
      reviewed_by: 'usr_mgr',
      reviewed_at: new Date().toISOString(),
      review_remarks: 'Approved. Awaiting GCash payment settlement.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'bok_pax_paid',
      passenger_id: 'psg_paid',
      trip_id: 'trp_1',
      booking_type: 'Passenger',
      passenger_count: 1,
      cargo_weight_kg: 3.0,
      cargo_area_sqm: 0.4,
      cargo_crowding: 'Low',
      notes: 'Approved paid booking with e-ticket by Marco',
      status: 'Approved',
      amount_due: 85.00,
      reviewed_by: 'usr_mgr',
      reviewed_at: new Date().toISOString(),
      review_remarks: 'Approved and payment verified via GCash.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'bok_cargo',
      passenger_id: 'psg_cargo',
      trip_id: 'trp_2',
      booking_type: 'Cargo',
      passenger_count: 0,
      cargo_weight_kg: 100.0,
      cargo_area_sqm: 4.0,
      cargo_crowding: 'Medium',
      notes: 'Commercial cargo shipment of dried fish and produce',
      status: 'Approved',
      amount_due: 200.00,
      reviewed_by: 'usr_mgr',
      reviewed_at: new Date().toISOString(),
      review_remarks: 'Cargo weight and payment verified.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'bok_pax_rejected',
      passenger_id: 'psg_rejected',
      trip_id: 'trp_3',
      booking_type: 'Passenger',
      passenger_count: 1,
      cargo_weight_kg: 0,
      cargo_area_sqm: 0,
      cargo_crowding: 'Low',
      notes: 'Rejected booking by Felipe',
      status: 'Rejected',
      amount_due: 85.00,
      reviewed_by: 'usr_mgr',
      reviewed_at: new Date().toISOString(),
      review_remarks: 'Rejected due to incomplete verification documents.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'bok_pax_cancelled',
      passenger_id: 'psg_cancelled',
      trip_id: 'trp_4',
      booking_type: 'Passenger',
      passenger_count: 1,
      cargo_weight_kg: 0,
      cargo_area_sqm: 0,
      cargo_crowding: 'Low',
      notes: 'Cancelled booking by Grace',
      status: 'Cancelled',
      amount_due: 60.00,
      reviewed_by: null,
      reviewed_at: null,
      review_remarks: 'Cancelled by passenger prior to approval.',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
  api._set('bookings', bookings);

  const etickets = [
    {
      id: 'etk_1',
      booking_id: 'bok_pax_paid',
      ticket_no: `ET-${todayNoHyphen}-0001`,
      passenger_name: 'Marco Alcantara',
      gcash_ref: 'GCASH_REF_MARCO01',
      issued_at: new Date().toISOString()
    },
    {
      id: 'etk_2',
      booking_id: 'bok_cargo',
      ticket_no: `ET-${todayNoHyphen}-0002`,
      passenger_name: 'Diana Cargo (Cargo Shipment)',
      gcash_ref: 'GCASH_REF_CARGO01',
      issued_at: new Date().toISOString()
    }
  ];
  api._set('etickets', etickets);

  const alerts = [
    {
      id: 'alt_1',
      trip_id: 'trp_1',
      boat_id: 'boat_1',
      sent_by_user_id: 'usr_crew1',
      sender_role: 'Crew',
      message: 'Strong winds and rough waters encountered near Talim channel.',
      status: 'Open',
      created_at: new Date().toISOString(),
      acknowledged_at: null
    },
    {
      id: 'alt_2',
      trip_id: 'trp_1',
      boat_id: 'boat_1',
      sent_by_user_id: 'usr_crew1',
      sender_role: 'Crew',
      message: 'Engine warning light flickered near Cardona wharf.',
      status: 'Open',
      created_at: new Date().toISOString(),
      acknowledged_at: null
    }
  ];
  api._set('alerts', alerts);

  const notifications = [
    {
      id: 'notif_1',
      user_id: 'usr_psg_paid',
      type: 'Booking',
      message: 'Your booking for Trip 1 has been approved and paid. E-Ticket issued.',
      link: '/passenger/my-bookings.html',
      is_read: false,
      created_at: new Date().toISOString()
    },
    {
      id: 'notif_2',
      user_id: 'usr_psg_cargo',
      type: 'Cargo',
      message: 'Your cargo booking for Trip 2 has been approved and paid.',
      link: '/passenger/my-bookings.html',
      is_read: true,
      created_at: new Date().toISOString()
    }
  ];
  api._set('notifications', notifications);

  const inspections = [
    {
      id: 'insp_1',
      trip_id: 'trp_1',
      boat_id: 'boat_1',
      inspection_type: 'Pre-departure',
      items: [
        { item: 'Life jackets', result: 'Pass', note: 'All 45 check out' },
        { item: 'Engine', result: 'Pass', note: 'Smooth idle' },
        { item: 'Fuel', result: 'Pass', note: 'Full tank' },
        { item: 'Hull', result: 'Pass', note: 'No leaks' },
        { item: 'Passenger count', result: 'Pass', note: 'Count matches manifest' }
      ],
      counted_passengers: 2,
      manifest_count: 2,
      overall: 'Passed',
      remarks: 'All pre-departure safety items verified by PCG.',
      inspected_by: 'PCG Officer Cdr. Edgardo Mendoza',
      inspected_at: new Date().toISOString()
    },
    {
      id: 'insp_2',
      trip_id: 'trp_arrived',
      boat_id: 'boat_3',
      inspection_type: 'Post-arrival',
      items: [
        { item: 'Life jackets', result: 'Pass', note: 'Stowed properly' },
        { item: 'Engine', result: 'Fail', note: 'Overheating reported upon arrival at dock' },
        { item: 'Fuel', result: 'Pass', note: 'Sufficient reserve' },
        { item: 'Hull', result: 'Pass', note: 'Sound structural condition' },
        { item: 'Passenger count', result: 'Pass', note: 'Exact manifest count disembarked' }
      ],
      counted_passengers: 10,
      manifest_count: 10,
      overall: 'Failed',
      remarks: 'Engine overheating issue requires maintenance inspection before next clearance.',
      inspected_by: 'PCG PO1 Jojo Alcantara',
      inspected_at: new Date().toISOString()
    }
  ];
  api._set('inspections', inspections);
}

// Runnable check for the provisioning / verification / wipe fixes.
// Runs the browser modules in Node via a temporary .mjs copy.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(path.join(tmpdir(), 'boat-check-'));
for (const file of ['api.js', 'auth.js', 'seed.js']) {
  const src = (await readFile(new URL(`../js/${file}`, import.meta.url), 'utf8'))
    .replace(/(['"]\.\/[a-z]+)\.js(['"])/g, '$1.mjs$2');
  await writeFile(path.join(dir, file.replace(/\.js$/, '.mjs')), src);
}
// weatherService has no relative imports; copy flat so Node treats it as ESM.
await writeFile(
  path.join(dir, 'weatherService.mjs'),
  await readFile(new URL('../js/services/weatherService.js', import.meta.url), 'utf8')
);

const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
  clear: () => store.clear()
};
globalThis.window = { crypto: globalThis.crypto };

const { api, ensureCSRFToken } = await import(pathToFileURL(path.join(dir, 'api.mjs')));
const { seedDatabase } = await import(pathToFileURL(path.join(dir, 'seed.mjs')));
const { weatherService } = await import(pathToFileURL(path.join(dir, 'weatherService.mjs')));

const session = { user_id: 'usr_admin', role: 'administrator', expires_at: new Date(Date.now() + 3600e3).toISOString() };
const csrfToken = ensureCSRFToken();
const seedBoat = { id: 'b1', name: 'B1', operator_id: 'usr_op', registration_status: 'Pending', boat_status: 'Active', boat_type: 'Passenger Ferry', registration_type: 'Franchised', passenger_capacity: 10, max_load_kg: 2000 };
const seedUsers = [
  { id: 'usr_admin', full_name: 'Admin', role: 'administrator', status: 'Active' },
  { id: 'usr_op', full_name: 'Operator', role: 'boat_operator', status: 'Active' },
  { id: 'usr_suspended', full_name: 'Suspended', role: 'boat_operator', status: 'Suspended' },
  { id: 'usr_pax', full_name: 'Applicant', role: 'passenger', status: 'Active', password_hash: 'old-hash' }
];

// Admin-only operations reject non-admin sessions at the API layer.
api._set('session', { ...session, user_id: 'usr_pax', role: 'passenger' });
await assert.rejects(api.users.create({ full_name: 'X', username: 'x' }), /Forbidden/);
await assert.rejects(api.users.delete('usr_op'), /Forbidden/);
await assert.rejects(api.boats.verify('b1', { registration_status: 'Verified' }), /Forbidden/);
await assert.rejects(api.routes.create({ origin_terminal_id: 'a', destination_terminal_id: 'b', fare: 1 }), /Forbidden/);
await assert.rejects(api.terminals.create({ name: 'T', location: 'L' }), /Forbidden/);
await assert.rejects(api.settings.update({ cargo_rate_per_kg: 1 }), /Forbidden/);
await assert.rejects(api.crewApplications.verifyAndProvision('c1', {}), /Forbidden/);

// Boat approval: documents, active operator, and no silent un-suspension.
api._set('session', session);
api._set('users', seedUsers);
api._set('boats', [seedBoat]);
api._set('boat_documents', []);
await assert.rejects(api.boats.verify('b1', { registration_status: 'Verified', operator_id: 'usr_op' }, csrfToken), /documents/);
api._set('boat_documents', [{ id: 'd1', boat_id: 'b1' }]);
await assert.rejects(api.boats.verify('b1', { registration_status: 'Verified', operator_id: null }, csrfToken), /active boat operator/);
await assert.rejects(api.boats.verify('b1', { registration_status: 'Verified', operator_id: 'usr_suspended' }, csrfToken), /active boat operator/);

let boat = await api.boats.verify('b1', { registration_status: 'Verified', operator_id: 'usr_op' }, csrfToken);
assert.equal(boat.registration_status, 'Verified');
api._set('boats', [{ ...boat, boat_status: 'Suspended' }]);
boat = await api.boats.verify('b1', { registration_status: 'Verified', operator_id: 'usr_op' }, csrfToken);
assert.equal(boat.boat_status, 'Suspended');

// Rejection requires a reason at the API level, not only in the page.
api._set('boats', [seedBoat]);
await assert.rejects(api.boats.verify('b1', { registration_status: 'Rejected' }, csrfToken), /reason/);
await assert.rejects(api.boats.verify('b1', { registration_status: 'Rejected', remarks: '   ' }, csrfToken), /reason/);
const rejectedBoat = await api.boats.verify('b1', { registration_status: 'Rejected', remarks: 'Hull damage' }, csrfToken);
assert.equal(rejectedBoat.registration_status, 'Rejected');

// Suspension holds scheduled trips and notifies passengers + operator.
api._set('boats', [seedBoat]);
api._set('trips', [{ id: 't1', boat_id: 'b1', trip_status: 'Scheduled' }]);
api._set('manifests', [{ id: 'm1', trip_id: 't1', passenger_id: 'p1' }]);
api._set('passengers', [{ id: 'p1', user_id: 'usr_pax' }]);
api._set('notifications', []);
await api.boats.updateStatus('b1', 'Suspended', 'Maintenance', csrfToken);
assert.equal(api._get('trips')[0].trip_status, 'Held');
const notifs = api._get('notifications');
assert.ok(notifs.some(n => n.user_id === 'usr_pax'), 'passenger notified');
assert.ok(notifs.some(n => n.user_id === 'usr_op'), 'operator notified');

// Reactivation releases only trips the suspension held; manually held trips stay held.
api._set('boats', [seedBoat]);
api._set('trips', [
  { id: 't1', boat_id: 'b1', trip_status: 'Scheduled' },
  { id: 't2', boat_id: 'b1', trip_status: 'Held', held_reason: 'Awaiting payment review' }
]);
api._set('manifests', []);
api._set('notifications', []);
await api.boats.updateStatus('b1', 'Suspended', 'Maintenance', csrfToken);
assert.equal(api._get('trips')[0].trip_status, 'Held');
assert.equal(api._get('trips')[1].trip_status, 'Held', 'manually held trip untouched');
await api.boats.updateStatus('b1', 'Active', null, csrfToken);
const after = api._get('trips');
assert.equal(after[0].trip_status, 'Scheduled', 'suspension-held trip resumed');
assert.equal(after[1].trip_status, 'Held', 'manual hold survives reactivation');

// Suspension is a hard block for release, coast guard approval, and departure.
api._set('boats', [seedBoat]);
api._set('trips', [{ id: 't1', boat_id: 'b1', route_id: 'r1', trip_status: 'Scheduled', approval_revision: 0 }]);
api._set('departure_approvals', []);
await api.boats.updateStatus('b1', 'Suspended', 'Hull damage', csrfToken);
await assert.rejects(api.departureApprovals.create({ trip_id: 't1', decision: 'Approved', recorded_at: new Date().toISOString() }), /Reactivate/);
await assert.rejects(api.trips.updateStatus('t1', 'Scheduled'), /Reactivate/);
// Even a Scheduled trip with a current approval cannot depart while suspended.
api._set('trips', [{ id: 't1', boat_id: 'b1', route_id: 'r1', trip_status: 'Scheduled', approval_revision: 0 }]);
api._set('departure_approvals', [{ id: 'da_seed', trip_id: 't1', decision: 'Approved', trip_revision: 0, recorded_at: new Date().toISOString() }]);
await assert.rejects(api.trips.markDeparted('t1'), /Reactivate/);
// Reactivation is the only way back.
await api.boats.updateStatus('b1', 'Active', null, csrfToken);
assert.equal(api._get('trips')[0].trip_status, 'Scheduled', 'reactivation releases suspension-held trips');
const cleared = await api.departureApprovals.create({ trip_id: 't1', decision: 'Approved', recorded_at: new Date().toISOString() });
assert.equal(cleared.decision, 'Approved', 'approval works once the boat is active');

// Cached weather re-selects the hour for the caller's target time.
const hour = (t, temp) => ({ for_time: t, temperature_c: temp, wind_speed_kmh: 10, wind_gust_kmh: 15, precipitation_probability: 10, precipitation_mm: 0, weather_code: 1, visibility_m: 10000 });
localStorage.setItem('weather_cache_term1', JSON.stringify({
  terminal_id: 'term1', fetched_at: Date.now(),
  for_time: '2026-01-01T10:00:00+08:00', temperature_c: 30,
  hourly: [hour('2026-01-01T10:00:00+08:00', 30), hour('2026-01-01T14:00:00+08:00', 20)]
}));
const cachedWeather = await weatherService.fetchForTerminal({ id: 'term1', lat: 1, lng: 1 }, '2026-01-01T14:00:00+08:00');
assert.equal(cachedWeather.temperature_c, 20, 'cache hit uses the target hour, not the cached hour');

// The forecast is not truncated to the first 24 hours.
const times = [], temps = [];
for (let i = 0; i < 72; i++) {
  times.push(new Date(Date.UTC(2026, 0, 1, 0) + i * 3600e3).toISOString());
  temps.push(i);
}
globalThis.fetch = async () => ({
  ok: true,
  json: async () => ({ hourly: {
    time: times,
    temperature_2m: temps,
    precipitation_probability: times.map(() => 1),
    precipitation: times.map(() => 0),
    weather_code: times.map(() => 1),
    wind_speed_10m: times.map(() => 10),
    wind_gusts_10m: times.map(() => 15),
    visibility: times.map(() => 10000)
  } })
});
const farWeather = await weatherService.fetchForTerminal({ id: 'term_far', lat: 1, lng: 1 }, times[40]);
assert.equal(farWeather.temperature_c, 40, 'reads hourly entries beyond the first 24 hours');

// Manual refresh bypasses a fresh cache; automatic reads still use it.
localStorage.setItem('weather_cache_term_force', JSON.stringify({
  terminal_id: 'term_force', fetched_at: Date.now(), for_time: times[0], temperature_c: 5,
  hourly: [hour(times[0], 5)]
}));
const cachedNoForce = await weatherService.fetchForTerminal({ id: 'term_force', lat: 1, lng: 1 }, times[0]);
assert.equal(cachedNoForce.temperature_c, 5, 'default read uses the cache');
const forcedWeather = await weatherService.fetchForTerminal({ id: 'term_force', lat: 1, lng: 1 }, times[0], { force: true });
assert.equal(forcedWeather.temperature_c, 0, 'force bypasses the cache');

// Schedule edits are allowed with an existing approval: the revision bump expires it.
api._set('boats', [{ ...seedBoat, registration_status: 'Verified', boat_status: 'Active' }]);
api._set('trips', [{ id: 't_edit', boat_id: 'b1', route_id: 'r1', departure_time: new Date(Date.now() + 3600e3).toISOString(), required_passengers: 5, trip_status: 'Scheduled', approval_revision: 0 }]);
api._set('manifests', []);
api._set('bookings', []);
api._set('departure_approvals', [{ id: 'da_edit', trip_id: 't_edit', decision: 'Approved', trip_revision: 0, recorded_at: new Date().toISOString() }]);
const editedTrip = await api.trips.update('t_edit', { departure_time: new Date(Date.now() + 7200e3).toISOString() });
assert.equal(editedTrip.approval_revision, 1, 'edit bumps approval_revision, expiring the old clearance');

// Provisioning an existing applicant promotes the account and reuses one crew row.
api._set('crew_applications', [{ id: 'c1', applicant_user_id: 'usr_pax', full_name: 'Applicant', boat_id: 'b1', stage: 'Pending Admin Verification' }]);
api._set('crew_members', []);
await api.crewApplications.verifyAndProvision('c1', { password: 'new-pass', email: 'promoted@x.local', username: 'promoted' }, csrfToken);
const promoted = api._get('users').find(u => u.id === 'usr_pax');
assert.equal(promoted.role, 'crew');
assert.equal(promoted.status, 'Active');
assert.equal(promoted.must_change_password, true);
assert.equal(promoted.email, 'promoted@x.local', 'admin-edited email is applied');
assert.equal(promoted.username, 'promoted', 'admin-edited username is applied');
assert.notEqual(promoted.password_hash, 'old-hash');
const members = api._get('crew_members').filter(m => m.user_id === 'usr_pax');
assert.equal(members.length, 1);
assert.equal(members[0].boat_id, 'b1');

// Discount rates apply to API-calculated passenger bookings, not just walk-ins.
api._set('settings', { discount_rate_senior: 20, discount_rate_pwd: 10, discount_rate_student: 5, cargo_rate_per_kg: 2.00 });
api._set('routes', [{ id: 'rte_1', origin_terminal_id: 'a', destination_terminal_id: 'b', fare: 100 }]);
api._set('trips', [{ id: 'trip_1', route_id: 'rte_1', trip_status: 'Scheduled', departure_time: new Date(Date.now() + 86400e3).toISOString() }]);
assert.equal(api._calculateAmountDue('trip_1', 'Passenger', 2, 0, 'Adult'), 200);
assert.equal(api._calculateAmountDue('trip_1', 'Passenger', 2, 0, 'Senior'), 160);
assert.equal(api._calculateAmountDue('trip_1', 'Passenger', 2, 0, 'PWD'), 180);
assert.equal(api._calculateAmountDue('trip_1', 'Passenger', 2, 0, 'Student'), 190);
const discountBooking = await api.bookings.create({ passenger_id: 'psg_discount', trip_id: 'trip_1', booking_type: 'Passenger', passenger_count: 1, discount_type: 'Student' });
assert.equal(discountBooking.amount_due, 95);
api._set('settings', { discount_rate_senior: 20, discount_rate_pwd: 10, discount_rate_student: 50, cargo_rate_per_kg: 2.00 });
const reviewed = await api.bookings.updateReview(discountBooking.id, { status: 'Approved' });
assert.equal(reviewed.amount_due, 50);

// Route edits cannot create duplicates.
api._set('terminals', [
  { id: 'a', name: 'Terminal A', location: 'A' },
  { id: 'b', name: 'Terminal B', location: 'B' },
  { id: 'c', name: 'Terminal C', location: 'C' }
]);
api._set('routes', [
  { id: 'rte_1', origin_terminal_id: 'a', destination_terminal_id: 'b', fare: 100 },
  { id: 'rte_2', origin_terminal_id: 'a', destination_terminal_id: 'c', fare: 100 }
]);
await assert.rejects(api.routes.update('rte_2', { origin_terminal_id: 'a', destination_terminal_id: 'b', fare: 100 }, csrfToken), /already exists/);
assert.equal(api._get('routes').find(r => r.id === 'rte_2').destination_terminal_id, 'c');

// Route creation rejects the same pair in either direction.
await assert.rejects(api.routes.create({ origin_terminal_id: 'a', destination_terminal_id: 'b', fare: 100 }, csrfToken), /already exists/);
await assert.rejects(api.routes.create({ origin_terminal_id: 'b', destination_terminal_id: 'a', fare: 100 }, csrfToken), /already exists/);
assert.equal(api._get('routes').length, 2);
await api.routes.create({ origin_terminal_id: 'b', destination_terminal_id: 'c', fare: 100 }, csrfToken);
assert.equal(api._get('routes').length, 3);

// Terminal coordinates are validated and coerced before Leaflet sees them.
  api._set('terminals', [{ id: 'term_1', name: 'Terminal', location: 'Loc', coast_guard_personnel: 'PCG', lat: 14.4, lng: 121.2 }]);
  await assert.rejects(api.terminals.create({ name: 'Bad', location: 'Loc', lat: 'abc', lng: '121' }, csrfToken), /Latitude/);
  // Partial coordinates (only one provided) should not update - they keep existing values
  const partialUpdate = await api.terminals.update('term_1', { lat: '14.5', lng: '' }, csrfToken);
  assert.equal(partialUpdate.lat, 14.4); // lat unchanged because lng was empty
  assert.equal(partialUpdate.lng, 121.2); // lng unchanged
await assert.rejects(api.terminals.update('term_1', { lat: '14.5', lng: 'not-a-number' }, csrfToken), /Longitude/);
const fixedTerminal = await api.terminals.update('term_1', { lat: '14.5', lng: '121.25' }, csrfToken);
  assert.equal(fixedTerminal.lat, 14.5);
  assert.equal(fixedTerminal.lng, 121.25);
  const clearedTerminal = await api.terminals.update('term_1', { lat: null, lng: null }, csrfToken);
  assert.equal(clearedTerminal.lat, null);
  assert.equal(clearedTerminal.lng, null);

// GPS simulation moves boats on any active trip, not only Departed ones.
api._set('boats', [{ id: 'b1' }, { id: 'b2' }]);
api._set('trips', [
  { id: 't1', boat_id: 'b1', trip_status: 'Scheduled' },
  { id: 't2', boat_id: 'b2', trip_status: 'Arrived' }
]);
api._set('gps_logs', []);
const gpsLogs = await api.gpsLogs.simulateMovement();
assert.ok(gpsLogs.some(l => l.boat_id === 'b1'), 'scheduled boat moved');
assert.ok(!gpsLogs.some(l => l.boat_id === 'b2'), 'arrived boat stays put');

// SOS acknowledgement records who acknowledged it.
api._set('session', session);
api._set('alerts', [{ id: 'alert_1', status: 'Open' }]);
const acked = await api.alerts.acknowledge('alert_1', null, csrfToken);
assert.equal(acked.acknowledged_by, 'usr_admin');
assert.ok(acked.acknowledged_at);

// Self-service profile/password: own whitelisted fields only, hash verified once.
api._set('session', session);
const selfUser = await api.users.create({
  full_name: 'Self User', email: 'self@x.local', username: 'selfuser',
  password_hash: 'oldpass1', role: 'port_manager', status: 'Active'
}, csrfToken);
api._set('session', { ...session, user_id: selfUser.id, role: 'port_manager' });

const selfUpdated = await api.users.updateSelf({
  full_name: 'Renamed', contact: '0917', role: 'administrator', status: 'Suspended', email: 'evil@x.local'
});
assert.equal(selfUpdated.full_name, 'Renamed');
assert.equal(selfUpdated.contact, '0917');
assert.equal(selfUpdated.role, 'port_manager', 'role cannot be escalated');
assert.equal(selfUpdated.status, 'Active', 'status cannot be changed');
assert.equal(selfUpdated.email, 'self@x.local', 'email is not self-editable');

await assert.rejects(api.users.changePassword('wrongpass', 'newpass1'), /incorrect/);
const pwChanged = await api.users.changePassword('oldpass1', 'newpass1');
assert.equal(pwChanged.must_change_password, false);
assert.ok(pwChanged.password_salt, 'new password is salted');
assert.notEqual(pwChanged.password_hash, 'oldpass1');
await assert.rejects(api.auth.login('self@x.local', 'oldpass1'), /Invalid/);
const reLogin = await api.auth.login('self@x.local', 'newpass1');
assert.equal(reLogin.user_id, selfUser.id);

// "Wipe Data (Keep Accounts)" sticks, and a forced seed fills the verification queues.
localStorage.clear();
api._set('users', [{ id: 'usr_kept', full_name: 'Kept', role: 'administrator', status: 'Active' }]);
await seedDatabase();
assert.equal(api._get('users')[0].id, 'usr_kept');
assert.equal(api._get('trips'), null);
assert.equal(api._get('seeded'), true);

await seedDatabase(true);
assert.ok(api._get('trips').length > 0);
assert.ok(api._get('boat_documents').length > 0);
assert.ok(api._get('boats').some(b => b.registration_status === 'Pending'));
assert.ok(api._get('crew_applications').some(a => a.stage === 'Pending Admin Verification'));

console.log('All checks passed.');

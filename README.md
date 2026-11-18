# BoatTrack

Passenger and vessel monitoring system with a customized ticketing workflow for Binangonan Port, Rizal.

A BSIT capstone project for the University of Rizal System. BoatTrack runs the daily operations of motorized bangka trips across Laguna de Bay between Binangonan Port and the Talim Island terminals — from booking and boarding to manifests, safety inspections, and emergency alerts.

## Roles

| Role | Portal | Handles |
| --- | --- | --- |
| Administrator | `admin/` | Accounts, boat verification, routes and fares, terminals, manifests, bookings, SOS alerts |
| Port Manager | `manager/` | Trip schedules, vessel monitoring, risk assessment, payments and remittance |
| Receptionist | `receptionist/` | Walk-in registration, boarding and ticketing, manifests, remittance, booking review |
| Boat Owner | `owner/` | Boat registration and documents, fleet details |
| Boat Operator | `operator/` | Assigned boats, crew applications, crew roster and attendance, trip schedules |
| Crew | `crew/` | Assigned trips, passenger lists, pre-departure and post-arrival inspections, SOS |
| Passenger | `passenger/` | Schedules, trip and cargo booking, GCash payment, e-ticket, QR code, SOS |

The public landing page with the live departure board is `index.html`; sign-in and sign-up are in `login.html`.

## Features

- Public departure board and online trip booking
- Walk-in guest registration, QR boarding, fare and change computation
- Boat registration with document review and approval
- Route, fare, discount, and cargo rate management
- Trip scheduling with hold/release controls
- Passenger manifests with weight and load safety monitoring
- Pre-departure and post-arrival safety inspections
- GCash payment flow with e-ticket generation and retry/cancel
- 80mm thermal printing for e-tickets and crew manifests
- SOS distress alerts for passengers and crew

## Tech stack

- Plain HTML, CSS, and vanilla JavaScript (ES modules) — no build step
- `localStorage` data layer behind a single API module, so pages never talk to storage directly
- SHA-256 password hashing and a route guard for session handling

## Running locally

```bash
npm install
npm run dev
```

Opens `http://localhost:5500/login.html`.

Any static file server works too, for example:

```bash
python3 -m http.server 5500
```

## Project structure

```
index.html, login.html                          Public entry points
account/change-password.html                    Forced password change (all roles)
admin/ manager/ receptionist/                   Operations portals
owner/ operator/ crew/ passenger/               Role portals
roles/                                          Fallback page
css/                                            Design tokens, base styles, components, layout
js/                                             api.js (data layer), seed.js, auth.js, ui.js
```

## Demo accounts

All accounts use the password `123`.

| Role | Username |
| --- | --- |
| Administrator | `admin` |
| Port Manager | `manager` |
| Receptionist | `receptionist` |
| Boat Owner | `roberto` |
| Boat Operator | `nestor` |
| Crew | `dante` |
| Passenger | `angelica` |

Sample data is seeded on first load. The Administrator's Dev Tools page can reseed or wipe it.

## Notes

- Bookings, payments, inspections, and alerts are simulated client-side; payment confirmation follows the mock gateway flow in the passenger portal.
- Data lives in the browser's `localStorage`, so it is per-browser and per-origin.
- Print styles are scoped to roughly 80mm receipt width and hide portal chrome when printing.

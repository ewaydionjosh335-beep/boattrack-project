# BoatTrack: Enhanced Passenger and Vessel Monitoring System With Customized Ticketing System for Binangonan Port

BSIT Capstone Project — University of Rizal System

## 1. Project Overview
BoatTrack is a maritime operations web system designed for motorized bangka boats operating across Laguna de Bay between Binangonan Port, Rizal, and Talim Island terminals. 
- **Phase 1** establishes the foundational architecture, public portal, authentication guard, and full Administrator module.
- **Phase 2** introduces Boat Owner, Boat Operator, Crew modules, crew applications, attendance, and GPS tracking.
- **Phase 3** completes Receptionist walk-in remittance, private booking review, Port Manager trip schedules, and boat monitoring.
- **Phase 4** (Final Session) builds complete dedicated **Passenger** and **Crew** portals, Pre-departure and Post-arrival Safety Inspections, GCash Mock & PayMongo Gateway integration, E-Ticket printing (~80mm), Passenger and Crew SOS emergency distress workflows, and cross-role data sync.

---

## 2. Project File Structure
```
boattrack/
  index.html                 # Public landing page & departure board
  login.html                 # Login & Sign-up (with QR code generator)
    change-password.html       # Force password change for initial logins
  roles/
    placeholder.html           # Fallback page for unhandled roles
  admin/
    dashboard.html           # Vessel map, stats, and live GPS radar
    accounts.html            # User account management
    boat-verification.html   # Boat registration verification & document review
    routes-fares.html        # Route CRUD & global discount rate / cargo rate settings
    terminals.html           # Terminal stations & Coast Guard personnel
    manifests.html           # Passenger manifests & weight load safety monitor
    bookings.html            # Approved booking, payment status, e-ticket & GCash ref records
    sos-alerts.html          # Emergency SOS distress alerts monitor (Passengers & Crew)
    dev-tools.html           # Seeding, data wipe, and testing simulation tools
  manager/
    dashboard.html           # Port Manager Dashboard & Trip Statistics
    trip-schedule.html       # Trip scheduling & hold/release controls
    monitoring.html          # Boat & Trip monitoring with latest inspection results
    risk-assessment.html     # Automated maritime risk scan & AI assessment
    payments.html            # Payment records & remittance tracking
    profile.html             # Port Manager Profile
  receptionist/
    dashboard.html           # Receptionist Dashboard
    register-guest.html      # Walk-in Guest Registration & QR generation
    boarding.html            # Boarding & Ticketing Station (QR scan, weight, fare, cash change)
    manifests.html           # Today's Trip Manifests
    remittance.html          # Walk-in payments grouped by vessel & crew remittance
    booking-review.html      # Private booking review drawer (Approve/Reject + amount due & notification)
    profile.html             # Receptionist Profile
  operator/
    dashboard.html           # Boat Operator Dashboard
    my-boats.html            # Registered boats
    crew-applications.html   # Crew recruitment applications
    crew-list.html           # Assigned crew roster
    crew-attendance.html     # Daily attendance logs
    trips.html               # Read-only trip schedules
  owner/
    dashboard.html           # Boat Owner Dashboard
    register-boat.html       # Boat registration & document upload
    my-boats.html            # Fleet management
    boat-details.html        # Individual boat details
  passenger/
    dashboard.html           # Passenger Dashboard
    schedules.html           # Live trip schedules
    book-trip.html           # Passenger & Cargo trip booking
    my-bookings.html         # Bookings status queue
    payment.html             # GCash payment gateway simulation & retry/cancel
    eticket.html             # Printable E-Ticket (~80mm thermal receipt format)
    my-qr.html               # Permanent QR code generator & download
    notifications.html       # System & booking approval notifications
    sos.html                 # Passenger SOS emergency distress alert (Departed trips only)
    profile.html             # Passenger profile & weight management
  crew/
    dashboard.html           # Crew Dashboard (boat info, today's trips, inspections status, SOS card)
    my-trips.html            # Assigned vessel trips (read-only with date/status filters)
    passenger-list.html      # Trip manifest table, baggage/pax weights, load vs max load, print button
    inspections.html         # Pre-departure & Post-arrival safety inspection forms & history
    sos.html                 # Crew SOS emergency distress alert (Press-and-hold / confirm, Departed only)
    profile.html             # Crew profile & password update
  css/
    tokens.css               # Design tokens (colors, fonts, radii)
    base.css                 # Base resets and typography
    components.css           # Reusable components (buttons, badges, modals, tables)
    layout.css               # Navigation and admin sidebar layout
  js/
    api.js                   # Data access layer (localStorage mock for future REST API)
    seed.js                  # Realistic Binangonan Port sample data
    auth.js                  # Session management, route guard, and SHA-256 password hashing
    ui.js                    # Toast notifications, confirmation modals, and CSV export
  README.md                  # Run instructions and architecture documentation
```

---

## 3. How to Run
Runs on localhost with plain HTML, CSS, and vanilla JavaScript (ES modules). No build step required.

### Option A: Python HTTP Server
```bash
python3 -m http.server 5500
```
Then open: `http://localhost:5500`

### Option B: Node.js Serve
```bash
npx serve -l 5500
```
Then open: `http://localhost:5500`

---

## 4. Default Accounts & Seed Credentials
- **Administrator:** `admin` / `123`
- **Port Manager:** `manager` / `123`
- **Receptionist:** `receptionist` / `123`
- **Boat Owner:** `roberto` / `123`
- **Boat Operator:** `nestor` / `123`
- **Crew:** `dante` / `123` (`crew1@boattrack.local`)
- **Passenger:** `angelica` / `123` (`passenger@boattrack.local`)
- **Passenger (Pending Review):** `pax_review` / `123` (`carlos@boattrack.local`)
- **Passenger (Approved Unpaid):** `pax_unpaid` / `123` (`elena@boattrack.local`)
- **Passenger (Paid with E-Ticket):** `pax_paid` / `123` (`marco@boattrack.local`)
- **Passenger (Cargo Booking):** `pax_cargo` / `123` (`diana@boattrack.local`)

---

## 5. Data Layer & Future Backend Architecture
All reads and writes are centralized in `js/api.js`. Currently, `api.js` simulates backend storage and relational querying using `localStorage`.

### New Phase 4 Tables & Fields:
- `notifications`: User-specific notifications for booking approvals, rejections, and payment confirmations.
- `inspections`: Pre-departure and post-arrival safety checklist inspections (Life jackets, Engine, Fuel, Hull, Passenger count) with Pass/Fail results, notes, history log, and automatic overall computation.
- `crew_members`: Relational mapping of crew user accounts (`user_id`) to assigned vessel (`boat_id`).
- `settings`: Global discount rates (`discount_rate_senior`, `discount_rate_pwd`, `discount_rate_student`) and cargo rate (`cargo_rate_per_kg`).
- `bookings`: Added `amount_due`, `reviewed_by`, `reviewed_at`, `review_remarks`.
- `etickets`: E-ticket records linked to approved & paid bookings (`ET-YYYYMMDD-XXXX`).
- `alerts`: SOS emergency alerts sent by passengers or crew (`sender_role`, `status` Open/Acknowledged).

When migrating to a Node.js / Express / Prisma / PostgreSQL backend, replace internal storage calls inside `js/api.js` with asynchronous `fetch()` HTTP requests matching REST endpoints (e.g., `POST /api/auth/login`, `GET /api/inspections`, `POST /api/payment-gateway/checkout`). None of the page HTML or UI JavaScript files will need modification.

---

## 6. Payment Gateway Mock & PayMongo Integration Guide
The `api.paymentGateway` object in `js/api.js` simulates GCash payment transactions.
- **Real PayMongo Integration Steps**:
  1. Replace the mock implementation in `api.paymentGateway.createPayment()` with an asynchronous `fetch()` call to your backend server endpoint (e.g., `POST /api/payment-gateway/create-checkout-session` or `Sources API` for GCash).
  2. Configure a server webhook endpoint (e.g., `POST /api/webhooks/paymongo`) listening for `payment.intent.succeeded` or `source.chargeable` events.
  3. Upon webhook success, update the payment status to `Paid`, generate the e-ticket (`ET-YYYYMMDD-XXXX`), update the booking status, and dispatch a notification to the passenger.

---

## 7. E-Ticket & Crew List Printing (~80mm Thermal Width)
E-Tickets and Crew Manifest lists include specialized CSS `@media print` styling configured for standard `~80mm` thermal receipt printers (`max-width: 80mm`), automatically hiding application sidebars, headers, and buttons during printing.

---

## 8. Intentionally Out of Scope
The following features are reserved for future production phases:
- Automated AI maritime risk scan (integrated in Port Manager portal).
- Coast Guard departure clearance digital signatures.
- Departed / Arrived trip status updates by Port Manager (currently handled by Dev Tools simulators in Phase 4 until Port Manager Phase 5).
- SOS emergency dispatch response center routing & acknowledgment by Port Manager.
- Open-Meteo weather and typhoon advisory API integration.
- Real hardware GPS tracker integration (simulated via Dev Tools).
- Production Node.js backend database persistence.

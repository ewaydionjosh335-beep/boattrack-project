# BoatTrack: Enhanced Passenger and Vessel Monitoring System With Customized Ticketing System for Binangonan Port

BSIT Capstone Project — University of Rizal System

## Project Overview

BoatTrack is a maritime operations web system for motorized bangka boats running across Laguna de Bay between Binangonan Port, Rizal, and Talim Island terminals. It covers the full lifecycle of a port operation: vessel registration and verification, trip scheduling, passenger and cargo booking, walk-in boarding and ticketing, safety inspections, live tracking, payments, e-tickets, and emergency distress handling.

### Roles and what each does

- **Administrator** — manages user accounts, verifies boat registrations and documents, configures routes, fares, terminals, Coast Guard personnel, passenger manifests, weight-load safety, bookings, payments, and SOS alerts; includes dev tools for seeding and simulation.
- **Port Manager** — monitors the port dashboard and trip statistics, schedules and holds/releases trips, monitors boats and trips with latest inspection results, runs maritime risk assessments, tracks payments and remittances, and manages profile.
- **Receptionist** — registers walk-in guests and generates QR codes, runs the boarding/ticketing station (QR scan, weight, fare, cash change), views today's manifests, groups walk-in remittances by vessel and crew, and reviews private bookings (approve/reject with amount due and notification).
- **Boat Owner** — registers boats with documents, manages fleet, and views boat details.
- **Boat Operator** — manages registered boats, recruits and assigns crew, logs crew attendance, and views trip schedules.
- **Crew** — views assigned vessel trips, manages the passenger manifest with baggage/pax weights and load vs. max load, performs pre-departure and post-arrival safety inspections, and can trigger SOS distress alerts on departed trips.
- **Passenger** — browses live trip schedules, books passenger and cargo trips, tracks booking status, pays via GCash simulation, prints e-tickets, generates a permanent QR code, receives notifications, triggers SOS distress alerts on departed trips, and manages profile and weight.

### Core flows

- **Vessel onboarding**: Boat Owner registers a boat with documents; Administrator verifies it before it can operate.
- **Trip scheduling**: Port Manager creates and controls trip schedules (hold/release); Boat Operator and Crew view assigned trips.
- **Booking**: Passengers book trips (passenger/cargo); Receptionist reviews private bookings and approves/rejects with amount due and notification. Approved bookings proceed to payment and e-ticket issuance.
- **Walk-in boarding**: Receptionist registers guests, scans QR, records weight and fare, computes cash change, and generates tickets.
- **Safety**: Crew complete pre-departure and post-arrival inspections (life jackets, engine, fuel, hull, passenger count) with pass/fail results and history.
- **Payments**: GCash mock gateway simulates checkout; successful payment generates an e-ticket (ET-YYYYMMDD-XXXX) and notifies the passenger. PayMongo integration is guided for production.
- **Monitoring and emergency**: Administrator and Port Manager monitor vessels, manifests, and weight-load safety; passengers and crew can raise SOS distress alerts on departed trips.

---
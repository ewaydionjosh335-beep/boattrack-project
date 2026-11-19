// js/services/loadService.js
// Single source of truth for trip load totals so every role reports the same weight.
// Cargo counts once a booking is Approved: approval clears it for loading, whether or
// not its payment has been recorded yet. Payment status must not hide physical weight.

export const DEFAULT_PASSENGER_WEIGHT_KG = 65;

export const loadService = {
  approvedCargo(bookings, tripId) {
    return (bookings || []).filter(b =>
      b.trip_id === tripId && b.status === 'Approved' && b.booking_type === 'Cargo');
  },

  computeTripLoad({ manifests = [], passengers = [], bookings = [], tripId, defaultPassengerWeightKg = DEFAULT_PASSENGER_WEIGHT_KG }) {
    const tripManifests = (manifests || []).filter(m => m.trip_id === tripId);

    let passengerWeightKg = 0;
    let baggageWeightKg = 0;
    tripManifests.forEach(m => {
      const psg = (passengers || []).find(p => p.id === m.passenger_id);
      passengerWeightKg += (psg?.weight_kg || defaultPassengerWeightKg);
      baggageWeightKg += (m.baggage_weight_kg || 0);
    });

    const cargoBookings = loadService.approvedCargo(bookings, tripId);
    const cargoWeightKg = cargoBookings.reduce((sum, b) => sum + (b.cargo_weight_kg || 0), 0);

    return {
      manifests: tripManifests,
      cargo_bookings: cargoBookings,
      passenger_count: tripManifests.length,
      passenger_weight_kg: passengerWeightKg,
      baggage_weight_kg: baggageWeightKg,
      cargo_weight_kg: cargoWeightKg,
      total_load_kg: passengerWeightKg + baggageWeightKg + cargoWeightKg
    };
  }
};

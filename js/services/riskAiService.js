// js/services/riskAiService.js
// FUTURE: real AI call must be made from backend; API key never in frontend.
export const riskRules = {
  notAdvisable: { windGust:50, windSpeed:40, thunderstormMin:95, thunderstormMax:99, rainProbWithWind:80, windWithRain:30 },
  caution: { loadPct:85, paxPct:90, wind:25, gust:35, rainProb:50, visibilityKm:2 }
};

export const riskAiService = {
  classify({ forecast, totals }) {
    // forecast: {wind_speed_kmh, wind_gust_kmh, precipitation_probability, weather_code, visibility_m}
    // totals: {total_load_kg, max_load_kg, passenger_count, passenger_capacity}
    const r = riskRules;
    const reasons = [];
    let classification = 'Safe';
    const loadPct = totals.max_load_kg ? (totals.total_load_kg / totals.max_load_kg * 100) : 0;
    const paxPct = totals.passenger_capacity ? (totals.passenger_count / totals.passenger_capacity * 100) : 0;

    const notAdv =
      totals.total_load_kg > totals.max_load_kg ||
      totals.passenger_count > totals.passenger_capacity ||
      forecast.wind_gust_kmh >= r.notAdvisable.windGust ||
      forecast.wind_speed_kmh >= r.notAdvisable.windSpeed ||
      (forecast.weather_code >= r.notAdvisable.thunderstormMin && forecast.weather_code <= r.notAdvisable.thunderstormMax) ||
      (forecast.precipitation_probability >= r.notAdvisable.rainProbWithWind && forecast.wind_speed_kmh >= r.notAdvisable.windWithRain);

    if (notAdv) {
      classification = 'Not Advisable';
      if (totals.total_load_kg > totals.max_load_kg) reasons.push('total load exceeds maximum load');
      if (totals.passenger_count > totals.passenger_capacity) reasons.push('passengers exceed capacity');
      if (forecast.wind_gust_kmh >= r.notAdvisable.windGust) reasons.push('wind gusts are high');
      if (forecast.wind_speed_kmh >= r.notAdvisable.windSpeed) reasons.push('wind speed is high');
      if (forecast.weather_code >= 95) reasons.push('thunderstorm conditions');
      if (forecast.precipitation_probability >= 80 && forecast.wind_speed_kmh >= 30) reasons.push('heavy rain with strong wind');
    } else {
      const caution =
        loadPct >= r.caution.loadPct ||
        paxPct >= r.caution.paxPct ||
        forecast.wind_speed_kmh >= r.caution.wind ||
        forecast.wind_gust_kmh >= r.caution.gust ||
        forecast.precipitation_probability >= r.caution.rainProb ||
        (forecast.visibility_m || 10000) < r.caution.visibilityKm*1000;
      if (caution) {
        classification = 'Caution';
        if (loadPct >= 85) reasons.push('load is at least 85% of maximum');
        if (paxPct >= 90) reasons.push('passengers near capacity');
        if (forecast.wind_speed_kmh >= 25) reasons.push('moderate wind');
        if (forecast.wind_gust_kmh >= 35) reasons.push('wind gusts elevated');
        if (forecast.precipitation_probability >= 50) reasons.push('rain likely');
        if ((forecast.visibility_m||10000) < 2000) reasons.push('low visibility');
      } else {
        reasons.push('conditions within safe limits');
      }
    }
    const explanation = `Based on the forecast and aggregate load totals, the trip is classified as ${classification}. Factors: ${reasons.join(', ')}. This result is advisory and does not replace the decision of the Port Manager or Coast Guard personnel.`;
    return { classification, explanation, source: 'Rule-based mock' };
  }
};
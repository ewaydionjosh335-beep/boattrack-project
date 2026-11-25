// js/services/weatherService.js
export const weatherService = {
  async fetchForTerminal(terminal, targetTime = null, { force = false } = {}) {
    const cacheKey = 'weather_cache_' + terminal.id;
    if (!force) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached && Date.now() - cached.fetched_at < 30*60*1000) {
          // The cached record holds the whole hourly forecast, so re-select the
          // hour that matches this caller's targetTime instead of reusing whatever
          // hour (usually "now") the previous caller asked for.
          return cached.hourly ? { ...cached, ...pickHour(cached.hourly, targetTime) } : cached;
        }
      } catch(e){}
    }
    let source = 'Open-Meteo';
    let data = null;
    // A hanging weather API used to leave scans with no result at all.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${terminal.lat}&longitude=${terminal.lng}&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,visibility&forecast_days=3&timezone=Asia%2FManila`, { signal: controller.signal });
      if (!res.ok) throw new Error('bad');
      data = await res.json();
    } catch (e) {
      source = 'Offline sample';
      data = null;
    } finally {
      clearTimeout(timer);
    }
    const record = buildRecord(terminal, source, data, targetTime);
    try { localStorage.setItem(cacheKey, JSON.stringify({ ...record, fetched_at: Date.now() })); } catch(e){}
    return record;
  }
};

function pickHour(hourly, targetTime = null) {
  const target = targetTime ? new Date(targetTime).getTime() : Date.now();
  let best = hourly[0];
  let bestDiff = Infinity;
  for (const h of hourly) {
    const diff = Math.abs(new Date(h.for_time).getTime() - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = h;
    }
  }
  return best;
}

function buildRecord(terminal, source, data, targetTime = null) {
  const now = new Date();
  const hourly = [];
  if (data && data.hourly) {
    for (let i=0;i<data.hourly.time.length;i++){
      hourly.push({
        for_time: data.hourly.time[i],
        temperature_c: data.hourly.temperature_2m[i],
        precipitation_probability: data.hourly.precipitation_probability[i],
        precipitation_mm: data.hourly.precipitation[i],
        weather_code: data.hourly.weather_code[i],
        wind_speed_kmh: data.hourly.wind_speed_10m[i],
        wind_gust_kmh: data.hourly.wind_gusts_10m[i],
        visibility_m: data.hourly.visibility[i]
      });
    }
  } else {
    // Offline fallback covers the same 3-day window as the API request.
    for (let i=0;i<72;i++){
      const t = new Date(now.getTime()+i*3600000);
      hourly.push({ for_time: t.toISOString(), temperature_c: 28, precipitation_probability: 20, precipitation_mm: 0, weather_code: 1, wind_speed_kmh: 12, wind_gust_kmh: 18, visibility_m: 10000 });
    }
    source = source === 'Open-Meteo' ? 'Offline sample' : source;
  }
  // Find the hourly entry closest to targetTime (or now if not provided)
  const best = pickHour(hourly, targetTime);
  return {
    terminal_id: terminal.id,
    source,
    fetched_at: now.toISOString(),
    for_time: best.for_time,
    temperature_c: best.temperature_c,
    wind_speed_kmh: best.wind_speed_kmh,
    wind_gust_kmh: best.wind_gust_kmh,
    precipitation_probability: best.precipitation_probability,
    precipitation_mm: best.precipitation_mm,
    weather_code: best.weather_code,
    visibility_m: best.visibility_m,
    hourly
  };
}
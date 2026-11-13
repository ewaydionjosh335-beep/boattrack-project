// js/services/etaService.js
export const etaService = {
  haversine(lat1,lng1,lat2,lng2){
    const R=6371; const dLat=(lat2-lat1)*Math.PI/180; const dLng=(lng2-lng1)*Math.PI/180;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  },
  async estimate(trip) {
    const trips = await (window.api?window.api.trips.list():Promise.resolve([]));
    const routes = await (window.api?window.api.routes.list():Promise.resolve([]));
    const boats = await (window.api?window.api.boats.list():Promise.resolve([]));
    const terminals = await (window.api?window.api.terminals.list():Promise.resolve([]));
    const logs = await (window.api?window.api.gpsLogs.list():Promise.resolve([]));
    const route = routes.find(r=>r.id===trip.route_id);
    const boat = boats.find(b=>b.id===trip.boat_id);
    const dest = terminals.find(t=>t.id===route?.destination_terminal_id);
    const boatLogs = logs.filter(l=>l.boat_id===trip.boat_id).sort((a,b)=>new Date(a.recorded_at)-new Date(b.recorded_at));
    if (boatLogs.length>=2 && dest) {
      const last = boatLogs[boatLogs.length-1];
      const prev = boatLogs[boatLogs.length-2];
      const dt = (new Date(last.recorded_at)-new Date(prev.recorded_at))/3600000;
      const dist = this.haversine(prev.lat,prev.lng,last.lat,last.lng);
      const speed = dt>0 ? dist/dt : 0;
      const remaining = this.haversine(last.lat,last.lng,dest.lat,dest.lng);
      const safeSpeed = Math.max(speed, 5);
      const hours = remaining/safeSpeed;
      return new Date(Date.now()+hours*3600000).toISOString();
    }
    if (trip.departed_at && route) {
      const mins = route.est_duration_min || 30;
      return new Date(new Date(trip.departed_at).getTime()+mins*60000).toISOString();
    }
    return null;
  }
};
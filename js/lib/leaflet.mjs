// Leaflet ES Module wrapper - loads Leaflet via fetch and eval
const response = await fetch('/js/lib/leaflet.js');
const text = await response.text();
eval(text);
export default window.L;
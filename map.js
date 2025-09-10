// map.js
export const MAPBOX_ACCESS_TOKEN = 'YOUR_MAPBOX_ACCESS_TOKEN'; // Get from https://account.mapbox.com/access-tokens/

let mapInstance = null;
let produceMarkers = [];
let userMarker = null;

/**
 * Initializes and displays the Mapbox map.
 * @param {[number,number]} centerCoordinates - [lng, lat]
 * @param {number} zoom 
 */
export function initializeMap(centerCoordinates, zoom=13) {
  if (mapInstance) removeMap();
  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
  mapInstance = new mapboxgl.Map({
    container: "map", // expects <div id="map">
    style: "mapbox://styles/mapbox/streets-v11",
    center: centerCoordinates,
    zoom: zoom,
  });
  // Add zoom and rotation controls
  mapInstance.addControl(new mapboxgl.NavigationControl());
  return mapInstance;
}

/**
 * Adds a simple colored marker to the map (e.g. for the user's own location).
 * @param {[number,number]} coordinates - [lng, lat]
 * @param {string} color - Hex color
 * @param {string} popupText 
 */
export function addSingleMarker(coordinates, color, popupText='') {
  if (!mapInstance) return;
  if (userMarker) userMarker.remove();
  const el = document.createElement('div');
  el.className = 'produce-marker';
  el.style.background = color;
  userMarker = new mapboxgl.Marker(el)
    .setLngLat(coordinates)
    .setPopup(new mapboxgl.Popup().setText(popupText))
    .addTo(mapInstance);
}

/**
 * Renders all produce markers. Replaces existing ones.
 * @param {Array} posts 
 */
export function renderMarkers(posts) {
  if (!mapInstance) return;
  // Remove old markers
  produceMarkers.forEach(marker => marker.remove());
  produceMarkers = [];

  posts.forEach(post => {
    if (!post.location) return;
    const el = document.createElement('div');
    el.className = 'produce-marker';
    el.title = post.produceType;
    // Differentiate marker for "my own" posts
    el.style.background = "#27ae60";
    const marker = new mapboxgl.Marker(el)
      .setLngLat([post.location.lng, post.location.lat])
      .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <strong>${post.produceType}</strong><br>
        Qty: ${post.quantity} ${post.unit || ''}<br>
        Price: ₹${post.price} <br>
        Farmer: ${post.farmerName || 'Anonymous'}<br>
        <span class="text-muted" style="font-size:0.93em;">${post.createdAt && post.createdAt.toDate ? post.createdAt.toDate().toLocaleString() : ''}</span>
      `))
      .addTo(mapInstance);
    produceMarkers.push(marker);
  });
}

/**
 * Destroys the map instance and removes all markers.
 */
export function removeMap() {
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  produceMarkers = [];
  if (userMarker) {
    userMarker.remove();
    userMarker = null;
  }
}

// main.js
import { firebaseConfig } from './firebase-config.js';
import { initializeApi, postProduce, listenForPosts } from './api.js';
import { initializeMap, addSingleMarker, removeMap } from './map.js';
import { renderApp, showNotification } from './ui.js';

// Global State
export const state = {
  userRole: null, // 'farmer' | 'shop_owner'
  userLocation: null, // {lat, lng}
  firebaseApp: null,
};

// Utility: Promise wrapper for geolocation
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 9000 }
    );
  });
}

document.addEventListener('DOMContentLoaded', initialize);

function initialize() {
  // Initialize Firebase App
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  state.firebaseApp = firebase.app();
  initializeApi(state.firebaseApp);

  renderApp(state.userRole, handleRoleSelect);
}

function handleRoleSelect(role) {
  state.userRole = role;
  renderApp(role, handleRoleSelect);
  initializeViewForRole(role);
}

async function initializeViewForRole(role) {
  let location = null;
  try {
    location = await getCurrentLocation();
  } catch (err) {
    // Default to a fixed location (e.g. New Delhi)
    location = { lat: 28.6139, lng: 77.2090 };
    showNotification("Location access denied. Using default location.", "error");
  }
  state.userLocation = location;

  if (role === 'farmer') {
    // Wait for #map to exist
    setTimeout(() => {
      initializeMap([location.lng, location.lat], 14);
      addSingleMarker([location.lng, location.lat], "#1877f2", "You are here");
      listenForPosts();
      // Attach form submit
      const form = document.getElementById('produce-form');
      if (form) {
        form.addEventListener('submit', handleFormSubmit);
      }
    }, 150);
  }

  if (role === 'shop_owner') {
    setTimeout(() => {
      initializeMap([location.lng, location.lat], 13);
      addSingleMarker([location.lng, location.lat], "#1877f2", "You are here");
      listenForPosts();
    }, 150);
  }
}

async function handleFormSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = "Posting...";
  const form = event.target;
  const produceType = form.produceType.value.trim();
  const quantity = form.quantity.value.trim();
  const unit = form.unit.value;
  const price = form.price.value.trim();
  const farmerName = form.farmerName.value.trim();

  try {
    await postProduce({
      produceType,
      quantity,
      unit,
      price,
      farmerName: farmerName || undefined,
      location: state.userLocation,
    });
    showNotification("Produce posted successfully!", "success");
    form.reset();
  } catch (err) {
    showNotification("Failed to post produce. Try again.", "error");
  }
  btn.disabled = false;
  btn.textContent = "Post Produce";
}

// For HMR or navigation cleanup
window.addEventListener('beforeunload', () => {
  removeMap();
});

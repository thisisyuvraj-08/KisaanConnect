import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDnhwxpN_6VXNY2rkfKJuA5XFmSERSOFsM",
  authDomain: "kisaan-connect-da56d.firebaseapp.com",
  projectId: "kisaan-connect-da56d",
  storageBucket: "kisaan-connect-da56d.firebasestorage.app",
  messagingSenderId: "401721766160",
  appId: "1:401721766160:web:29644ebd5bcc3116f07595",
  measurementId: "G-9VQVCJYCWE"
};
const GEMINI_API_KEY = "AIzaSyCIzTRo8li7RHEkI6BrNcBPTCTMvsqiFZw";
const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NmNuczAwemYycXBndjN6bWZ3N3gifQ.FwM1h9gQ27Z6f1n3lA5yng"; // Use your own for production

let db, state = {role: null, user: null, location: null, markers: [], map: null, chat: {open:false, to:null, room:null}};
const app = document.getElementById('app');

document.addEventListener('DOMContentLoaded', init);

async function init() {
  initializeApp(firebaseConfig);
  db = getFirestore();
  render();
}

function render() {
  app.innerHTML = `
    <header>
      <div class="header-content">
        <span class="logo">
          <img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f33e.svg" class="logo-icon" alt="" />
          Kisaan Connect
        </span>
        <span id="role-indicator">${state.role ? (state.role === 'farmer' ? 'Farmer' : 'Shop Owner') : ''}</span>
      </div>
    </header>
    <main id="main-content"></main>
  `;
  if (!state.role) renderRoleSelection();
  else if (state.role === 'farmer') renderFarmerUI();
  else if (state.role === 'shop_owner') renderShopUI();
}

function renderRoleSelection() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <section class="card center">
      <h2 style="margin-bottom:1.2em;">Who are you?</h2>
      <div class="role-card" tabindex="1" id="select-farmer">
        <div class="role-illustration">
          <img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f9d1-200d-1f33e.svg" alt="Farmer" width="60"/>
        </div>
        <div class="role-info">
          <div class="role-title">I'm a Farmer</div>
          <div class="role-desc">Post your produce, get AI price help, connect with shops!</div>
        </div>
      </div>
      <div class="role-card" tabindex="2" id="select-shop-owner">
        <div class="role-illustration">
          <img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f3ea.svg" alt="Shop" width="60"/>
        </div>
        <div class="role-info">
          <div class="role-title">I'm a Shop Owner</div>
          <div class="role-desc">See nearby produce, post requirements, chat/call/WhatsApp farmers.</div>
        </div>
      </div>
      <div style="margin-top:2em;" class="text-muted">
        Bringing the local food chain closer, faster, fresher!
      </div>
    </section>
  `;
  main.querySelector('#select-farmer').onclick = async () => { state.role = 'farmer'; render(); };
  main.querySelector('#select-shop-owner').onclick = async () => { state.role = 'shop_owner'; render(); };
}

async function renderFarmerUI() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <section class="card">
      <h2>Post Your Surplus Produce</h2>
      <form id="produce-form" autocomplete="off">
        <label for="produceType">Produce</label>
        <input type="text" id="produceType" required maxlength="32" placeholder="e.g. Tomatoes" />
        <label for="quantity">Quantity</label>
        <input type="number" id="quantity" required min="1" max="99999" placeholder="e.g. 100"/>
        <label for="unit">Unit</label>
        <select id="unit" required>
          <option value="kg">kg</option>
          <option value="quintal">quintal</option>
          <option value="box">box</option>
          <option value="litre">litre</option>
        </select>
        <label for="price">Expected Price (₹)</label>
        <input type="number" id="price" required min="1" max="100000" placeholder="e.g. 200"/>
        <button id="ai-price-btn" type="button" style="margin-bottom:0.7em;">💡 Get AI Price Suggestion</button>
        <label for="farmerName">Your Name</label>
        <input type="text" id="farmerName" maxlength="30" placeholder="Optional"/>
        <label for="phone">Your Mobile (for shop to call/WhatsApp):</label>
        <input type="tel" id="phone" maxlength="14" placeholder="e.g. 9876543210" pattern="[0-9]+" />
        <button id="submit-btn" type="submit">Post Produce</button>
      </form>
    </section>
    <div class="map-container" id="map"></div>
    <div class='text-muted center' style='margin-top:.5em'>Your location is used to show produce on the map for local shops.</div>
  `;
  setTimeout(() => initializeMapAndPosts(), 60);
  setTimeout(bindFarmerForm, 100);
}

function bindFarmerForm() {
  document.getElementById('produce-form').onsubmit = async event => {
    event.preventDefault();
    showLoader(true);
    const produceType = event.target.produceType.value.trim();
    const quantity = event.target.quantity.value.trim();
    const unit = event.target.unit.value;
    const price = event.target.price.value.trim();
    const farmerName = event.target.farmerName.value.trim();
    const phone = event.target.phone.value.trim();
    try {
      await addDoc(collection(db, 'produce_posts'), {
        produceType, quantity, unit, price, farmerName: farmerName || undefined, phone: phone || undefined,
        location: state.location, createdAt: serverTimestamp()
      });
      showNotification("Produce posted successfully!", "success");
      event.target.reset();
    } catch {
      showNotification("Failed to post produce. Try again.", "error");
    }
    showLoader(false);
  };
  document.getElementById('ai-price-btn').onclick = async () => {
    const produce = document.getElementById('produceType').value.trim();
    if (!produce) return showNotification("Enter a produce name first.", "error");
    showNotification("Fetching AI price...", "success");
    const price = await getAIPriceSuggestion(produce);
    document.getElementById('price').value = price || '';
    showNotification(price ? "AI price filled!" : "AI price not found.", price ? "success" : "error");
  };
}

async function renderShopUI() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <section class="card" style="margin-bottom:0;">
      <h2>Post Your Shop's Requirement</h2>
      <form id="shop-form" autocomplete="off">
        <label for="reqType">Item/Product</label>
        <input type="text" id="reqType" required maxlength="32" placeholder="e.g. Potatoes" />
        <label for="reqQuantity">Quantity</label>
        <input type="number" id="reqQuantity" required min="1" max="99999" placeholder="e.g. 300"/>
        <label for="reqUnit">Unit</label>
        <select id="reqUnit" required>
          <option value="kg">kg</option>
          <option value="quintal">quintal</option>
          <option value="box">box</option>
          <option value="litre">litre</option>
        </select>
        <label for="reqPrice">Price you offer (₹)</label>
        <input type="number" id="reqPrice" required min="1" max="100000" placeholder="e.g. 20"/>
        <label for="shopName">Your Shop Name</label>
        <input type="text" id="shopName" maxlength="50" placeholder="Optional"/>
        <label for="shopPhone">Your Mobile (for farmer to call/WhatsApp):</label>
        <input type="tel" id="shopPhone" maxlength="14" placeholder="e.g. 9876543210" pattern="[0-9]+" />
        <button id="shop-submit-btn" type="submit">Post Requirement</button>
      </form>
    </section>
    <div class="map-container" id="map"></div>
    <div class='text-muted center' style='margin-top:.5em'>Map: See farmers selling near your location!</div>
  `;
  setTimeout(() => initializeMapAndPosts(), 60);
  setTimeout(bindShopForm, 100);
}

function bindShopForm() {
  document.getElementById('shop-form').onsubmit = async event => {
    event.preventDefault();
    showLoader(true);
    const produceType = event.target.reqType.value.trim();
    const quantity = event.target.reqQuantity.value.trim();
    const unit = event.target.reqUnit.value;
    const price = event.target.reqPrice.value.trim();
    const shopName = event.target.shopName.value.trim();
    const phone = event.target.shopPhone.value.trim();
    try {
      await addDoc(collection(db, 'shop_requests'), {
        produceType, quantity, unit, price, shopName: shopName || undefined, phone: phone || undefined,
        location: state.location, createdAt: serverTimestamp()
      });
      showNotification("Requirement posted!", "success");
      event.target.reset();
    } catch {
      showNotification("Failed to post. Try again.", "error");
    }
    showLoader(false);
  };
}

async function initializeMapAndPosts() {
  state.location = await getLocation();
  if (state.map) { state.map.remove(); state.map = null; }
  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
  state.map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/streets-v11",
    center: [state.location.lng, state.location.lat],
    zoom: 13,
  });
  state.map.addControl(new mapboxgl.NavigationControl(), 'top-right');
  addMapUserMarker([state.location.lng, state.location.lat]);
  listenAllPostsAndRender();
}

function addMapUserMarker([lng,lat]) {
  const el = document.createElement('div');
  el.className = 'produce-marker my-marker';
  el.innerHTML = `<span class="icon">📍</span>`;
  new mapboxgl.Marker(el).setLngLat([lng,lat])
    .setPopup(new mapboxgl.Popup().setText("You are here"))
    .addTo(state.map);
}

function listenAllPostsAndRender() {
  // Clear old markers
  state.markers.forEach(m => m.remove && m.remove());
  state.markers = [];
  // Farmers' produce
  const q1 = query(collection(db, 'produce_posts'), orderBy("createdAt", "desc"));
  onSnapshot(q1, snapshot => {
    snapshot.forEach(doc => {
      const post = doc.data();
      if (!post.location) return;
      const el = document.createElement('div');
      el.className = 'produce-marker';
      el.innerHTML = `<span class="icon">🥕</span>`;
      const phone = post.phone || '';
      const popupHTML = `
        <div style="font-weight:700;font-size:1.09em">${post.produceType || ''}</div>
        <div>Qty: <b>${post.quantity}</b> ${post.unit || ''}</div>
        <div>Price: <b>₹${post.price}</b></div>
        <div>Farmer: <span>${post.farmerName || 'Anonymous'}</span></div>
        <div style="margin-top:.7em;">
          ${phone ? `
          <button class="button" onclick="window.open('tel:${phone}')">📞 Call</button>
          <button class="button" onclick="window.open('https://wa.me/91${phone}')">💬 WhatsApp</button>
          ` : ''}
          <button class="button" onclick="startChat('${doc.id}','farmer')">💬 In-app Chat</button>
        </div>
      `;
      const marker = new mapboxgl.Marker(el)
        .setLngLat([post.location.lng, post.location.lat])
        .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML(popupHTML))
        .addTo(state.map);
      state.markers.push(marker);
    });
  });
  // Shop owners' requests (for farmers to see)
  const q2 = query(collection(db, 'shop_requests'), orderBy("createdAt", "desc"));
  onSnapshot(q2, snapshot => {
    snapshot.forEach(doc => {
      const req = doc.data();
      if (!req.location) return;
      const el = document.createElement('div');
      el.className = 'produce-marker';
      el.innerHTML = `<span class="icon">🏪</span>`;
      const phone = req.phone || '';
      const popupHTML = `
        <div style="font-weight:700;font-size:1.09em">${req.produceType || ''} (Need)</div>
        <div>Qty: <b>${req.quantity}</b> ${req.unit || ''}</div>
        <div>Price: <b>₹${req.price}</b></div>
        <div>Shop: <span>${req.shopName || 'Shop'}</span></div>
        <div style="margin-top:.7em;">
          ${phone ? `
          <button class="button" onclick="window.open('tel:${phone}')">📞 Call</button>
          <button class="button" onclick="window.open('https://wa.me/91${phone}')">💬 WhatsApp</button>
          ` : ''}
          <button class="button" onclick="startChat('${doc.id}','shop')">💬 In-app Chat</button>
        </div>
      `;
      const marker = new mapboxgl.Marker(el)
        .setLngLat([req.location.lng, req.location.lat])
        .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML(popupHTML))
        .addTo(state.map);
      state.markers.push(marker);
    });
  });
}

// --- CHAT (starter, extendable) ---
window.startChat = (id, type) => {
  // For demo: open a modal-like chat (real: use Firestore chat collections/queries)
  showNotification("In-app chat coming soon! (Template ready)", "success");
  // You can implement Firestore-based chat here, with real-time onSnapshot, etc.
};

// --- AI Price Suggestion via Gemini ---
async function getAIPriceSuggestion(produce) {
  try {
    const prompt = `Give a single best estimate for the current market price (in INR) for 1 kg of "${produce}" in India. Only output the number (integer).`;
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );
    const data = await resp.json();
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const price = (txt.match(/\d+/) || [])[0];
    return price;
  } catch {
    return '';
  }
}

// --- Geolocation for maps ---
function getLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat:28.6, lng:77.2 });
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat:28.6, lng:77.2 }),
      { enableHighAccuracy:true, timeout:9000 }
    );
  });
}

// --- Notification / Loader ---
function showNotification(message, type = "success") {
  const el = document.getElementById('notification-banner');
  el.textContent = message;
  el.className = `show${type === "error" ? " error" : ""}`;
  setTimeout(() => { el.className = ""; }, 3000);
}
function showLoader(show = true) {
  document.getElementById('loader-overlay').classList.toggle('hidden', !show);
}

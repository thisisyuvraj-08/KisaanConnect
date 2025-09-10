import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, setDoc, getDoc, onSnapshot, query, orderBy, serverTimestamp, GeoPoint } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDnhwxpN_6VXNY2rkfKJuA5XFmSERSOFsM",
  authDomain: "kisaan-connect-da56d.firebaseapp.com",
  projectId: "kisaan-connect-da56d",
  storageBucket: "kisaan-connect-da56d.firebasestorage.app",
  messagingSenderId: "401721766160",
  appId: "1:401721766160:web:fe4ec1d3d2cc0f19f07595",
  measurementId: "G-9VQVCJYCWE"
};
const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NmNuczAwemYycXBndjN6bWZ3N3gifQ.FwM1h9gQ27Z6f1n3lA5yng";

let app, db, auth, user, userData, map, markers = [];

document.addEventListener('DOMContentLoaded', () => {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence);
  onAuthStateChanged(auth, async (u) => {
    user = u;
    if (user) {
      userData = await getUserProfile(user.uid);
      render();
    } else {
      userData = null;
      renderAuth();
    }
  });
});

function render() {
  document.getElementById('app').innerHTML = `
    <header>
      <div class="header-content">
        <span class="logo">
          <img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f33e.svg" class="logo-icon" alt="" />
          Kisaan Connect
        </span>
        <span id="role-indicator">${userData ? (userData.role === 'farmer' ? 'Farmer' : 'Shopkeeper') : ''}</span>
      </div>
    </header>
    <main id="main-content"></main>
    <button class="fab" id="fab-post" title="Add post/request">+</button>
  `;
  document.getElementById('fab-post').onclick = () => renderPostModal();

  if (userData.role === "farmer") renderShopRequestsFeed();
  else renderFarmerFeed();
  renderMapRadiusSelector();
  renderMap();
}

function renderAuth() {
  document.getElementById('app').innerHTML = `
    <main id="main-content">
      <section class="card center">
        <h2>Login / Sign Up</h2>
        <form id="auth-form">
          <label>Email</label>
          <input type="email" id="auth-email" required autocomplete="username"/>
          <label>Password</label>
          <input type="password" id="auth-pw" required autocomplete="current-password"/>
          <label>Phone</label>
          <input type="tel" id="auth-phone" required maxlength="14" pattern="[0-9]+"/>
          <label>Role</label>
          <select id="auth-role" required>
            <option value="farmer">Farmer</option>
            <option value="shopkeeper">Shopkeeper</option>
          </select>
          <button type="submit" id="auth-btn">Continue</button>
        </form>
        <div id="map-auth" class="map-container" style="height:130px;margin-top:1.2em"></div>
        <div class="text-muted" style="margin-top:.3em;">We use your location to show relevant posts near you.</div>
      </section>
    </main>
  `;
  let loc = { lat: 28.6, lng: 77.2 };
  navigator.geolocation && navigator.geolocation.getCurrentPosition(
    pos => { loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }; renderMiniMap(loc); },
    () => renderMiniMap(loc)
  );
  renderMiniMap(loc);
  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = e.target["auth-email"].value.trim(),
          pw = e.target["auth-pw"].value,
          phone = e.target["auth-phone"].value.trim(),
          role = e.target["auth-role"].value;
    showLoader(true);
    try {
      let cred;
      try {
        cred = await signInWithEmailAndPassword(auth, email, pw);
      } catch {
        cred = await createUserWithEmailAndPassword(auth, email, pw);
      }
      await setDoc(doc(db, "users", cred.user.uid), {
        email, phone, role, location: new GeoPoint(loc.lat, loc.lng)
      }, { merge: true });
      showLoader(false);
    } catch (err) {
      showLoader(false);
      showNotification("Auth failed. Try again.", "error");
    }
  };
}
function renderMiniMap(loc) {
  setTimeout(() => {
    if (window._miniMap) window._miniMap.remove();
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    window._miniMap = new mapboxgl.Map({
      container: "map-auth",
      style: "mapbox://styles/mapbox/streets-v11",
      center: [loc.lng, loc.lat],
      zoom: 12,
      interactive: true
    });
    window._miniMap.on('moveend', () => {
      const c = window._miniMap.getCenter();
      loc.lat = c.lat; loc.lng = c.lng;
    });
    new mapboxgl.Marker().setLngLat([loc.lng, loc.lat]).addTo(window._miniMap);
  }, 100);
}

async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// --- FEED + MAP ---
function renderShopRequestsFeed() {
  const main = document.getElementById('main-content');
  main.innerHTML = `<h3>Nearby Shop Requests</h3><div class="feed-list" id="feed-list"></div><div id="map" class="map-container"></div>`;
  const q = query(collection(db, "shop_requests"), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    const feed = document.getElementById('feed-list');
    feed.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      if (!d.location || !inRange(d.location, userData.location, window._mapRadius || 10)) return;
      feed.appendChild(feedCard(d, "shop"));
    });
  });
}
function renderFarmerFeed() {
  const main = document.getElementById('main-content');
  main.innerHTML = `<h3>Nearby Farmers</h3><div class="feed-list" id="feed-list"></div><div id="map" class="map-container"></div>`;
  const q = query(collection(db, "produce_posts"), orderBy("createdAt", "desc"));
  onSnapshot(q, snap => {
    const feed = document.getElementById('feed-list');
    feed.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      if (!d.location || !inRange(d.location, userData.location, window._mapRadius || 10)) return;
      feed.appendChild(feedCard(d, "farmer"));
    });
  });
}
function feedCard(d, type) {
  const el = document.createElement('div');
  el.className = "feed-card";
  const isFarmer = type === "farmer";
  const avatar = isFarmer
    ? `<div class="feed-avatar">${(d.farmerName||"F").charAt(0).toUpperCase()}</div>`
    : `<div class="feed-avatar">${(d.shopName||"S").charAt(0).toUpperCase()}</div>`;
  const title = isFarmer
    ? `<div class="feed-title">${d.produceType||''} • <span class="feed-qty">${d.quantity||''} ${d.unit||''}</span></div>`
    : `<div class="feed-title">${d.produceType||''} <span class="feed-qty">(Wants: ${d.quantity||''} ${d.unit||''})</span></div>`;
  const meta = isFarmer
    ? `Price: ₹${d.price||'-'} <br>By: ${d.farmerName||'Anonymous'}`
    : `Price Offer: ₹${d.price||'-'} <br>By: ${d.shopName||'Shop'}`;
  const phone = d.phone || '';
  el.innerHTML = `
    ${avatar}
    <div class="feed-content">
      ${title}
      <div class="feed-meta">${meta}</div>
      <div class="feed-actions">
        ${phone ? `<button class="feed-action-btn" onclick="window.open('tel:${phone}')">📞 Call</button>
                   <button class="feed-action-btn" onclick="window.open('https://wa.me/91${phone}')">💬 WhatsApp</button>` : ""}
      </div>
    </div>
  `;
  return el;
}

function renderMapRadiusSelector() {
  const main = document.getElementById('main-content');
  const div = document.createElement("div");
  div.className = "map-radius";
  div.innerHTML = `
    <label for="radius">Show within</label>
    <select id="radius">
      <option>3</option><option>5</option><option>10</option><option>20</option>
    </select>
    <span>km</span>
  `;
  main.insertBefore(div, main.querySelector(".map-container"));
  document.getElementById('radius').value = (window._mapRadius||10);
  document.getElementById('radius').onchange = e => {
    window._mapRadius = Number(e.target.value);
    render();
  }
}

function renderMap() {
  setTimeout(() => {
    if (map) { map.remove(); }
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/streets-v11",
      center: [userData.location.longitude, userData.location.latitude],
      zoom: 12,
    });
    // show markers
    const isFarmer = userData.role === "farmer";
    const coll = isFarmer ? "shop_requests" : "produce_posts";
    const q = query(collection(db, coll), orderBy("createdAt", "desc"));
    onSnapshot(q, snap => {
      markers.forEach(m => m.remove()); markers = [];
      snap.forEach(doc => {
        const d = doc.data();
        if (!d.location || !inRange(d.location, userData.location, window._mapRadius || 10)) return;
        const el = document.createElement('div');
        el.className = 'produce-marker';
        el.innerHTML = `<span class="icon">${isFarmer ? "🏪" : "🥕"}</span>`;
        const marker = new mapboxgl.Marker(el)
          .setLngLat([d.location.longitude, d.location.latitude])
          .setPopup(new mapboxgl.Popup({ offset: 24 }).setHTML(`
            <div style="font-weight:700;font-size:1.09em">${d.produceType||''}</div>
            <div>Qty: <b>${d.quantity}</b> ${d.unit||''}</div>
            <div>Price: <b>₹${d.price}</b></div>
          `))
          .addTo(map);
        markers.push(marker);
      });
      // user marker
      const userEl = document.createElement('div');
      userEl.className = 'produce-marker my-marker';
      userEl.innerHTML = `<span class="icon">📍</span>`;
      new mapboxgl.Marker(userEl).setLngLat([userData.location.longitude, userData.location.latitude])
        .setPopup(new mapboxgl.Popup().setText("You are here"))
        .addTo(map);
    });
  }, 100);
}

// --- POST MODALS ---
function renderPostModal() {
  const isFarmer = userData.role === "farmer";
  const modal = document.createElement("div");
  modal.innerHTML = `
    <section class="card" style="max-width:430px;margin:3em auto;">
      <h2>${isFarmer ? "Post Your Produce" : "Post Your Requirement"}</h2>
      <form id="post-form" autocomplete="off">
        <label>${isFarmer ? "Produce" : "Item/Product"}</label>
        <input type="text" id="produceType" required maxlength="32" placeholder="e.g. Tomatoes" />
        <label>Quantity</label>
        <input type="number" id="quantity" required min="1" max="99999" placeholder="e.g. 100"/>
        <label>Unit</label>
        <select id="unit" required>
          <option value="kg">kg</option>
          <option value="quintal">quintal</option>
          <option value="box">box</option>
          <option value="litre">litre</option>
        </select>
        <label>Price (₹)</label>
        <input type="number" id="price" required min="1" max="100000" placeholder="e.g. 200"/>
        <button type="submit" id="save-btn">${isFarmer ? "Post Produce" : "Post Requirement"}</button>
      </form>
    </section>
  `;
  const overlay = document.createElement('div');
  overlay.style = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.25);z-index:2000;";
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  modal.querySelector("#post-form").onsubmit = async (e) => {
    e.preventDefault();
    showLoader(true);
    const produceType = e.target.produceType.value.trim();
    const quantity = e.target.quantity.value.trim();
    const unit = e.target.unit.value;
    const price = e.target.price.value.trim();
    try {
      if (isFarmer) {
        await addDoc(collection(db, 'produce_posts'), {
          produceType, quantity, unit, price,
          farmerName: userData.email, phone: userData.phone,
          location: userData.location, createdAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'shop_requests'), {
          produceType, quantity, unit, price,
          shopName: userData.email, phone: userData.phone,
          location: userData.location, createdAt: serverTimestamp()
        });
      }
      showNotification("Posted!", "success");
      overlay.remove();
      render();
    } catch (err) {
      showNotification("Failed to post. Try again.", "error");
    }
    showLoader(false);
  };
}

function inRange(l1, l2, km=10) {
  const toRad = x => x * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(l2.latitude - l1.latitude);
  const dLon = toRad(l2.longitude - l1.longitude);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(l1.latitude)) * Math.cos(toRad(l2.latitude)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) <= km;
}

function showNotification(message, type = "success") {
  const el = document.getElementById('notification-banner');
  el.textContent = message;
  el.className = `show${type === "error" ? " error" : ""}`;
  setTimeout(() => { el.className = ""; }, 2800);
}
function showLoader(show = true) {
  document.getElementById('loader-overlay').classList.toggle('hidden', !show);
}

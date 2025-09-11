// Kisaan Connect - Full SPA (Nearby Filtering, Role UI, Map/UI fixes)
// Author: Youfloww

const db = firebase.firestore();
const auth = firebase.auth();

let currentUser = null;
let userData = null;
let unsubscribeDashboard = null;
let unsubscribeMyPosts = null;
let map = null;
let markersLayer = null;
let userLocation = null;
let isMyPostsActive = false;

const $ = q => document.querySelector(q);
const $$ = q => Array.from(document.querySelectorAll(q));
const mainApp = $('#main-app');
const authScreen = $('#auth-screen');
const dashboardPanel = $('#dashboard-panel');
const mapPanel = $('#map-panel');
const fab = $('#fab');
const logoutBtn = $('#logout-btn');
const userNameSpan = $('#current-user-name');
const detailsModal = $('#details-modal');
const chatWindow = $('#chat-window');
const authError = $('#auth-error');

// Snackbar
let snackbarTimeout;
function showSnackbar(msg) {
  let sb = document.getElementById('snackbar');
  if (!sb) {
    sb = document.createElement('div');
    sb.id = 'snackbar';
    sb.className = 'snackbar';
    document.body.appendChild(sb);
  }
  sb.textContent = msg;
  sb.classList.add('show');
  clearTimeout(snackbarTimeout);
  snackbarTimeout = setTimeout(() => sb.classList.remove('show'), 2500);
}

// Utils
function formatTime(ts) {
  const d = ts instanceof Date ? ts : ts?.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  if (!d) return '';
  if (now.toDateString() === d.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function scrollToBottom(el) { el.scrollTop = el.scrollHeight; }
function getAvatarUrl(name) {
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(name)}`;
}
function haversine(lat1, lon1, lat2, lon2) {
  function toRad(x) { return x * Math.PI / 180; }
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Auth
function setupAuth() {
  $('#show-login').onclick = () => { showLogin(); };
  $('#show-register').onclick = () => { showRegister(); };
  function showLogin() {
    $('#show-login').classList.add('active');
    $('#show-register').classList.remove('active');
    $('#login-form').classList.remove('hidden');
    $('#register-form').classList.add('hidden');
    authError.textContent = '';
  }
  function showRegister() {
    $('#show-register').classList.add('active');
    $('#show-login').classList.remove('active');
    $('#register-form').classList.remove('hidden');
    $('#login-form').classList.add('hidden');
    authError.textContent = '';
  }
  $('#login-form').onsubmit = async e => {
    e.preventDefault();
    authError.textContent = '';
    const email = $('#login-email').value.trim();
    const pass = $('#login-password').value;
    try {
      await auth.signInWithEmailAndPassword(email, pass);
    } catch (err) {
      authError.textContent = err.message.replace('Firebase:', '').replace('auth/', '');
    }
  };
  $('#register-form').onsubmit = async e => {
    e.preventDefault();
    authError.textContent = '';
    const name = $('#register-name').value.trim();
    const phone = $('#register-phone').value.trim();
    const email = $('#register-email').value.trim();
    const pass = $('#register-password').value;
    const role = $('#register-role').value;
    if (!name || !phone || !email || !pass || !role) {
      authError.textContent = 'Please fill all fields.';
      return;
    }
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      const uid = cred.user.uid;
      await db.collection('users').doc(uid).set({
        name, phone, email, role,
        created: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      authError.textContent = err.message.replace('Firebase:', '').replace('auth/', '');
    }
  };
}

// Auth state
auth.onAuthStateChanged(async user => {
  if (user) {
    const doc = await db.collection('users').doc(user.uid).get();
    userData = doc.exists ? doc.data() : null;
    if (!userData) {
      await auth.signOut();
      return;
    }
    currentUser = user;
    userNameSpan.textContent = escapeHTML(userData.name);
    show(mainApp);
    hide(authScreen);
    setupMainApp();
  } else {
    currentUser = null;
    userData = null;
    hide(mainApp);
    show(authScreen);
    teardownMainApp();
  }
});

// Logout
logoutBtn.onclick = async () => { await auth.signOut(); };

// Main app setup
function setupMainApp() {
  if (!map) setupMap();
  getUserLocation().then(loc => {
    userLocation = loc;
    if (map && loc) {
      setTimeout(() => map.setView([loc.lat, loc.lng], 13), 500);
    }
    setupDashboardTabs();
    setupFAB();
  }).catch(() => {
    userLocation = null;
    setupDashboardTabs();
    setupFAB();
  });
}

// Main app teardown
function teardownMainApp() {
  if (unsubscribeDashboard) unsubscribeDashboard();
  if (unsubscribeMyPosts) unsubscribeMyPosts();
  dashboardPanel.innerHTML = '';
  if (markersLayer) markersLayer.clearLayers();
  closeModal();
  closeChat();
}

// Map setup
function setupMap() {
  map = L.map('map', { zoomControl: true, attributionControl: false }).setView([20.5937, 78.9629], 5.5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

// Dashboard Tabs, including Chats for both
function setupDashboardTabs() {
  if (userData.role === 'farmer') {
    dashboardPanel.innerHTML = `
      <div class="dashboard-tabs">
        <button class="tab-btn active" id="tab-market">Marketplace</button>
        <button class="tab-btn" id="tab-myposts">My Posts</button>
        <button class="tab-btn" id="tab-chats">Chats</button>
      </div>
      <div id="tab-content"></div>
    `;
    $('#tab-market').onclick = () => activateTab('market');
    $('#tab-myposts').onclick = () => activateTab('myposts');
    $('#tab-chats').onclick = () => activateTab('chats');
    activateTab('market');
  } else {
    dashboardPanel.innerHTML = `
      <div class="dashboard-tabs">
        <button class="tab-btn active" id="tab-market">Marketplace</button>
        <button class="tab-btn" id="tab-chats">Chats</button>
      </div>
      <div id="tab-content"></div>
    `;
    $('#tab-market').onclick = () => activateTab('market');
    $('#tab-chats').onclick = () => activateTab('chats');
    activateTab('market');
  }
}

function activateTab(tab) {
  isMyPostsActive = (tab === 'myposts');
  $$('#dashboard-panel .tab-btn').forEach(b => b.classList.remove('active'));
  if (tab === 'market') {
    $('#tab-market').classList.add('active');
    setupDashboard();
  } else if (tab === 'myposts') {
    $('#tab-myposts').classList.add('active');
    setupMyPosts();
  } else if (tab === 'chats') {
    $('#tab-chats').classList.add('active');
    setupChatsList();
  }
}

// Dashboard: MARKET
function setupDashboard() {
  if (unsubscribeDashboard) unsubscribeDashboard();
  let col, filterRole;
  if (userData.role === 'farmer') {
    col = 'requests';
    filterRole = 'owner';
  } else {
    col = 'produce';
    filterRole = 'farmer';
  }
  unsubscribeDashboard = db.collection(col)
    .orderBy('timestamp', 'desc')
    .onSnapshot(snap => {
      const items = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      // Filter to 10km range if user location is available
      const filtered = (userLocation && userLocation.lat)
        ? items.filter(item =>
            item.location && haversine(userLocation.lat, userLocation.lng, item.location.lat, item.location.lng) <= 10
          )
        : items;
      renderDashboard(filtered, col);
      updateMapMarkers(filtered, col);
    });
}
function renderDashboard(items, type) {
  let html = '';
  if (!items.length) {
    html = `<div class="empty-state">
      No ${type === 'produce' ? 'produce' : 'requests'} available nearby.<br>
      Click <b>+</b> below to add ${type === 'produce' ? 'produce' : 'a request'}!
    </div>`;
  } else {
    html = `<ul class="dashboard-list">` +
      items.map(item => `
        <li class="dashboard-item" data-id="${item.id}">
          <div class="dashboard-title">${escapeHTML(item.itemName || '')}</div>
          <div class="dashboard-meta">
            <span>${type === 'produce' ? 'By:' : 'Needed by:'} ${escapeHTML(item.userName || '')}</span>
            <span>Qty: <b>${escapeHTML(item.quantity || '?')}</b> kg</span>
            ${item.price ? `<span class="dashboard-price">₹${escapeHTML(item.price)}/kg</span>` : ''}
          </div>
          <div class="dashboard-meta">
            <span>Posted: ${formatTime(item.timestamp)}</span>
            <span class="dashboard-tag">${type === 'produce' ? 'Produce' : 'Request'}</span>
          </div>
        </li>
      `).join('') +
      `</ul>`;
  }
  $('#tab-content').innerHTML = html;
  $$('.dashboard-item').forEach(el => {
    el.onclick = () => openDetailsModal(items.find(i => i.id === el.dataset.id), type);
  });
}

// MY POSTS with Edit/Delete
function setupMyPosts() {
  if (unsubscribeMyPosts) unsubscribeMyPosts();
  let col = userData.role === 'farmer' ? 'produce' : 'requests';
  unsubscribeMyPosts = db.collection(col)
    .where('userId', '==', currentUser.uid)
    .orderBy('timestamp', 'desc')
    .onSnapshot(snap => {
      const items = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      renderMyPosts(items, col);
    });
}
function renderMyPosts(items, type) {
  let html = '';
  if (!items.length) {
    html = `<div class="empty-state">
      You have no ${type === 'produce' ? 'produce posts' : 'requests'} yet.<br>
      Click <b>+</b> below to add!
    </div>`;
  } else {
    html = `<ul class="myposts-list">` +
      items.map(item => `
        <li class="myposts-item" data-id="${item.id}">
          <div class="myposts-title">${escapeHTML(item.itemName || '')}</div>
          <div class="myposts-meta">
            <span>Qty: <b>${escapeHTML(item.quantity || '?')}</b> kg</span>
            ${item.price ? `<span class="myposts-price">₹${escapeHTML(item.price)}/kg</span>` : ''}
            <span>Posted: ${formatTime(item.timestamp)}</span>
            <span class="myposts-tag">${type === 'produce' ? 'Produce' : 'Request'}</span>
          </div>
          <button class="myposts-edit-btn" title="Edit">&#9998;</button>
          <button class="myposts-delete-btn" title="Delete">&#128465;</button>
        </li>
      `).join('') +
      `</ul>`;
  }
  $('#tab-content').innerHTML = html;
  $$('.myposts-delete-btn').forEach((btn, i) => {
    btn.onclick = e => {
      e.stopPropagation();
      const id = btn.closest('.myposts-item').dataset.id;
      let col = userData.role === 'farmer' ? 'produce' : 'requests';
      if (confirm('Delete this post?')) {
        db.collection(col).doc(id).delete();
        showSnackbar("Deleted!");
      }
    }
  });
  $$('.myposts-edit-btn').forEach((btn, i) => {
    btn.onclick = e => {
      e.stopPropagation();
      const id = btn.closest('.myposts-item').dataset.id;
      let col = userData.role === 'farmer' ? 'produce' : 'requests';
      db.collection(col).doc(id).get().then(doc => {
        if (doc.exists) {
          if (col === 'produce') openPostProduceModal({ id, ...doc.data() });
          else openPostRequestModal({ id, ...doc.data() });
        }
      });
    }
  });
}

// Map Markers: support multiple posts at same location
function updateMapMarkers(items, type) {
  if (!markersLayer) return;
  markersLayer.clearLayers();
  // Group items by lat,lng
  const locMap = {};
  items.forEach(item => {
    if (!item.location || !item.location.lat || !item.location.lng) return;
    const key = item.location.lat.toFixed(6) + ',' + item.location.lng.toFixed(6);
    if (!locMap[key]) locMap[key] = [];
    locMap[key].push(item);
  });
  Object.entries(locMap).forEach(([key, arr]) => {
    const [lat, lng] = key.split(',').map(Number);
    const marker = L.marker([lat, lng], {
      icon: L.icon({
        iconUrl: type === 'produce'
          ? 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/basket.svg'
          : 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/bag.svg',
        iconSize: [30, 30]
      })
    });
    marker.bindTooltip(arr.map(a => escapeHTML(a.itemName)).join(', '));
    marker.on('click', () => {
      // Show list modal if multiple at this spot
      if (arr.length === 1) openDetailsModal(arr[0], type);
      else {
        detailsModal.innerHTML = `
          <div class="modal-content">
            <button class="modal-close" title="Close">&times;</button>
            <div class="modal-header">Posts at this location</div>
            <ul>
              ${arr.map((item, idx) => `
                <li>
                  <button class="btn" style="margin-bottom:4px;" data-idx="${idx}">${escapeHTML(item.itemName)} (${escapeHTML(item.quantity)}kg${item.price ? ', ₹'+escapeHTML(item.price)+'/kg' : ''})</button>
                </li>
              `).join('')}
            </ul>
          </div>
        `;
        show(detailsModal);
        arr.forEach((item, idx) => {
          detailsModal.querySelector(`button[data-idx="${idx}"]`).onclick = () => openDetailsModal(item, type);
        });
        $$('.modal-close').forEach(el => { el.onclick = closeModal; });
      }
    });
    markersLayer.addLayer(marker);
  });
}

// FAB
function setupFAB() {
  fab.onclick = () => {
    if (userData.role === 'farmer') openPostProduceModal();
    else openPostRequestModal();
  };
  fab.title = userData.role === 'farmer' ? 'Post Produce' : 'Post Request';
  fab.classList.remove('hidden');
}

// Details Modal (unchanged, except supports opening chat)
function openDetailsModal(item, type) {
  if (!item) return;
  detailsModal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" title="Close">&times;</button>
      <div class="modal-header">${escapeHTML(item.itemName)}</div>
      <div>
        <b>Quantity:</b> ${escapeHTML(item.quantity)} kg<br>
        ${item.price ? `<b>Price:</b> ₹${escapeHTML(item.price)}/kg<br>` : ''}
        <b>${type === 'produce' ? 'Farmer' : 'Kirana Owner'}:</b> ${escapeHTML(item.userName)}<br>
        <b>Posted:</b> ${formatTime(item.timestamp)}<br>
        <b>Location:</b> ${item.location ? `(${item.location.lat.toFixed(4)}, ${item.location.lng.toFixed(4)})` : 'Not set'}
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="wa-chat-btn">WhatsApp</button>
        <button class="btn" id="inapp-chat-btn">In-App Chat</button>
        <button class="btn btn-danger modal-close">Close</button>
      </div>
    </div>
  `;
  show(detailsModal);

  $('#wa-chat-btn').onclick = () => {
    const phone = item.userPhone.replace(/^(\+91)?/, '91');
    const msg = encodeURIComponent(`Hi, I'm interested in your ${item.itemName}!`);
    window.open(`https://wa.me/${phone}?text=${msg}`,'_blank');
  };
  $('#inapp-chat-btn').onclick = async () => {
    closeModal();
    openChatWindow(item.userId, item.userName, item.userPhone);
  };
  $$('.modal-close').forEach(el => { el.onclick = closeModal; });
}
function closeModal() {
  detailsModal.innerHTML = '';
  hide(detailsModal);
}

// Post Produce (Farmer) with edit/delete
function openPostProduceModal(editPost = null) {
  detailsModal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" title="Close">&times;</button>
      <div class="modal-header">${editPost ? 'Edit Produce' : 'Post Produce'}</div>
      <form id="produce-form">
        <label>Item Name</label>
        <input type="text" id="produce-item" required autocomplete="off" value="${editPost ? escapeHTML(editPost.itemName) : ''}">
        <label>Quantity (kg)</label>
        <input type="number" id="produce-qty" min="1" required value="${editPost ? escapeHTML(editPost.quantity) : ''}">
        <label>Price (per kg, ₹)</label>
        <input type="number" id="produce-price" min="1" required value="${editPost ? escapeHTML(editPost.price) : ''}">
        <div style="margin:10px 0;display:flex;align-items:center;gap:12px;">
          <button type="button" class="voice-mic-btn" id="produce-mic" title="Voice Input">
            <span id="mic-icn">&#127908;</span>
          </button>
          <span id="mic-status" style="font-size:0.97rem;color:#2782f9"></span>
        </div>
        <button class="btn" type="submit" style="width:100%;margin-top:10px;">${editPost ? 'Save' : 'Post'}</button>
        ${editPost ? `<button type="button" class="btn btn-danger" id="delete-post" style="width:100%;margin-top:10px;">Delete</button>` : ''}
      </form>
    </div>
  `;
  show(detailsModal);
  setupProduceVoiceInput();

  // Edit/Delete logic
  if (editPost) {
    $('#delete-post').onclick = async () => {
      if (confirm('Delete this post?')) {
        await db.collection('produce').doc(editPost.id).delete();
        closeModal();
        showSnackbar("Deleted!");
        if (isMyPostsActive) setupMyPosts();
      }
    };
  }

  $('#produce-form').onsubmit = async e => {
    e.preventDefault();
    const itemName = $('#produce-item').value.trim();
    const quantity = Number($('#produce-qty').value);
    const price = Number($('#produce-price').value);
    const submitBtn = $('#produce-form button[type=submit]');
    if (!itemName || !quantity || !price) {
      showSnackbar("Fill all fields!");
      submitBtn.disabled = false;
      return;
    }
    submitBtn.disabled = true;
    let loc = null;
    try { loc = await getUserLocation(); } catch {}
    try {
      if (editPost) {
        await db.collection('produce').doc(editPost.id).update({
          itemName, quantity, price, location: loc
        });
        showSnackbar("Updated!");
      } else {
        await db.collection('produce').add({
          itemName, quantity, price,
          userId: currentUser.uid,
          userName: userData.name,
          userPhone: userData.phone,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          location: loc
        });
        showSnackbar("Posted successfully!");
      }
      closeModal();
      if (isMyPostsActive) setupMyPosts();
    } catch (err) {
      showSnackbar("Error: " + err.message);
      submitBtn.disabled = false;
    }
  };
  $$('.modal-close').forEach(el => { el.onclick = closeModal; });
}

// Post Request (Shop Owner) with edit/delete
function openPostRequestModal(editPost = null) {
  detailsModal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" title="Close">&times;</button>
      <div class="modal-header">${editPost ? 'Edit Request' : 'Post Request'}</div>
      <form id="request-form">
        <label>Item Name</label>
        <input type="text" id="request-item" required autocomplete="off" value="${editPost ? escapeHTML(editPost.itemName) : ''}">
        <label>Quantity (kg)</label>
        <input type="number" id="request-qty" min="1" required value="${editPost ? escapeHTML(editPost.quantity) : ''}">
        <div style="margin:10px 0;">
          <button type="button" class="voice-mic-btn" id="request-mic" title="Voice Input">
            <span id="mic-icn">&#127908;</span>
          </button>
          <span id="mic-status" style="font-size:0.97rem;color:#2782f9"></span>
        </div>
        <button class="btn" type="submit" style="width:100%;margin-top:10px;">${editPost ? 'Save' : 'Post'}</button>
        ${editPost ? `<button type="button" class="btn btn-danger" id="delete-post" style="width:100%;margin-top:10px;">Delete</button>` : ''}
      </form>
    </div>
  `;
  show(detailsModal);
  setupRequestVoiceInput();

  if (editPost) {
    $('#delete-post').onclick = async () => {
      if (confirm('Delete this request?')) {
        await db.collection('requests').doc(editPost.id).delete();
        closeModal();
        showSnackbar("Deleted!");
      }
    };
  }

  $('#request-form').onsubmit = async e => {
    e.preventDefault();
    const itemName = $('#request-item').value.trim();
    const quantity = Number($('#request-qty').value);
    const submitBtn = $('#request-form button[type=submit]');
    if (!itemName || !quantity) {
      showSnackbar("Fill all fields!");
      submitBtn.disabled = false;
      return;
    }
    submitBtn.disabled = true;
    let loc = null;
    try { loc = await getUserLocation(); } catch {}
    try {
      if (editPost) {
        await db.collection('requests').doc(editPost.id).update({
          itemName, quantity, location: loc
        });
        showSnackbar("Updated!");
      } else {
        await db.collection('requests').add({
          itemName, quantity,
          userId: currentUser.uid,
          userName: userData.name,
          userPhone: userData.phone,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          location: loc
        });
        showSnackbar("Request posted!");
      }
      closeModal();
    } catch (err) {
      showSnackbar("Error: " + err.message);
      submitBtn.disabled = false;
    }
  };
  $$('.modal-close').forEach(el => { el.onclick = closeModal; });
}

// Geolocation
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject('Geolocation not available');
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject('Location permission denied')
    );
  });
}

// Voice to form: auto language detection (en-IN, fallback hi-IN)
function setupProduceVoiceInput() {
  const micBtn = $('#produce-mic');
  const statusEl = $('#mic-status');
  let recognizing = false;
  let recognition;
  micBtn.onclick = () => {
    if (recognizing) {
      recognition.stop();
      return;
    }
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      statusEl.textContent = "Voice not supported";
      return;
    }
    statusEl.textContent = "Listening...";
    let triedHindi = false;
    function startRecognition(lang) {
      recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognizing = true;
      micBtn.classList.add('active');
      recognition.onresult = e => {
        recognizing = false;
        micBtn.classList.remove('active');
        statusEl.textContent = '';
        const transcript = e.results[0][0].transcript;
        getIntentFromVoiceCommand(transcript, lang).then(intent => {
          // If price not recognized, try Hindi fallback
          if (!intent.price && !triedHindi && lang === 'en-IN') {
            triedHindi = true;
            startRecognition('hi-IN');
            return;
          }
          if (intent.item) $('#produce-item').value = intent.item;
          if (intent.quantity) $('#produce-qty').value = intent.quantity;
          if (intent.price) $('#produce-price').value = intent.price;
          if (!intent.quantity) {
            statusEl.textContent = lang === 'hi-IN'
              ? 'कृपया मात्रा बोलें (जैसे, "40 किलो")...'
              : 'Please speak quantity (e.g., "40 kilo")...';
            listenOnce(lang, result => {
              const qty = (result.match(/\d+/) || [])[0];
              if (qty) $('#produce-qty').value = qty;
              statusEl.textContent = '';
            });
          }
        });
      };
      recognition.onerror = e => {
        recognizing = false;
        micBtn.classList.remove('active');
        statusEl.textContent = "Didn't catch that. Try again.";
      };
      recognition.onend = () => {
        recognizing = false;
        micBtn.classList.remove('active');
        if (statusEl.textContent === "Listening...") statusEl.textContent = '';
      };
      recognition.start();
    }
    startRecognition('en-IN');
  };
}
function setupRequestVoiceInput() {
  const micBtn = $('#request-mic');
  const statusEl = $('#mic-status');
  let recognizing = false;
  let recognition;
  micBtn.onclick = () => {
    if (recognizing) {
      recognition.stop();
      return;
    }
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      statusEl.textContent = "Voice not supported";
      return;
    }
    statusEl.textContent = "Listening...";
    let triedHindi = false;
    function startRecognition(lang) {
      recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.lang = lang;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognizing = true;
      micBtn.classList.add('active');
      recognition.onresult = e => {
        recognizing = false;
        micBtn.classList.remove('active');
        statusEl.textContent = '';
        const transcript = e.results[0][0].transcript;
        getIntentFromVoiceCommand(transcript, lang).then(intent => {
          if (!intent.quantity && !triedHindi && lang === 'en-IN') {
            triedHindi = true;
            startRecognition('hi-IN');
            return;
          }
          if (intent.item) $('#request-item').value = intent.item;
          if (intent.quantity) $('#request-qty').value = intent.quantity;
          if (!intent.quantity) {
            statusEl.textContent = lang === 'hi-IN'
              ? 'कृपया मात्रा बोलें (जैसे, "40 किलो")...'
              : 'Please speak quantity (e.g., "40 kilo")...';
            listenOnce(lang, result => {
              const qty = (result.match(/\d+/) || [])[0];
              if (qty) $('#request-qty').value = qty;
              statusEl.textContent = '';
            });
          }
        });
      };
      recognition.onerror = e => {
        recognizing = false;
        micBtn.classList.remove('active');
        statusEl.textContent = "Didn't catch that. Try again.";
      };
      recognition.onend = () => {
        recognizing = false;
        micBtn.classList.remove('active');
        if (statusEl.textContent === "Listening...") statusEl.textContent = '';
      };
      recognition.start();
    }
    startRecognition('en-IN');
  };
}
function listenOnce(lang, cb) {
  let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = lang === 'hi-IN' ? 'hi-IN' : 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = e => cb(e.results[0][0].transcript);
  recognition.start();
}
async function getIntentFromVoiceCommand(text, lang = 'en-IN') {
  let item = '';
  let quantity = '';
  let price = '';

  let lower = text.toLowerCase();

  // Hindi and English price patterns
  // e.g. "कीमत 80", "price 80", "80 रुपये किलो", "80 per kg", "80 rs", "price per kg 80", "प्राइस अस्सी"
  let priceMatch = lower.match(/(?:rs|₹|rupees?|price|प्राइस|कीमत|भाव|दर|per|प्रति|पर)\s*:?\.?\s*([\d]+(\.\d+)?)/)
    || lower.match(/([\d]+(\.\d+)?)\s*(rs|₹|रुपये|रुपया|rupees?|price|प्राइस|कीमत|भाव|दर|पर|प्रति|per)/i);

  // Hindi number words e.g. "अस्सी" (80), "सौ" (100)
  if (!priceMatch) {
    // Try to convert Hindi number words to actual number
    const hindiNumbers = { 'शून्य':0,'एक':1,'दो':2,'तीन':3,'चार':4,'पांच':5,'छह':6,'सात':7,'आठ':8,'नौ':9,'दस':10,'बीस':20,'तीस':30,'चालीस':40,'पचास':50,'साठ':60,'सत्तर':70,'अस्सी':80,'नब्बे':90,'सौ':100 };
    for (const [word, num] of Object.entries(hindiNumbers)) {
      if (lower.includes(word)) {
        // Check if price context word is near
        let context = /(कीमत|प्राइस|भाव|दर|पर|प्रति)/;
        if (context.test(lower)) {
          price = num;
          break;
        }
      }
    }
  }
  if (priceMatch && priceMatch[1]) price = priceMatch[1];

  // Quantity (Hindi/English)
  let qtyMatch = lower.match(/(\d+(\.\d+)?)\s*(kg|kilo|kilogram|किलो|किलोग्राम)?/);
  if (qtyMatch && qtyMatch[1]) quantity = qtyMatch[1];

  // Known items
  let knownItems = [
    // English
    'tomato', 'onion', 'potato', 'cabbage', 'carrot', 'chili', 'cauliflower', 'beans', 'peas', 'brinjal', 'apple', 'banana', 'mango', 'pomegranate', 'orange', 'lemon', 'ladyfinger', 'cucumber', 'radish', 'spinach',
    // Hindi
    'टमाटर', 'प्याज', 'आलू', 'पत्ता गोभी', 'गाजर', 'मिर्च', 'फूलगोभी', 'फलियां', 'मटर', 'बैंगन', 'सेब', 'केला', 'आम', 'अनार', 'संतरा', 'नींबू', 'भिंडी', 'खीरा', 'मूली', 'पालक'
  ];
  for (const it of knownItems) {
    if (lower.includes(it)) item = it;
  }
  // Fallbacks
  if (!item) {
    let m = lower.match(/(?:kg|kilo|kilogram|किलो|किलोग्राम)\s+(\w+)/);
    if (m) item = m[1];
  }
  if (!item) {
    item = lower.split(' ').find(w => w.length > 3 && !/\d/.test(w)) || '';
  }
  if (item) item = item.charAt(0).toUpperCase() + item.slice(1);

  return { item, quantity, price };
}

// ===== CHAT 2-way: Farmer and Owner both get tabs =====
function setupChatsList() {
  // Find all chat rooms where currentUser is a participant
  db.collection('chats').get().then(snap => {
    const myRooms = [];
    snap.forEach(doc => {
      if (doc.id.includes(currentUser.uid)) myRooms.push(doc.id);
    });
    if (!myRooms.length) {
      $('#tab-content').innerHTML = `<div class="empty-state">No chats yet.</div>`;
      return;
    }
    let html = `<ul class="myposts-list">`;
    let promises = myRooms.map(roomId => {
      // Split to get other id
      let ids = roomId.split('_');
      let otherId = ids[0] === currentUser.uid ? ids[1] : ids[0];
      return db.collection('users').doc(otherId).get().then(userdoc => {
        return db.collection('chats').doc(roomId).collection('messages').orderBy('timestamp', 'desc').limit(1).get()
        .then(msgsnap => {
          let lastMsg = msgsnap.docs.length ? msgsnap.docs[0].data().text : '';
          let name = userdoc.exists ? userdoc.data().name : 'User';
          html += `<li class="myposts-item" style="cursor:pointer" data-id="${roomId}">
            <div class="myposts-title">${escapeHTML(name)}</div>
            <div class="myposts-meta">${escapeHTML(lastMsg || "No messages yet")}</div>
          </li>`;
        });
      });
    });
    Promise.all(promises).then(() => {
      html += '</ul>';
      $('#tab-content').innerHTML = html;
      $$('.myposts-item').forEach(el => {
        el.onclick = () => {
          let rid = el.dataset.id;
          let ids = rid.split('_');
          let otherId = ids[0] === currentUser.uid ? ids[1] : ids[0];
          db.collection('users').doc(otherId).get().then(doc => {
            let name = doc.exists ? doc.data().name : 'User';
            let phone = doc.exists ? doc.data().phone : '';
            openChatWindow(otherId, name, phone);
          });
        }
      });
    });
  });
}

// Chat
let chatUnsub = null;
let currentChatRoomId = null;
let otherUserId = null;
let otherUserName = '';
let otherUserPhone = '';
function openChatWindow(uid, name, phone) {
  otherUserId = uid;
  otherUserName = name;
  otherUserPhone = phone;
  const myUid = currentUser.uid;
  currentChatRoomId = myUid < uid ? `${myUid}_${uid}` : `${uid}_${myUid}`;
  chatWindow.innerHTML = `
    <div class="chat-header">
      <img src="${getAvatarUrl(name)}" class="chat-avatar" style="margin-right: 8px;">${escapeHTML(name)}
      <button class="chat-close" title="Close">&times;</button>
    </div>
    <div class="chat-messages" id="chat-messages"></div>
    <form class="chat-input-row" id="chat-form">
      <input type="text" class="chat-input" id="chat-input" autocomplete="off" placeholder="Type a message...">
      <button type="button" class="chat-mic" id="chat-mic" title="Voice Message">&#127908;</button>
      <button class="chat-send" title="Send">&#9658;</button>
    </form>
  `;
  show(chatWindow);
  $('.chat-close').onclick = closeChat;
  $('#chat-form').onsubmit = sendChatMsg;
  setupChatVoiceInput();

  if (chatUnsub) chatUnsub();
  chatUnsub = db.collection('chats').doc(currentChatRoomId)
    .collection('messages').orderBy('timestamp')
    .onSnapshot(snap => {
      const msgs = [];
      snap.forEach(doc => msgs.push(doc.data()));
      renderChatMessages(msgs);
    });
}
function closeChat() {
  chatWindow.innerHTML = '';
  hide(chatWindow);
  if (chatUnsub) chatUnsub();
  chatUnsub = null;
  currentChatRoomId = null;
  otherUserId = null;
}
async function sendChatMsg(e) {
  e.preventDefault();
  const input = $('#chat-input');
  let text = input.value.trim();
  if (!text) return;
  input.value = '';
  await db.collection('chats').doc(currentChatRoomId).collection('messages').add({
    text, senderId: currentUser.uid, senderName: userData.name,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}
function renderChatMessages(msgs) {
  const el = $('#chat-messages');
  if (!el) return;
  el.innerHTML = msgs.map(msg => {
    const me = msg.senderId === currentUser.uid;
    return `
    <div class="chat-msg-row${me ? ' me' : ''}">
      <img src="${getAvatarUrl(msg.senderName)}" class="chat-avatar" title="${escapeHTML(msg.senderName)}">
      <div class="chat-msg${me ? ' me' : ''}">
        ${escapeHTML(msg.text)}
        <div class="chat-meta">${formatTime(msg.timestamp)}</div>
      </div>
    </div>
    `;
  }).join('');
  scrollToBottom(el);
}
function setupChatVoiceInput() {
  const micBtn = $('#chat-mic');
  let recognizing = false;
  let recognition;
  micBtn.onclick = () => {
    if (recognizing) {
      recognition.stop();
      return;
    }
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      alert("Voice not supported");
      return;
    }
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognizing = true;
    micBtn.classList.add('active');
    recognition.onresult = e => {
      recognizing = false;
      micBtn.classList.remove('active');
      $('#chat-input').value = e.results[0][0].transcript;
      $('#chat-input').focus();
    };
    recognition.onerror = e => {
      recognizing = false;
      micBtn.classList.remove('active');
      alert("Didn't catch that. Try again.");
    };
    recognition.onend = () => {
      recognizing = false;
      micBtn.classList.remove('active');
    };
    recognition.start();
  };
}

// INIT
document.addEventListener('DOMContentLoaded', () => {
  setupAuth();
});

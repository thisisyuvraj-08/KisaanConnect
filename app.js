// Kisaan Connect SPA Logic (Improved)
// ===================================
// Now features: better map sizing, Instagram-like chat UI, improved voice parsing,
// "My Posts" tab, real-time chat for both parties, and post feedback snackbar.

// ---- FIREBASE INIT ----
const db = firebase.firestore();
const auth = firebase.auth();

// ---- GLOBAL STATE ----
let currentUser = null;
let userData = null;
let unsubscribeDashboard = null;
let unsubscribeMyPosts = null;
let map = null;
let markersLayer = null;
let currentPanelData = [];
let myPostsData = [];
let isMyPostsActive = false;

// ---- DOM ELEMENTS ----
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

// ---- UTILS ----
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
function randomId() { return Math.random().toString(36).slice(2,10); }
function getAvatarUrl(name) {
  // Use a simple avatar (could use dicebear, robohash, etc.)
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(name)}`;
}

// ---- AUTH SCREEN LOGIC ----
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

// ---- AUTH STATE HANDLING ----
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

// ---- LOGOUT ----
logoutBtn.onclick = async () => {
  await auth.signOut();
};

// ---- MAIN APP SETUP ----
function setupMainApp() {
  // Map
  if (!map) setupMap();
  // Dashboard and MyPosts Tabs
  setupDashboardTabs();
  // FAB
  setupFAB();
}

// ---- MAIN APP TEARDOWN ----
function teardownMainApp() {
  if (unsubscribeDashboard) unsubscribeDashboard();
  if (unsubscribeMyPosts) unsubscribeMyPosts();
  dashboardPanel.innerHTML = '';
  if (markersLayer) markersLayer.clearLayers();
  closeModal();
  closeChat();
}

// ---- MAP SETUP ----
function setupMap() {
  map = L.map('map', { zoomControl: true, attributionControl: false }).setView([23.2, 78.6], 5.5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
}

// ---- DASHBOARD TABS ----
function setupDashboardTabs() {
  dashboardPanel.innerHTML = `
    <div class="dashboard-tabs">
      <button class="tab-btn active" id="tab-market">Marketplace</button>
      <button class="tab-btn" id="tab-myposts">My Posts</button>
    </div>
    <div id="tab-content"></div>
  `;
  $('#tab-market').onclick = () => activateTab('market');
  $('#tab-myposts').onclick = () => activateTab('myposts');
  activateTab('market');
}
function activateTab(tab) {
  isMyPostsActive = (tab === 'myposts');
  $$('#dashboard-panel .tab-btn').forEach(b => b.classList.remove('active'));
  if (tab === 'market') {
    $('#tab-market').classList.add('active');
    setupDashboard();
  } else {
    $('#tab-myposts').classList.add('active');
    setupMyPosts();
  }
}

// ---- DASHBOARD: MARKET ----
function setupDashboard() {
  if (unsubscribeDashboard) unsubscribeDashboard();
  let col, oppositeRole;
  if (userData.role === 'farmer') {
    col = 'requests';
    oppositeRole = 'owner';
  } else {
    col = 'produce';
    oppositeRole = 'farmer';
  }
  unsubscribeDashboard = db.collection(col)
    .orderBy('timestamp', 'desc')
    .onSnapshot(snap => {
      const items = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      currentPanelData = items;
      renderDashboard(items, col);
      updateMapMarkers(items, col);
    });
}
function renderDashboard(items, type) {
  let html = '';
  if (!items.length) {
    html = `<div class="empty-state">
      No ${type === 'produce' ? 'produce' : 'requests'} available yet.<br>
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

// ---- MY POSTS TAB ----
function setupMyPosts() {
  if (unsubscribeMyPosts) unsubscribeMyPosts();
  let col = (userData.role === 'farmer') ? 'produce' : 'requests';
  unsubscribeMyPosts = db.collection(col)
    .where('userId', '==', currentUser.uid)
    .orderBy('timestamp', 'desc')
    .onSnapshot(snap => {
      const items = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      myPostsData = items;
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
      let col = (userData.role === 'farmer') ? 'produce' : 'requests';
      if (confirm('Delete this post?')) {
        db.collection(col).doc(id).delete();
        showSnackbar("Deleted!");
      }
    }
  });
}

// ---- MAP MARKERS ----
function updateMapMarkers(items, type) {
  if (!markersLayer) return;
  markersLayer.clearLayers();
  items.forEach(item => {
    if (!item.location || !item.location.lat || !item.location.lng) return;
    const marker = L.marker([item.location.lat, item.location.lng], {
      icon: L.icon({
        iconUrl: type === 'produce'
          ? 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/basket.svg'
          : 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/icons/bag.svg',
        iconSize: [30, 30]
      })
    });
    marker.bindTooltip(`${escapeHTML(item.itemName)}<br>${escapeHTML(item.userName)}`);
    marker.on('click', () => openDetailsModal(item, type));
    markersLayer.addLayer(marker);
  });
}

// ---- FAB LOGIC ----
function setupFAB() {
  fab.onclick = () => {
    if (userData.role === 'farmer') openPostProduceModal();
    else openPostRequestModal();
  };
  fab.title = userData.role === 'farmer' ? 'Post Produce' : 'Post Request';
}

// ---- DETAILS MODAL ----
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

// ---- POST PRODUCE MODAL (FARMER) ----
function openPostProduceModal() {
  detailsModal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" title="Close">&times;</button>
      <div class="modal-header">Post Produce</div>
      <form id="produce-form">
        <label>Item Name</label>
        <input type="text" id="produce-item" required autocomplete="off">
        <label>Quantity (kg)</label>
        <input type="number" id="produce-qty" min="1" required>
        <label>Price (per kg, ₹)</label>
        <input type="number" id="produce-price" min="1" required>
        <div style="margin:10px 0;">
          <button type="button" class="voice-mic-btn" id="produce-mic" title="Voice Input">
            <span id="mic-icn">&#127908;</span>
          </button>
          <span id="mic-status" style="font-size:0.97rem;color:#2782f9"></span>
        </div>
        <button class="btn" style="width:100%;margin-top:10px;">Post</button>
      </form>
    </div>
  `;
  show(detailsModal);
  setupProduceVoiceInput();
  $('#produce-form').onsubmit = async e => {
    e.preventDefault();
    const itemName = $('#produce-item').value.trim();
    const quantity = Number($('#produce-qty').value);
    const price = Number($('#produce-price').value);
    if (!itemName || !quantity || !price) return;
    $('#produce-form button[type=submit]').disabled = true;
    let loc = null;
    try { loc = await getUserLocation(); } catch {}
    await db.collection('produce').add({
      itemName, quantity, price,
      userId: currentUser.uid,
      userName: userData.name,
      userPhone: userData.phone,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      location: loc
    });
    closeModal();
    showSnackbar("Posted successfully!");
    // If on "My Posts", reload it immediately
    if (isMyPostsActive) setupMyPosts();
  };
  $$('.modal-close').forEach(el => { el.onclick = closeModal; });
}

// ---- POST REQUEST MODAL (OWNER) ----
function openPostRequestModal() {
  detailsModal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" title="Close">&times;</button>
      <div class="modal-header">Post Request</div>
      <form id="request-form">
        <label>Item Name</label>
        <input type="text" id="request-item" required autocomplete="off">
        <label>Quantity (kg)</label>
        <input type="number" id="request-qty" min="1" required>
        <div style="margin:10px 0;">
          <button type="button" class="voice-mic-btn" id="request-mic" title="Voice Input">
            <span id="mic-icn">&#127908;</span>
          </button>
          <span id="mic-status" style="font-size:0.97rem;color:#2782f9"></span>
        </div>
        <button class="btn" style="width:100%;margin-top:10px;">Post</button>
      </form>
    </div>
  `;
  show(detailsModal);
  setupRequestVoiceInput();
  $('#request-form').onsubmit = async e => {
    e.preventDefault();
    const itemName = $('#request-item').value.trim();
    const quantity = Number($('#request-qty').value);
    if (!itemName || !quantity) return;
    $('#request-form button[type=submit]').disabled = true;
    let loc = null;
    try { loc = await getUserLocation(); } catch {}
    await db.collection('requests').add({
      itemName, quantity,
      userId: currentUser.uid,
      userName: userData.name,
      userPhone: userData.phone,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      location: loc
    });
    closeModal();
    showSnackbar("Request posted!");
    if (isMyPostsActive) setupMyPosts();
  };
  $$('.modal-close').forEach(el => { el.onclick = closeModal; });
}

// ---- GEOLOCATION ----
function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject('Geolocation not available');
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject('Location permission denied')
    );
  });
}

// ---- VOICE TO FORM (Produce/Request) ----
function setupProduceVoiceInput() {
  setupVoiceInput(
    $('#produce-mic'), $('#mic-status'),
    async (transcript) => {
      const intent = await getIntentFromVoiceCommand(transcript);
      if (intent.item) $('#produce-item').value = intent.item;
      if (intent.quantity) $('#produce-qty').value = intent.quantity;
      if (intent.price) $('#produce-price').value = intent.price;
      if (!intent.quantity) {
        $('#mic-status').textContent = 'Please speak quantity (e.g., "40 kilo")...';
        listenOnce('hi', result => {
          const qty = (result.match(/\d+/) || [])[0];
          if (qty) $('#produce-qty').value = qty;
          $('#mic-status').textContent = '';
        });
      }
    }
  );
}
function setupRequestVoiceInput() {
  setupVoiceInput(
    $('#request-mic'), $('#mic-status'),
    async (transcript) => {
      const intent = await getIntentFromVoiceCommand(transcript);
      if (intent.item) $('#request-item').value = intent.item;
      if (intent.quantity) $('#request-qty').value = intent.quantity;
      if (!intent.quantity) {
        $('#mic-status').textContent = 'Please speak quantity (e.g., "40 kilo")...';
        listenOnce('hi', result => {
          const qty = (result.match(/\d+/) || [])[0];
          if (qty) $('#request-qty').value = qty;
          $('#mic-status').textContent = '';
        });
      }
    }
  );
}

// ---- GENERIC VOICE INPUT SETUP ----
function setupVoiceInput(micBtn, statusEl, callback) {
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
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'en-IN'; // Accepts both
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognizing = true;
    micBtn.classList.add('active');
    statusEl.textContent = "Listening...";
    recognition.onresult = e => {
      recognizing = false;
      micBtn.classList.remove('active');
      statusEl.textContent = '';
      const transcript = e.results[0][0].transcript;
      callback(transcript);
    };
    recognition.onerror = e => {
      recognizing = false;
      micBtn.classList.remove('active');
      statusEl.textContent = "Didn't catch that. Try again.";
    };
    recognition.onend = () => {
      recognizing = false;
      micBtn.classList.remove('active');
      statusEl.textContent = '';
    };
    recognition.start();
  };
}
function listenOnce(lang, cb) {
  let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = e => cb(e.results[0][0].transcript);
  recognition.start();
}

// ---- ADVANCED VOICE INTENT PARSING ----
async function getIntentFromVoiceCommand(text) {
  // Handles: "50 kg tomatoes rs 50 per kg", "I want to sell 100 kilo onions at 40 rupees", etc.
  let item = '';
  let quantity = '';
  let price = '';
  let lower = text.toLowerCase();

  // Extract quantity (number before "kg", "kilo", or just a number)
  let qtyMatch = lower.match(/(\d+(\.\d+)?)\s*(kg|kilo|kilogram|किलो)?/) || [];
  if (qtyMatch[1]) quantity = qtyMatch[1];

  // Extract price (number before/after "rs", "price", "per kg", "₹")
  let priceMatch = lower.match(/(?:rs|₹|rupees?|price|पर|per)\s*(\d+(\.\d+)?)/) || lower.match(/(\d+(\.\d+)?)\s*(rs|₹|rupees?|price|per)/i) || [];
  if (priceMatch[1]) price = priceMatch[1];

  // Extract item: the word(s) between quantity and price, or after quantity
  let itemMatch = lower;
  if (quantity) {
    itemMatch = itemMatch.split(quantity)[1] || '';
    // Remove common units/price words
    itemMatch = itemMatch.replace(/(kg|kilo|kilogram|per|price|rs|₹|rupees?|at|mein|मे|पर|प्राइस|कीमत|rs|₹|\d+)/g, '').trim();
    // If price is present, cut off after that
    if (price) itemMatch = itemMatch.split(price)[0];
    // Take first 1-2 words
    item = itemMatch.split(' ').filter(w => w.length > 2)[0] || '';
  }
  // fallback: try to find item from a veg/fruits list
  if (!item) {
    const items = ['tomato','onion','potato','cabbage','carrot','chili','cauliflower','beans','peas','brinjal','apple','banana','mango','pomegranate','orange','lemon','bhindi','ladyfinger','gobhi','gajar','mooli','radish','kheera','cucumber','mirchi'];
    for (const it of items) if (lower.includes(it)) item = it;
  }
  // fallback: just take first word after "kg" or "kilo"
  if (!item) {
    let m = lower.match(/(?:kg|kilo|kilogram|किलो)\s+(\w+)/);
    if (m) item = m[1];
  }
  // fallback: first noun-looking word
  if (!item) {
    item = lower.split(' ').find(w => w.length > 3 && !/\d/.test(w)) || '';
  }
  // Capitalize item
  if (item) item = item.charAt(0).toUpperCase() + item.slice(1);
  return { item, quantity, price };
}

// ---- CHAT LOGIC ----
let chatUnsub = null;
let currentChatRoomId = null;
let otherUserId = null;
let otherUserName = '';
let otherUserPhone = '';
function openChatWindow(uid, name, phone) {
  otherUserId = uid;
  otherUserName = name;
  otherUserPhone = phone;
  // Deterministic chat room id: [smallerUid]_[largerUid]
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

  // Real-time messages
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

// ---- CHAT VOICE INPUT ----
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

// ---- INITIALIZE ----
document.addEventListener('DOMContentLoaded', () => {
  setupAuth();
});

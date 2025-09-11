// Kisaan Connect SPA Logic
// ========================
// All functionality in this file: Auth, Firestore, Map, Dashboard, Voice, Chat, PWA
// Uses Firebase v8 compat, Leaflet, Web Speech API
// Author: github.com/Youfloww (please credit if you fork!)
// -----------------------------------------------

// ---- FIREBASE INIT ----
const db = firebase.firestore();
const auth = firebase.auth();

// ---- GLOBAL STATE ----
let currentUser = null;
let userData = null; // {name, phone, email, role, ...}
let unsubscribeDashboard = null;
let map = null;
let markersLayer = null;
let currentPanelData = []; // List of dashboard items for map sync

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

// ---- AUTH SCREEN LOGIC ----
function setupAuth() {
  // Switch Login/Register
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

  // Login
  $('#login-form').onsubmit = async e => {
    e.preventDefault();
    authError.textContent = '';
    const email = $('#login-email').value.trim();
    const pass = $('#login-password').value;
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      // onAuthStateChanged will handle rest
    } catch (err) {
      authError.textContent = err.message.replace('Firebase:', '').replace('auth/', '');
    }
  };
  // Register
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
      // onAuthStateChanged will handle rest
    } catch (err) {
      authError.textContent = err.message.replace('Firebase:', '').replace('auth/', '');
    }
  };
}

// ---- AUTH STATE HANDLING ----
auth.onAuthStateChanged(async user => {
  if (user) {
    // Fetch user data
    const doc = await db.collection('users').doc(user.uid).get();
    userData = doc.exists ? doc.data() : null;
    if (!userData) {
      // Defensive: sign user out if user doc is missing
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
  // Dashboard
  setupDashboard();
  // FAB
  setupFAB();
}

// ---- MAIN APP TEARDOWN ----
function teardownMainApp() {
  if (unsubscribeDashboard) unsubscribeDashboard();
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

// ---- DASHBOARD SETUP ----
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
  // Real-time Firestore listener
  unsubscribeDashboard = db.collection(col)
    .orderBy('timestamp', 'desc')
    .onSnapshot(snap => {
      const items = [];
      snap.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() });
      });
      currentPanelData = items;
      renderDashboard(items, col);
      updateMapMarkers(items, col);
    });
}

// ---- RENDER DASHBOARD ----
function renderDashboard(items, type) {
  if (!Array.isArray(items)) items = [];
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
            <span style="display:none">Phone: ${escapeHTML(item.userPhone || '')}</span>
          </div>
          <div class="dashboard-meta">
            <span>Posted: ${formatTime(item.timestamp)}</span>
            <span class="dashboard-tag">${type === 'produce' ? 'Produce' : 'Request'}</span>
          </div>
        </li>
      `).join('') +
      `</ul>`;
  }
  dashboardPanel.innerHTML = html;
  // Add click listeners
  $$('.dashboard-item').forEach(el => {
    el.onclick = () => openDetailsModal(items.find(i => i.id === el.dataset.id), type);
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
        <button class="btn btn-secondary" id="wa-chat-btn">Chat on WhatsApp</button>
        <button class="btn" id="inapp-chat-btn">Chat in App</button>
        <button class="btn btn-danger modal-close">Close</button>
      </div>
    </div>
  `;
  show(detailsModal);

  // WhatsApp chat
  $('#wa-chat-btn').onclick = () => {
    const phone = item.userPhone.replace(/^(\+91)?/, '91');
    const msg = encodeURIComponent(`Hi, I'm interested in your ${item.itemName}!`);
    window.open(`https://wa.me/${phone}?text=${msg}`,'_blank');
  };
  // In-App chat
  $('#inapp-chat-btn').onclick = async () => {
    closeModal();
    openChatWindow(item.userId, item.userName, item.userPhone);
  };
  // Close
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

  // Voice mic for produce form
  setupProduceVoiceInput();

  // Form submission
  $('#produce-form').onsubmit = async e => {
    e.preventDefault();
    // Get location
    const itemName = $('#produce-item').value.trim();
    const quantity = Number($('#produce-qty').value);
    const price = Number($('#produce-price').value);
    if (!itemName || !quantity || !price) return;
    $('#produce-form button[type=submit]').disabled = true;
    let loc = null;
    try {
      loc = await getUserLocation();
    } catch {}
    await db.collection('produce').add({
      itemName, quantity, price,
      userId: currentUser.uid,
      userName: userData.name,
      userPhone: userData.phone,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      location: loc
    });
    closeModal();
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

  // Voice mic for request form
  setupRequestVoiceInput();

  // Form submission
  $('#request-form').onsubmit = async e => {
    e.preventDefault();
    const itemName = $('#request-item').value.trim();
    const quantity = Number($('#request-qty').value);
    if (!itemName || !quantity) return;
    $('#request-form button[type=submit]').disabled = true;
    let loc = null;
    try {
      loc = await getUserLocation();
    } catch {}
    await db.collection('requests').add({
      itemName, quantity,
      userId: currentUser.uid,
      userName: userData.name,
      userPhone: userData.phone,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      location: loc
    });
    closeModal();
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
      // Simulate AI intent extraction
      const intent = await getIntentFromVoiceCommand(transcript);
      if (intent.item) $('#produce-item').value = intent.item;
      if (intent.quantity) $('#produce-qty').value = intent.quantity;
      if (intent.price) $('#produce-price').value = intent.price;
      // If missing quantity, ask again
      if (!intent.quantity) {
        $('#mic-status').textContent = 'Please speak quantity (e.g., "40 kilo")...';
        listenOnce('hi', result => {
          // Try to extract number
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
    recognition.lang = 'hi-IN'; // allow Hindi/English
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
// For quick, one-off secondary listens (e.g., ask for missing quantity)
function listenOnce(lang, cb) {
  let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = lang === 'hi' ? 'hi-IN' : 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = e => cb(e.results[0][0].transcript);
  recognition.start();
}

// ---- SIMULATED AI INTENT/TRANSLATE (REPLACE WITH API) ----
async function getIntentFromVoiceCommand(text) {
  // Simulate: "40 kilo pyaaz 20 rupaye mein post karo"
  let item = '';
  let quantity = '';
  let price = '';
  // Try to extract numbers and common item names
  const nums = text.match(/\d+/g) || [];
  if (text.match(/kilo|kg|किलो|किलोग्राम/)) quantity = nums[0];
  if (text.match(/रुप[एये]|rupee|price|₹/i)) price = nums[1] || nums[0];
  if (!quantity && nums.length === 1) quantity = nums[0];
  // Try to extract item name
  // Heuristic: take word after kilo
  let m = text.match(/kilo\s+(\w+)/i) || text.match(/किलो\s+(\w+)/i);
  if (m) item = m[1];
  else {
    // fallback: find one common veg
    const items = ['pyaaz','onion','aloo','potato','tamatar','tomato','mirchi','chili','gobhi','cauliflower','bhindi','ladyfinger','gajar','carrot','mooli','radish','baingan','brinjal','kheera','cucumber'];
    for (const it of items) {
      if (text.toLowerCase().includes(it)) { item = it; break; }
    }
  }
  // fallback: take first word if nothing found
  if (!item) {
    item = text.split(/\s/).find(w => w.length > 3) || text.split(/\s/)[0];
  }
  return { item, quantity, price };
}
async function translateText(text, toLang) {
  // Simulate translation: for demo, just return text with [HIN] or [ENG] prefix
  if (toLang === 'hi') {
    // Very basic: replace some veg names
    return text.replace(/onion/gi,"प्याज")
               .replace(/potato/gi,"आलू")
               .replace(/tomato/gi,"टमाटर")
               .replace(/kg/gi,"किलो") + " [हिन्दी]";
  } else {
    return text.replace(/प्याज/g,"onion")
               .replace(/आलू/g,"potato")
               .replace(/टमाटर/g,"tomato")
               .replace(/किलो/g,"kg") + " [EN]";
  }
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
  // Chat window UI
  chatWindow.innerHTML = `
    <div class="chat-header">
      Chat with ${escapeHTML(name)}
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
  // Close
  $('.chat-close').onclick = closeChat;
  // Send message
  $('#chat-form').onsubmit = sendChatMsg;
  // Voice message
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
    text, senderId: currentUser.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
}
function renderChatMessages(msgs) {
  const el = $('#chat-messages');
  if (!el) return;
  el.innerHTML = msgs.map(msg => `
    <div class="chat-msg${msg.senderId === currentUser.uid ? ' me' : ''}">
      ${escapeHTML(msg.text)}
      <div class="chat-meta">${formatTime(msg.timestamp)}</div>
    </div>
  `).join('');
  scrollToBottom(el);

  // Voice: If user is farmer & incoming msg is English, auto-translate and read aloud
  if (userData.role === 'farmer' && msgs.length) {
    const last = msgs[msgs.length - 1];
    if (last.senderId !== currentUser.uid) {
      // Simulate detection: if last msg has only ascii, treat as English
      if (/^[\x00-\x7F ]+$/.test(last.text)) {
        translateText(last.text, 'hi').then(hindiText => {
          speakHindi(hindiText);
          // Optionally, also display the Hindi translation below in the chat
          el.lastChild.innerHTML += `<div class="chat-meta" style="color:#2782f9;">${escapeHTML(hindiText)}</div>`;
        });
      }
    }
  }
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
    recognition.lang = 'hi-IN'; // Accepts both
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognizing = true;
    micBtn.classList.add('active');
    recognition.onresult = e => {
      recognizing = false;
      micBtn.classList.remove('active');
      const transcript = e.results[0][0].transcript;
      $('#chat-input').value = transcript;
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

// ---- TEXT TO SPEECH (HINDI) ----
function speakHindi(text) {
  if (!('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'hi-IN';
  utter.rate = 0.98;
  // Try to pick a Hindi voice
  const voices = window.speechSynthesis.getVoices();
  utter.voice = voices.find(v => v.lang === 'hi-IN') || null;
  window.speechSynthesis.speak(utter);
}

// ---- INITIALIZE ----
document.addEventListener('DOMContentLoaded', () => {
  setupAuth();
});
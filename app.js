/* Kisaan Connect - app.js
   Author: Hackathon-ready, robust, clean, ES6+, vanilla JS only!
   Features: Firebase Auth/Firestore, Map (Leaflet), Real-time, Voice Assistant, Chat, Accessibility
*/

// --- GLOBAL STATE ---
let currentUser = null;
let userData = null;
let map = null;
let userMarker = null;
let markersGroup = null;
let myLocation = null; // {lat, lng}
let produceUnsub = null, requestsUnsub = null;
let marketplaceItems = []; // items shown in dashboard/map
let myPosts = []; // user's own produce or requests
let currentDashboardTab = 'marketplace'; // or 'my-posts'
let chatUnsub = null;
let activeChatRoomId = null;
let activeChatOtherUser = null;

// --- FIREBASE REFS ---
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM ELEMENTS ---
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// Auth
const authSection = $('#auth-section');
const loginForm = $('#login-form');
const registerForm = $('#register-form');
const toggleAuth = $('#toggle-auth');
const authTitle = $('#auth-title');
const authError = $('#auth-error');

// Header & Main UI
const mainHeader = $('#main-header');
const userNameSpan = $('#user-name');
const logoutBtn = $('#logout-btn');
const appMain = $('#app-main');
const fab = $('#fab');

// Map & Dashboard
const mapPanel = $('#map-panel');
const dashboardPanel = $('#dashboard-panel');
const dashboardList = $('#dashboard-list');
const marketplaceTab = $('#marketplace-tab');
const myPostsTab = $('#my-posts-tab');

// Modals
const postModal = $('#post-modal');
const postModalTitle = $('#post-modal-title');
const closePostModalBtn = $('#close-post-modal');
const postForm = $('#post-form');
const itemNameInput = $('#item-name');
const quantityInput = $('#quantity');
const unitSelect = $('#unit');
const priceInput = $('#price');
const priceUnitSelect = $('#price-unit');
const voiceBtn = $('#voice-btn');
const voiceStatus = $('#voice-status');
const postError = $('#post-error');

const detailsModal = $('#details-modal');
const closeDetailsModalBtn = $('#close-details-modal');
const closeDetailsBtn = $('#close-details-btn');
const detailsTitle = $('#details-title');
const detailsInfo = $('#details-info');
const whatsappBtn = $('#whatsapp-btn');
const inappChatBtn = $('#inapp-chat-btn');

// Chat
const chatWindow = $('#chat-window');
const chatHeader = $('.chat-header');
const chatUserName = $('#chat-user-name');
const closeChatWindowBtn = $('#close-chat-window');
const chatMessagesDiv = $('#chat-messages');
const chatForm = $('#chat-form');
const chatInput = $('#chat-input');
const chatSendBtn = $('#chat-send-btn');
const chatVoiceBtn = $('#chat-voice-btn');

// Loader
const loader = $('#loader');

// --- UTILS ---
function showLoader(show = true) {
  loader.classList.toggle('hidden', !show);
}
function showError(el, msg) {
  el.textContent = msg || '';
}
function clearForm(form) {
  Array.from(form.elements).forEach(el => {
    if (el.tagName === "INPUT" || el.tagName === "SELECT") el.value = '';
  });
}
function formatTimestamp(ts) {
  if (!ts) return '';
  let d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
}
function haversineDist(lat1, lng1, lat2, lng2) {
  // Returns distance in km
  const toRad = d => d * Math.PI / 180;
  let R = 6371;
  let dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  let a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function getChatRoomId(uid1, uid2, refId) {
  // refId is produce/request docId
  return [uid1, uid2].sort().join('_') + '_' + refId;
}

// --- AUTH LOGIC ---
auth.onAuthStateChanged(async user => {
  if (user) {
    currentUser = user;
    showLoader(true);
    // Fetch user data
    let u = await db.collection('users').doc(user.uid).get();
    if (u.exists) {
      userData = u.data();
      initApp();
    } else {
      // Should not happen, but edge case
      auth.signOut();
      showLoader(false);
    }
  } else {
    currentUser = null;
    userData = null;
    showAuth();
  }
});

// --- AUTH UI ---
function showAuth() {
  showLoader(false);
  mainHeader.classList.add('hidden');
  appMain.classList.add('hidden');
  authSection.classList.remove('hidden');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  authTitle.textContent = "Login";
  showError(authError, '');
  clearForm(loginForm);
  clearForm(registerForm);
  toggleAuth.textContent = "Don't have an account? Register";
  toggleAuth.onclick = () => {
    if (loginForm.classList.contains('hidden')) {
      loginForm.classList.remove('hidden');
      registerForm.classList.add('hidden');
      authTitle.textContent = "Login";
      toggleAuth.textContent = "Don't have an account? Register";
      showError(authError, '');
    } else {
      loginForm.classList.add('hidden');
      registerForm.classList.remove('hidden');
      authTitle.textContent = "Register";
      toggleAuth.textContent = "Already have an account? Login";
      showError(authError, '');
    }
  };
}

// --- LOGIN/REGISTER EVENTS ---
loginForm.onsubmit = async e => {
  e.preventDefault();
  showLoader(true);
  showError(authError, '');
  try {
    let email = $('#login-email').value, pw = $('#login-password').value;
    await auth.signInWithEmailAndPassword(email, pw);
  } catch (err) {
    showError(authError, err.message.replace("Firebase:", ""));
    showLoader(false);
  }
};
registerForm.onsubmit = async e => {
  e.preventDefault();
  showLoader(true);
  showError(authError, '');
  try {
    let name = $('#register-name').value.trim(),
        phone = $('#register-phone').value.trim(),
        email = $('#register-email').value.trim(),
        pw = $('#register-password').value,
        role = $('#register-role').value;
    if (!/^[6-9]\d{9}$/.test(phone)) throw new Error("Enter valid Indian phone number");
    let cred = await auth.createUserWithEmailAndPassword(email, pw);
    await db.collection('users').doc(cred.user.uid).set({
      name, email, phone, role
    });
  } catch (err) {
    showError(authError, err.message.replace("Firebase:", ""));
    showLoader(false);
  }
};

// --- LOGOUT ---
logoutBtn.onclick = () => {
  auth.signOut();
};

// --- INIT MAIN APP ---
async function initApp() {
  // UI
  showLoader(false);
  mainHeader.classList.remove('hidden');
  appMain.classList.remove('hidden');
  authSection.classList.add('hidden');
  userNameSpan.textContent = userData.name;
  fab.classList.remove('hidden');
  myPostsTab.classList.toggle('hidden', userData.role !== 'farmer');
  // Map
  if (!map) {
    map = L.map('map', { zoomControl: true }).setView([22.9734, 78.6569], 6); // India center
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: "© OSM",
      maxZoom: 19
    }).addTo(map);
    markersGroup = L.layerGroup().addTo(map);
  }
  // Get location
  getLocation();
  // Setup dashboard
  setupDashboard();
  // FAB handler
  fab.onclick = showPostModal;
}

// --- LOCATION ---
function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      myLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.marker([myLocation.lat, myLocation.lng], { title: "You", icon: L.icon({
        iconUrl: 'https://cdn.jsdelivr.net/npm/leaflet@1.7.1/dist/images/marker-icon-2x-green.png',
        iconSize: [25, 41], iconAnchor: [12,41]
      })}).addTo(map);
      map.setView([myLocation.lat, myLocation.lng], 13);
      refreshMarketplace();
    }, err => {
      // Location denied: fallback
      myLocation = { lat: 22.9734, lng: 78.6569 };
      refreshMarketplace();
    }, { enableHighAccuracy: true, timeout: 10000 });
  } else {
    myLocation = { lat: 22.9734, lng: 78.6569 };
    refreshMarketplace();
  }
}

// --- DASHBOARD & REALTIME ---
function setupDashboard() {
  // Tabs
  if (userData.role === 'farmer') {
    marketplaceTab.textContent = "Marketplace";
    myPostsTab.textContent = "My Posts";
    myPostsTab.onclick = () => { currentDashboardTab = 'my-posts'; renderDashboard(); myPostsTab.classList.add('active'); marketplaceTab.classList.remove('active'); };
    marketplaceTab.onclick = () => { currentDashboardTab = 'marketplace'; renderDashboard(); marketplaceTab.classList.add('active'); myPostsTab.classList.remove('active'); };
    myPostsTab.classList.remove('hidden');
    marketplaceTab.classList.add('active');
    myPostsTab.classList.remove('active');
  } else {
    marketplaceTab.textContent = "Marketplace";
    myPostsTab.classList.add('hidden');
    marketplaceTab.classList.add('active');
  }
  // Listen to produce/requests
  refreshMarketplace();
}
function refreshMarketplace() {
  // Unsubscribe old listeners
  if (produceUnsub) produceUnsub();
  if (requestsUnsub) requestsUnsub();
  // Farmer: see all requests (other users), and own produce in "my-posts"
  // Owner: see produce within 10km, latest first
  if (userData.role === 'farmer') {
    // Requests (marketplace)
    requestsUnsub = db.collection('requests')
      .orderBy('timestamp', 'desc')
      .onSnapshot(snap => {
        marketplaceItems = [];
        snap.forEach(doc => {
          let data = doc.data();
          if (data.userId !== currentUser.uid) {
            marketplaceItems.push({ ...data, id: doc.id, type: 'request' });
          }
        });
        renderDashboard();
        renderMap();
      });
    // My posts
    produceUnsub = db.collection('produce')
      .where('userId', '==', currentUser.uid)
      .orderBy('timestamp', 'desc')
      .onSnapshot(snap => {
        myPosts = [];
        snap.forEach(doc => {
          myPosts.push({ ...doc.data(), id: doc.id, type: 'produce' });
        });
        if (currentDashboardTab === 'my-posts') renderDashboard();
      });
  } else {
    // Owners: show all produce within 10km, latest first
    produceUnsub = db.collection('produce')
      .orderBy('timestamp', 'desc')
      .onSnapshot(snap => {
        marketplaceItems = [];
        snap.forEach(doc => {
          let data = doc.data();
          if (data.userId !== currentUser.uid && data.location) {
            let dist = haversineDist(
              myLocation.lat, myLocation.lng,
              data.location.lat, data.location.lng
            );
            if (dist <= 10) {
              marketplaceItems.push({ ...data, id: doc.id, type: 'produce', dist: dist });
            }
          }
        });
        // Sort by newest first
        marketplaceItems.sort((a, b) => b.timestamp - a.timestamp);
        renderDashboard();
        renderMap();
      });
  }
}

// --- DASHBOARD RENDER ---
function renderDashboard() {
  dashboardList.innerHTML = '';
  let items = [];
  if (userData.role === 'farmer') {
    if (currentDashboardTab === 'marketplace') items = marketplaceItems;
    else items = myPosts;
  } else {
    items = marketplaceItems;
  }
  if (!items.length) {
    dashboardList.innerHTML = `<div style="text-align:center;opacity:.7;margin-top:2.5rem;">No items to display.</div>`;
    return;
  }
  for (let item of items) {
    let html = `
      <div class="dashboard-card" data-type="${item.type}" data-id="${item.id}">
        <div class="card-header">
          <span class="material-icons" style="font-size:1.4em;color:${item.type==='produce'?'#388e3c':'#ffb300'};">
            ${item.type === 'produce' ? 'spa' : 'storefront'}
          </span>
          <span>${item.itemName} <span style="font-size:.92em;opacity:.7;">(${item.quantity} ${item.unit})</span></span>
        </div>
        <div class="card-meta">
          Price: ₹${item.price} /${item.priceUnit}
          ${item.dist !== undefined ? `<span style="float:right;">${item.dist.toFixed(1)} km</span>` : ''}
        </div>
        <div class="card-footer">
          <span>By: ${item.userName}</span>
          <span>${formatTimestamp(item.timestamp)}</span>
        </div>
      </div>
    `;
    let d = document.createElement('div');
    d.innerHTML = html;
    let card = d.firstElementChild;
    card.onclick = () => showDetailsModal(item);
    dashboardList.appendChild(card);
  }
}

// --- MAP RENDER ---
function renderMap() {
  markersGroup.clearLayers();
  let items = marketplaceItems;
  // Show markers for relevant items
  for (let item of items) {
    if (!item.location) continue;
    let marker = L.marker([item.location.lat, item.location.lng], {
      icon: L.icon({
        iconUrl: item.type==='produce' 
          ? 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-green.png'
          : 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-yellow.png',
        iconSize: [25,41],
        iconAnchor: [12,41]
      })
    });
    marker.bindTooltip(`${item.itemName} (${item.quantity} ${item.unit})<br>₹${item.price}/${item.priceUnit}`, {direction:'top'});
    marker.on('click', () => showDetailsModal(item));
    markersGroup.addLayer(marker);
  }
}

// --- POST/REQUEST CREATION ---
function showPostModal() {
  clearForm(postForm);
  showError(postError, '');
  voiceStatus.textContent = '';
  voiceBtn.classList.remove('active');
  if (userData.role === 'farmer') postModalTitle.textContent = "Post Produce";
  else postModalTitle.textContent = "Post Request";
  postModal.classList.remove('hidden');
  // Voice handler
  voiceBtn.onclick = startVoiceInputForPost;
}
closePostModalBtn.onclick = () => postModal.classList.add('hidden');

postForm.onsubmit = async e => {
  e.preventDefault();
  showError(postError, '');
  let itemName = itemNameInput.value.trim();
  let quantity = quantityInput.value.trim();
  let unit = unitSelect.value;
  let price = priceInput.value.trim();
  let priceUnit = priceUnitSelect.value;
  if (!itemName || !quantity || !price) {
    showError(postError, "Please fill all fields.");
    return;
  }
  showLoader(true);
  let doc = {
    itemName,
    quantity,
    unit,
    price,
    priceUnit,
    userId: currentUser.uid,
    userName: userData.name,
    userPhone: userData.phone,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    location: myLocation
  };
  try {
    if (userData.role === 'farmer') {
      await db.collection('produce').add(doc);
    } else {
      await db.collection('requests').add(doc);
    }
    postModal.classList.add('hidden');
    showLoader(false);
  } catch (err) {
    showError(postError, err.message);
    showLoader(false);
  }
};

// --- VOICE ASSISTANT FOR POST FORM ---
function startVoiceInputForPost() {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    voiceStatus.textContent = "Voice input not supported.";
    return;
  }
  voiceBtn.classList.add('active');
  voiceStatus.textContent = "Listening...";
  let Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recog = new Recognition();
  recog.lang = 'hi-IN'; // Accept Hindi + English
  recog.interimResults = false;
  recog.maxAlternatives = 1;
  recog.start();
  recog.onresult = async ev => {
    let transcript = ev.results[0][0].transcript;
    voiceStatus.textContent = "Processing...";
    // Simulate AI intent extraction
    let intent = await getIntentFromVoiceCommand(transcript);
    if (intent.item && intent.quantity && intent.price) {
      itemNameInput.value = intent.item;
      quantityInput.value = intent.quantity;
      unitSelect.value = intent.unit || 'kg';
      priceInput.value = intent.price;
      priceUnitSelect.value = intent.priceUnit || 'kg';
      voiceStatus.textContent = "Fields auto-filled!";
    } else {
      voiceStatus.textContent = "Could not extract all fields. Please try again.";
    }
    voiceBtn.classList.remove('active');
  };
  recog.onerror = e => {
    voiceStatus.textContent = "Voice error: " + e.error;
    voiceBtn.classList.remove('active');
  };
  recog.onend = () => {
    if (voiceBtn.classList.contains('active')) voiceBtn.classList.remove('active');
  };
}

// --- DETAILS MODAL ---
function showDetailsModal(item) {
  detailsTitle.textContent = item.type === 'produce' ? "Produce Details" : "Request Details";
  detailsInfo.innerHTML = `
    <b>Item:</b> ${item.itemName}<br>
    <b>Quantity:</b> ${item.quantity} ${item.unit}<br>
    <b>Price:</b> ₹${item.price} /${item.priceUnit}<br>
    <b>Posted by:</b> ${item.userName}<br>
    <b>Contact:</b> ${item.userPhone}<br>
    <b>Posted on:</b> ${formatTimestamp(item.timestamp)}
  `;
  // WhatsApp
  whatsappBtn.onclick = () => {
    let msg = encodeURIComponent(`Hi, I'm interested in your ${item.itemName} (${item.quantity} ${item.unit}) listed on Kisaan Connect.`);
    window.open(`https://wa.me/91${item.userPhone}?text=${msg}`, '_blank');
  };
  // In-app chat
  inappChatBtn.onclick = () => {
    detailsModal.classList.add('hidden');
    openChatWindow(item);
  };
  closeDetailsModalBtn.onclick = closeDetailsBtn.onclick = () => detailsModal.classList.add('hidden');
  detailsModal.classList.remove('hidden');
}

// --- CHAT WINDOW ---
function openChatWindow(item) {
  // Chat between currentUser and item.userId, refId = item.id
  let otherUserId = item.userId;
  let chatRoomId = getChatRoomId(currentUser.uid, otherUserId, item.id);
  activeChatRoomId = chatRoomId;
  activeChatOtherUser = { id: otherUserId, name: item.userName, phone: item.userPhone };
  chatUserName.textContent = item.userName;
  chatWindow.classList.remove('hidden');
  chatMessagesDiv.innerHTML = '';
  // Unsubscribe old
  if (chatUnsub) chatUnsub();
  // Listen to messages
  chatUnsub = db.collection('chats').doc(chatRoomId).collection('messages')
    .orderBy('timestamp')
    .onSnapshot(snap => {
      chatMessagesDiv.innerHTML = '';
      snap.forEach(doc => {
        let msg = doc.data();
        let sent = msg.senderId === currentUser.uid;
        let div = document.createElement('div');
        div.className = 'chat-message ' + (sent ? 'sent':'received');
        div.innerHTML = `
          <span>${msg.text}</span>
          <span class="timestamp">${formatTimestamp(msg.timestamp)}</span>
        `;
        chatMessagesDiv.appendChild(div);
        // If farmer and received a message from owner in English: translate, speak
        if (
          userData.role === 'farmer' && !sent &&
          msg.senderId !== currentUser.uid &&
          msg.text
        ) {
          // Simulate translation
          translateText(msg.text, 'en', 'hi').then(hindiText => {
            let div2 = document.createElement('div');
            div2.className = 'chat-message received';
            div2.style.background = "#fff9c4";
            div2.innerHTML = `<span>${hindiText} <span style="font-size:.92em;color:#bdb76b;">(अनुवाद)</span></span>`;
            chatMessagesDiv.appendChild(div2);
            speakHindi(hindiText);
          });
        }
      });
      // Scroll to bottom
      chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    });
}
closeChatWindowBtn.onclick = () => {
  chatWindow.classList.add('hidden');
  if (chatUnsub) chatUnsub();
};

// --- SEND CHAT ---
chatForm.onsubmit = async e => {
  e.preventDefault();
  let text = chatInput.value.trim();
  if (!text || !activeChatRoomId) return;
  chatInput.value = '';
  await db.collection('chats').doc(activeChatRoomId).collection('messages').add({
    text,
    senderId: currentUser.uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
};
// --- Voice chat (mic) ---
chatVoiceBtn.onclick = () => {
  if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
    chatInput.value = "Voice input not supported.";
    return;
  }
  chatVoiceBtn.classList.add('active');
  let Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recog = new Recognition();
  recog.lang = 'hi-IN';
  recog.interimResults = false;
  recog.maxAlternatives = 1;
  recog.start();
  recog.onresult = ev => {
    let transcript = ev.results[0][0].transcript;
    chatInput.value = transcript;
    chatVoiceBtn.classList.remove('active');
  };
  recog.onerror = e => {
    chatInput.value = "Voice error: " + e.error;
    chatVoiceBtn.classList.remove('active');
  };
  recog.onend = () => {
    chatVoiceBtn.classList.remove('active');
  };
};

// --- SIMULATED AI FUNCTIONS ---
// Simulate extraction of {item, quantity, unit, price, priceUnit} from sentence.
async function getIntentFromVoiceCommand(text) {
  // Try to extract: "50 kg onion at 20 rupees per kg"
  text = text.toLowerCase();
  let item = '', quantity = '', unit = '', price = '', priceUnit = '';
  // Find quantity and unit
  let match1 = text.match(/(\d+)\s*(kg|quintal|piece|kilogram|pieces)?/);
  if (match1) {
    quantity = match1[1];
    unit = match1[2] || 'kg';
    if (unit === 'kilogram') unit = 'kg';
    if (unit === 'pieces') unit = 'piece';
  }
  // Find price
  let match2 = text.match(/(\d+)\s*(rs|rupees|₹)\s*(per|\/)\s*(kg|quintal|piece)?/);
  if (match2) {
    price = match2[1];
    priceUnit = match2[4] || 'kg';
  } else {
    // Try: "20 rupees per kg" after quantity+item
    let match3 = text.match(/at\s*(\d+)\s*(rs|rupees|₹)?\s*(per|\/)?\s*(kg|quintal|piece)?/);
    if (match3) {
      price = match3[1];
      priceUnit = match3[4] || 'kg';
    }
  }
  // Find item name: look for word after quantity/unit
  let afterQ = text.split(match1 ? match1[0] : '')[1] || '';
  let itemMatch = afterQ.match(/([a-zA-Z\u0900-\u097F]+)/); // Hindi/English
  if (itemMatch) {
    item = itemMatch[1].trim();
  }
  // Fallback: try to find first word that is not a number/unit/price
  if (!item) {
    let fallback = text.match(/(onion|pyaaz|potato|aloo|tomato|tamatar|[a-zA-Z\u0900-\u097F]+)/);
    if (fallback) item = fallback[1];
  }
  return { item, quantity, unit, price, priceUnit };
}
// Simulate translation (returns Hindi for demo)
async function translateText(text, from, to) {
  // You may use a lookup or dummy translation for hackathon
  // We'll just append (Hindi) for demo
  if (to === 'hi') {
    // Simulate: Only handle English produce sentences
    let tr = {
      "hello": "नमस्ते",
      "i am interested": "मुझे रुचि है",
      "how much": "कितना",
      "what is the price": "क्या भाव है",
      "can you deliver": "क्या आप डिलीवर कर सकते हैं"
    };
    let lower = text.toLowerCase();
    for (let k in tr) {
      if (lower.includes(k)) return tr[k];
    }
    return text + " (हिंदी अनुवाद)";
  }
  return text;
}
// Speak Hindi text
function speakHindi(text) {
  if (!('speechSynthesis' in window)) return;
  let utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'hi-IN';
  window.speechSynthesis.speak(utter);
}

// --- MISC UI ---
window.onclick = e => {
  // Close modal if clicked outside
  if (e.target === postModal) postModal.classList.add('hidden');
  if (e.target === detailsModal) detailsModal.classList.add('hidden');
};
window.onkeydown = e => {
  if (e.key === "Escape") {
    if (!postModal.classList.contains('hidden')) postModal.classList.add('hidden');
    if (!detailsModal.classList.contains('hidden')) detailsModal.classList.add('hidden');
    if (!chatWindow.classList.contains('hidden')) chatWindow.classList.add('hidden');
  }
};

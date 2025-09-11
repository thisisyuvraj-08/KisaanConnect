// Kisaan Connect - app.js (improved, bugfixed, all features!)

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
let postEditId = null; // editing post id

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

// Expiration field (created dynamically in showPostModalEdit if not present)
let expirationInput = null;

// Details Modal
const detailsModal = $('#details-modal');
const closeDetailsModalBtn = $('#close-details-modal');
const closeDetailsBtn = $('#close-details-btn');
const detailsTitle = $('#details-title');
const detailsInfo = $('#details-info');
const whatsappBtn = $('#whatsapp-btn');
const inappChatBtn = $('#inapp-chat-btn');

// Chat
const chatWindow = $('#chat-window');
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
function formatDateOnly(ts) {
  let d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-CA');
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
function isExpired(expiry) {
  if (!expiry) return false;
  let now = new Date();
  let exp = expiry.toDate ? expiry.toDate() : new Date(expiry);
  return now > exp;
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
  fab.onclick = () => showPostModalEdit();
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
    // Owners: show all produce within 10km, latest first, not expired
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
            if (dist <= 10 && !isExpired(data.expiration)) {
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
    if (currentDashboardTab === 'my-posts') items = myPosts;
    else items = marketplaceItems;
  } else {
    items = marketplaceItems;
  }
  if (!items.length) {
    dashboardList.innerHTML = `<div style="text-align:center;opacity:.7;margin-top:2.5rem;">No items to display.</div>`;
    return;
  }
  for (let item of items) {
    let expired = isExpired(item.expiration);
    let html = `
      <div class="dashboard-card" data-type="${item.type}" data-id="${item.id}">
        <div class="card-header">
          <span class="material-icons" style="font-size:1.25em;color:${item.type==='produce'?'#388e3c':'#ffb300'};">
            ${item.type === 'produce' ? 'spa' : 'storefront'}
          </span>
          <span>${item.itemName} <span style="font-size:.92em;opacity:.7;">(${item.quantity} ${item.unit})</span></span>
          ${expired ? `<span class="expired-label">Expired</span>` : item.type === 'produce' ? `<span class="active-label">Active</span>` : ''}
        </div>
        <div class="card-meta">
          Price: ₹${item.price} /${item.priceUnit}
          ${item.dist !== undefined ? `<span>${item.dist.toFixed(1)} km</span>` : ''}
        </div>
        <div class="card-footer">
          <span>By: ${item.userName}</span>
          <span>${formatTimestamp(item.timestamp)}</span>
        </div>
        <div class="card-footer">
          <span>Expires: ${item.expiration ? formatDateOnly(item.expiration) : 'N/A'}</span>
        </div>
        ${userData.role === 'farmer' && currentDashboardTab === 'my-posts' ? `
        <div class="card-actions">
          <button class="edit-btn" data-id="${item.id}">Edit</button>
          <button class="delete-btn" data-id="${item.id}">Delete</button>
          <button class="chat-btn" data-id="${item.id}">View Chats</button>
        </div>
        ` : ''}
      </div>
    `;
    let d = document.createElement('div');
    d.innerHTML = html;
    let card = d.firstElementChild;

    // Card click (show details) for non-my-posts (or my-posts only if not expired)
    if (!(userData.role === 'farmer' && currentDashboardTab === 'my-posts')) {
      card.onclick = () => showDetailsModal(item);
    }

    // Edit/Delete/Chat buttons for Farmer "My Posts"
    if (userData.role === 'farmer' && currentDashboardTab === 'my-posts') {
      card.querySelector('.edit-btn').onclick = (e) => {
        e.stopPropagation();
        showPostModalEdit(item);
      };
      card.querySelector('.delete-btn').onclick = (e) => {
        e.stopPropagation();
        deleteProduce(item.id);
      };
      card.querySelector('.chat-btn').onclick = (e) => {
        e.stopPropagation();
        openFarmerChats(item);
      };
    }
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

// --- POST/REQUEST CREATION & EDIT ---
function showPostModalEdit(item = null) {
  clearForm(postForm);
  showError(postError, '');
  voiceStatus.textContent = '';
  voiceBtn.classList.remove('active');
  postEditId = null;

  // Expiration field
  if (!expirationInput) {
    expirationInput = document.createElement('input');
    expirationInput.type = 'date';
    expirationInput.id = 'expiration';
    expirationInput.required = true;
    expirationInput.style.marginBottom = ".7rem";
    let row = document.createElement('div');
    row.className = 'input-row';
    row.appendChild(expirationInput);
    postForm.insertBefore(row, postForm.querySelector('.voice-row'));
  }

  // Set default expiration (2 days from now) if adding new
  let today = new Date();
  let defaultExp = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);
  let minDate = today.toISOString().split('T')[0];
  expirationInput.min = minDate;

  if (item) {
    postModalTitle.textContent = "Edit Post";
    itemNameInput.value = item.itemName;
    quantityInput.value = item.quantity;
    unitSelect.value = item.unit;
    priceInput.value = item.price;
    priceUnitSelect.value = item.priceUnit;
    expirationInput.value = item.expiration ? formatDateOnly(item.expiration) : defaultExp.toISOString().split('T')[0];
    postEditId = item.id;
  } else {
    postModalTitle.textContent = userData.role === 'farmer' ? "Post Produce" : "Post Request";
    expirationInput.value = defaultExp.toISOString().split('T')[0];
    postEditId = null;
  }
  postModal.classList.remove('hidden');
  voiceBtn.onclick = startVoiceInputForPost;
}
closePostModalBtn.onclick = () => { postModal.classList.add('hidden'); postEditId = null; };

// Submit new or edit
postForm.onsubmit = async e => {
  e.preventDefault();
  showError(postError, '');
  let itemName = itemNameInput.value.trim();
  let quantity = quantityInput.value.trim();
  let unit = unitSelect.value;
  let price = priceInput.value.trim();
  let priceUnit = priceUnitSelect.value;
  let expirationDate = expirationInput.value;
  if (!itemName || !quantity || !price || !expirationDate) {
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
    location: myLocation,
    expiration: firebase.firestore.Timestamp.fromDate(new Date(expirationDate))
  };
  try {
    if (postEditId) {
      await db.collection('produce').doc(postEditId).update(doc);
    } else if (userData.role === 'farmer') {
      await db.collection('produce').add(doc);
    } else {
      await db.collection('requests').add(doc);
    }
    postModal.classList.add('hidden');
    postEditId = null;
    showLoader(false);
  } catch (err) {
    showError(postError, err.message);
    showLoader(false);
  }
};

// Delete post
async function deleteProduce(id) {
  if (confirm("Are you sure you want to delete this post?")) {
    await db.collection('produce').doc(id).delete();
  }
}

// --- VOICE ASSISTANT FOR POST FORM (Hindi + English) ---
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
    // Smarter extraction
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
    <b>Posted on:</b> ${formatTimestamp(item.timestamp)}<br>
    <b>Expires:</b> ${item.expiration ? formatDateOnly(item.expiration) : 'N/A'}<br>
    ${isExpired(item.expiration) ? `<span style="color:#b71c1c;">This post is expired and only visible to owner.</span>` : ''}
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
// For shop owner OR farmer: open chat with post owner or with owner who messaged on post
function openChatWindow(post, otherUserObj) {
  let otherUserId = otherUserObj ? otherUserObj.id : post.userId;
  let chatRoomId = getChatRoomId(currentUser.uid, otherUserId, post.id);
  activeChatRoomId = chatRoomId;
  activeChatOtherUser = otherUserObj || { id: post.userId, name: post.userName, phone: post.userPhone };
  chatUserName.textContent = activeChatOtherUser.name;
  chatWindow.classList.remove('hidden');
  chatMessagesDiv.innerHTML = '';
  if (chatUnsub) chatUnsub();
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
      });
      chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
    });
}
closeChatWindowBtn.onclick = () => {
  chatWindow.classList.add('hidden');
  if (chatUnsub) chatUnsub();
};
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

// --- FARMER: VIEW CHATS ON MY POSTS ---
function openFarmerChats(post) {
  // Fetch unique chat rooms for this post where the other user is not the farmer
  db.collection('chats')
    .where(firebase.firestore.FieldPath.documentId(), '>=', `${currentUser.uid}_${post.id}`)
    .where(firebase.firestore.FieldPath.documentId(), '<=', `${currentUser.uid}~${post.id}`)
    .get()
    .then(snap => {
      let chatRooms = [];
      snap.forEach(doc => {
        if (doc.id.endsWith('_'+post.id)) {
          let parts = doc.id.split('_');
          let otherId = parts[0] === currentUser.uid ? parts[1] : parts[0];
          chatRooms.push({ id: doc.id, otherId });
        }
      });
      if (!chatRooms.length) {
        alert('No chats yet for this post.');
        return;
      }
      // Show list of chat users (one at a time for now)
      let sel = prompt('Enter phone or name of the person you want to chat with: \n' +
        chatRooms.map(c => `UserID: ${c.otherId}`).join('\n'));
      if (sel) {
        db.collection('users').doc(sel).get().then(u => {
          if (u.exists) {
            openChatWindow(post, { id: sel, name: u.data().name, phone: u.data().phone });
          } else {
            alert('User not found.');
          }
        });
      }
    });
}

// --- SMARTER VOICE EXTRACTION: Hindi + English (pyaz, kilo, rupay, per) ---
async function getIntentFromVoiceCommand(text) {
  text = text.toLowerCase();

  // Normalize common Hindi/English units/prices
  text = text.replace(/kilo ?gram|kilogram|किलोग्राम/g, "kg")
    .replace(/किलो/g, "kg")
    .replace(/रुपया|रुपये|rs|rupees|₹/g, "rs")
    .replace(/per|प्रति/g, "per")
    .replace(/टुकड़ा|piece|पीस/g, "piece")
    .replace(/क्विंटल|quintal/g, "quintal");

  // Try: "{qty} {unit} {item} {price} rs per {unit}"
  let re = /(\d+)[ ]*(kg|quintal|piece)?[ ]*([^\d]+?)[ ]*(\d+)[ ]*rs[ ]*per[ ]*(kg|quintal|piece)?/;
  let m = text.match(re);
  if (m) {
    return {
      quantity: m[1],
      unit: m[2] || 'kg',
      item: m[3].trim(),
      price: m[4],
      priceUnit: m[5] || m[2] || 'kg'
    };
  }

  // Try: "{qty} {unit} {item}" and later "{price} rs per {unit}"
  let mQty = text.match(/(\d+)[ ]*(kg|quintal|piece)?[ ]*([^\d]+)/);
  let mPrice = text.match(/(\d+)[ ]*rs[ ]*per[ ]*(kg|quintal|piece)?/);
  let res = { quantity: '', unit: '', item: '', price: '', priceUnit: '' };
  if (mQty) {
    res.quantity = mQty[1];
    res.unit = mQty[2] || 'kg';
    res.item = mQty[3].trim();
  }
  if (mPrice) {
    res.price = mPrice[1];
    res.priceUnit = mPrice[2] || res.unit || 'kg';
  }
  // If still missing, try fallback for Hindi: "30 rupay kilo"
  let m2 = text.match(/(\d+)[ ]*rs[ ]*(kg|quintal|piece)?/);
  if (!res.price && m2) {
    res.price = m2[1];
    res.priceUnit = m2[2] || res.unit || 'kg';
  }
  return res;
}

// --- MISC UI ---
window.onclick = e => {
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

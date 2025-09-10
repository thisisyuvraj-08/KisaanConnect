// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDnhwxpN_6VXNY2rkfKJuA5XFmSERSOFsM",
    authDomain: "kisaan-connect-da56d.firebaseapp.com",
    projectId: "kisaan-connect-da56d",
    storageBucket: "kisaan-connect-da56d.appspot.com",
    messagingSenderId: "401721766160",
    appId: "1:401721766160:web:fe4ec1d3d2cc0f19f07595"
};

// --- APPLICATION STATE ---
let db, auth, map;
let user = null;
let userRole = null;
let userLocation = null;
let currentChatPartner = null;
let unsubscribeChat = null;
let markers = [];

// --- DOM ELEMENTS ---
const mainContent = document.getElementById('main-content');
const header = document.getElementById('app-header');
const loadingOverlay = document.getElementById('loading-overlay');

// --- INITIALIZATION ---
function initialize() {
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    auth.onAuthStateChanged(handleAuthStateChanged);
}

// --- AUTHENTICATION FLOW ---
async function handleAuthStateChanged(firebaseUser) {
    if (firebaseUser) {
        user = firebaseUser;
        // Fetch user role from Firestore
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            userRole = userDoc.data().role;
        } else {
            // If user doc doesn't exist, create it
            await db.collection('users').doc(user.uid).set({
                uid: user.uid,
                displayName: user.displayName || "",
                phoneNumber: user.phoneNumber || "",
                role: null
            });
            userRole = null;
        }
    } else {
        user = null;
        userRole = null;
    }
    render();
    loadingOverlay.classList.remove('visible');
}

// --- UI RENDERING ROUTER ---
function render() {
    mainContent.innerHTML = '';
    header.innerHTML = '';
    if (map) {
        map.remove();
        map = null;
    }

    renderHeader();

    if (!user) {
        renderLoginScreen();
    } else if (!userRole) {
        renderRoleSelection();
    } else if (currentChatPartner) {
        renderChatView();
    } else {
        renderMapView(userRole);
    }
}

function renderHeader() {
    const logoHtml = `<div class="logo"><svg width="40" height="40" viewBox="0 0 24 24"><path d="M17.5 17.5C15.8 19.2 13.7 21 12 21s-3.8-1.8-5.5-3.5C4.8 15.8 3 13.7 3 12s1.8-3.8 3.5-5.5C8.2 4.8 10.3 3 12 3s3.8 1.8 5.5 3.5C19.2 8.2 21 10.3 21 12s-1.8-3.8-3.5 5.5zM12 15a3 3 0 100-6 3 3 0 000 6z" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"></path></svg><h1>Kisaan Connect</h1></div>`;
    let controlsHtml = '';
    if (user) {
        controlsHtml = `<button id="sign-out-btn" class="btn btn-outline">Sign Out</button>`;
    }
    header.innerHTML = logoHtml + `<div id="user-view-controls">${controlsHtml}</div>`;
    if (user) document.getElementById('sign-out-btn').onclick = () => auth.signOut();
}

function renderLoginScreen() {
    mainContent.innerHTML = `
    <div class="auth-container card">
        <h2 class="auth-title">Kisaan Connect</h2>
        <div class="auth-tabs">
            <button id="tab-signin" class="auth-tab active">Sign In</button>
            <button id="tab-register" class="auth-tab">Register</button>
        </div>
        <form id="signin-form" class="auth-form">
            <input type="email" id="signin-email" class="form-input" placeholder="Email" required />
            <input type="password" id="signin-password" class="form-input" placeholder="Password" required />
            <button type="submit" class="btn btn-primary">Sign In</button>
        </form>
        <form id="register-form" class="auth-form" style="display:none;">
            <input type="text" id="register-name" class="form-input" placeholder="Full Name" required />
            <input type="email" id="register-email" class="form-input" placeholder="Email" required />
            <input type="password" id="register-password" class="form-input" placeholder="Password" required />
            <input type="tel" id="register-phone" class="form-input" placeholder="Phone Number" pattern="[0-9]{10}" maxlength="10" required />
            <button type="submit" class="btn btn-primary">Register</button>
        </form>
    </div>
    `;

    // Tab switching
    document.getElementById('tab-signin').onclick = () => {
        document.getElementById('signin-form').style.display = '';
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('tab-signin').classList.add('active');
        document.getElementById('tab-register').classList.remove('active');
    };
    document.getElementById('tab-register').onclick = () => {
        document.getElementById('signin-form').style.display = 'none';
        document.getElementById('register-form').style.display = '';
        document.getElementById('tab-signin').classList.remove('active');
        document.getElementById('tab-register').classList.add('active');
    };

    document.getElementById('signin-form').addEventListener('submit', handleEmailSignIn);
    document.getElementById('register-form').addEventListener('submit', handleEmailRegister);
}

function handleEmailSignIn(e) {
    e.preventDefault();
    const email = document.getElementById('signin-email').value.trim();
    const password = document.getElementById('signin-password').value;
    auth.signInWithEmailAndPassword(email, password)
        .catch(err => showNotification(err.message, "error"));
}

function handleEmailRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const phone = document.getElementById('register-phone').value.trim();
    if (!/^[0-9]{10}$/.test(phone)) {
        showNotification("Enter a valid 10-digit phone number.", "error");
        return;
    }
    auth.createUserWithEmailAndPassword(email, password)
        .then(async cred => {
            await db.collection('users').doc(cred.user.uid).set({
                uid: cred.user.uid,
                displayName: name,
                phoneNumber: phone,
                role: null
            });
            await cred.user.updateProfile({ displayName: name });
        })
        .catch(err => showNotification(err.message, "error"));
}

function renderOtpScreen(phoneNumber) {
    mainContent.innerHTML = `<div class="auth-container card"><h2 class="auth-title">Verify OTP</h2><p class="auth-subtitle">Enter the code sent to ${phoneNumber}</p><form id="otp-verify-form" class="auth-form"><input type="number" id="otp-input" class="form-input" placeholder="Enter 6-digit OTP" required /><button type="submit" class="btn btn-primary">Verify & Sign In</button></form></div>`;
    document.getElementById('otp-verify-form').addEventListener('submit', handleOtpVerification);
}

function renderRoleSelection() {
    mainContent.innerHTML = `<div class="card" style="text-align:center;"><h2 class="form-title">One last step!</h2><p class="auth-subtitle">Are you a farmer looking to sell, or a shop owner looking to buy?</p><div style="display:flex; gap: 1rem; justify-content:center;"><button id="farmer-role-btn" class="btn btn-primary">I'm a Farmer 🧑‍🌾</button><button id="shop-owner-role-btn" class="btn btn-secondary">I'm a Shop Owner 🛒</button></div></div>`;
    document.getElementById('farmer-role-btn').onclick = () => setUserRole('farmer');
    document.getElementById('shop-owner-role-btn').onclick = () => setUserRole('shop-owner');
}

function renderMapView(role) {
    let formHtml = '';
    if (role === 'farmer') {
        formHtml = `<div class="form-container"><h2 class="form-title">Post Your Produce</h2><form id="produce-form"><div class="form-group"><label for="productName">Product Name</label><input type="text" id="productName" class="form-input" required placeholder="e.g., Organic Tomatoes"></div><div class="form-group"><label for="quantity">Quantity (kg)</label><input type="number" id="quantity" class="form-input" required placeholder="e.g., 25"></div><div class="form-group"><label for="price">Price (per kg)</label><input type="number" id="price" class="form-input" required placeholder="e.g., 18"></div><button type="submit" id="submit-button" class="btn btn-primary" style="width: 100%;">Post to Marketplace</button></form></div>`;
    }
    mainContent.innerHTML = `<div class="view-grid">${formHtml}<div class="card" style="padding:0; overflow:hidden;"><div id="map"></div></div></div>`;
    initializeMapWithData();
}


// --- CORE LOGIC & EVENT HANDLERS ---
function handlePhoneSignIn(event) {
    event.preventDefault();
    const countryCode = document.getElementById('country-code').value;
    const phoneInput = document.getElementById('phone-input').value.trim();
    if (!/^[0-9]{10}$/.test(phoneInput)) {
        showNotification("Enter a valid 10-digit phone number.", "error");
        return;
    }
    const phoneNumber = countryCode + phoneInput;
    auth.signInWithPhoneNumber(phoneNumber, window.recaptchaVerifier)
        .then(c => {
            window.confirmationResult = c;
            showNotification("OTP sent!", "success");
            renderOtpScreen(phoneNumber);
        })
        .catch(e => {
            showNotification("Error: " + e.message, "error");
            console.error("Phone sign-in error:", e);
        });
}

function handleOtpVerification(event) { event.preventDefault(); const otp = document.getElementById('otp-input').value; window.confirmationResult.confirm(otp).catch(e => showNotification("Invalid OTP", "error")); }
function handleGoogleSignIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch(e => {
            showNotification("Google Sign-In failed: " + e.message, "error");
            console.error("Google Sign-In error:", e);
        });
}
async function setUserRole(role) { await db.collection('users').doc(user.uid).update({ role }); userRole = role; render(); }

async function initializeMapWithData() {
    loadingOverlay.classList.add('visible');
    try {
        const position = await getCurrentLocation();
        userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch (error) {
        showNotification("Could not get location. Using a default.", "error");
        userLocation = { lat: 28.6139, lng: 77.2090 };
    } finally {
        initializeMap(userLocation);
        if (userRole === 'farmer') {
            addSingleMarker(userLocation, '#1d4ed8', 'Your Location');
            document.getElementById('produce-form').addEventListener('submit', handlePostSubmit);
        } else {
            addSingleMarker(userLocation, '#c2410c', 'Your Shop');
        }
        listenForPosts();
        loadingOverlay.classList.remove('visible');
    }
}

async function handlePostSubmit(event) {
    event.preventDefault();
    const submitButton = document.getElementById('submit-button');
    submitButton.disabled = true;
    submitButton.textContent = "Posting...";
    try {
        await db.collection("produce_posts").add({
            productName: event.target.productName.value,
            quantity: parseInt(event.target.quantity.value),
            price: parseFloat(event.target.price.value),
            location: userLocation,
            sellerId: user.uid,
            sellerName: user.displayName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showNotification("Posted successfully!", "success");
        event.target.reset();
    } catch (error) {
        showNotification("Error posting.", "error");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Post to Marketplace";
    }
}

// --- LEAFLET.JS & FIREBASE DATA ---
function initializeMap(center) {
    map = L.map('map').setView([center.lat, center.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

function addSingleMarker(position, color, title) {
    const icon = L.divIcon({
        html: `<div style="width:20px;height:20px;background:${color};border-radius:50%;border:3px solid white;box-shadow:var(--shadow-md);"></div>`,
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
    });
    L.marker([position.lat, position.lng], { icon }).addTo(map).bindPopup(title);
}

function listenForPosts() {
    db.collection('produce_posts').orderBy("createdAt", "desc").onSnapshot(snapshot => {
        markers.forEach(marker => map.removeLayer(marker));
        markers = [];
        snapshot.forEach(doc => {
            const post = { id: doc.id, ...doc.data() };
            if (post.location?.lat) {
                const icon = L.divIcon({
                    html: `<div style="background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="40" height="40" fill="%2316a34a"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>'); width:40px;height:40px;"></div>`,
                    className: '',
                    iconSize: [40, 40],
                    iconAnchor: [20, 40],
                    popupAnchor: [0, -40]
                });
                const marker = L.marker([post.location.lat, post.location.lng], { icon }).addTo(map);
                
                const popupContent = `<div class="popup-content"><h3 class="popup-title">${post.productName}</h3><div class="popup-details"><p><strong>Quantity:</strong> ${post.quantity} kg</p><p><strong>Price:</strong> ₹${post.price}/kg</p></div>${userRole === 'shop-owner' && post.sellerId !== user.uid ? `<button class="btn btn-primary" id="msg-btn-${post.id}" style="width:100%">Message Farmer</button>`: ''}</div>`;
                marker.bindPopup(popupContent);

                marker.on('popupopen', () => {
                    if (userRole === 'shop-owner' && post.sellerId !== user.uid) {
                        document.getElementById(`msg-btn-${post.id}`).addEventListener('click', () => startChatWith(post.sellerId));
                    }
                });
                markers.push(marker);
            }
        });
    });
}

async function startChatWith(sellerId) {
    const sellerDoc = await db.collection('users').doc(sellerId).get();
    currentChatPartner = sellerDoc.data();
    render();
}

// --- CHAT LOGIC ---
function renderChatView() {
    mainContent.innerHTML = `
    <div class="chat-container">
        <div class="chat-header">
            <button class="chat-back-btn" id="chat-back-btn">←</button>
            <img src="https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(currentChatPartner.displayName || 'User')}" class="chat-avatar" alt="avatar" />
            <div class="chat-header-info">
                <h3>${currentChatPartner.displayName}</h3>
                <p>
                    <a href="tel:${currentChatPartner.phoneNumber}" class="chat-call-link">📞 ${currentChatPartner.phoneNumber}</a>
                </p>
            </div>
        </div>
        <div class="chat-messages"></div>
        <form class="chat-input-form" id="chat-input-form">
            <input type="text" id="chat-input" class="chat-input" placeholder="Type a message..." autocomplete="off">
            <button type="submit" class="send-btn">➤</button>
        </form>
    </div>
    `;
    document.getElementById('chat-back-btn').onclick = () => { if (unsubscribeChat) unsubscribeChat(); currentChatPartner = null; render(); };
    const chatId = [user.uid, currentChatPartner.uid].sort().join('_');
    const chatRef = db.collection('chats').doc(chatId).collection('messages').orderBy('timestamp', 'asc');
    
    unsubscribeChat = chatRef.onSnapshot(snapshot => {
        const messagesContainer = document.querySelector('.chat-messages');
        messagesContainer.innerHTML = '';
        snapshot.forEach(doc => renderMessage(doc.data(), messagesContainer));
        messagesContainer.scrollTop = 0; // Scroll to bottom (since it's reversed)
    });

    document.getElementById('chat-input-form').addEventListener('submit', e => {
        e.preventDefault();
        const input = document.getElementById('chat-input');
        if (input.value.trim() === '') return;
        db.collection('chats').doc(chatId).collection('messages').add({ text: input.value, senderId: user.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        input.value = '';
    });
}

function renderMessage(msg, container) {
    const sentOrReceived = msg.senderId === user.uid ? 'sent' : 'received';
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sentOrReceived}`;
    messageDiv.innerHTML = `<div class="chat-bubble"><p class="message-text">${msg.text}</p><p class="message-time">${msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</p></div>`;
    container.prepend(messageDiv);
}

// --- UTILITIES ---
function getCurrentLocation() { return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout:7000, maximumAge:0 })); }
function showNotification(message, type = 'success') { const banner = document.getElementById('notification-banner'); banner.querySelector('p').textContent = message; banner.style.backgroundColor = type === 'success' ? 'var(--green-primary)' : 'var(--red-error)'; banner.classList.add('show'); setTimeout(() => banner.classList.remove('show'), 3500); }

// --- START THE APP ---
document.addEventListener('DOMContentLoaded', initialize);

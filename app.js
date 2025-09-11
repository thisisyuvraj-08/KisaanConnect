// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDnhwxpN_6VXNY2rkfKJuA5XFmSERSOFsM",
    authDomain: "kisaan-connect-da56d.firebaseapp.com",
    projectId: "kisaan-connect-da56d",
    storageBucket: "kisaan-connect-da56d.appspot.com",
    messagingSenderId: "401721766160",
    appId: "1:401721766160:web:29644ebd5bcc3116f07595",
    measurementId: "G-9VQVCJYCWE"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase Services
const auth = firebase.auth();
const db = firebase.firestore();

// Global State and Elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app');
const modalContainer = document.getElementById('modal-container');
const chatContainer = document.getElementById('chat-container');

let currentUser = null;
let map;
let unsubscribeListeners = []; // To manage real-time listeners

// --- Main Application Flow ---
auth.onAuthStateChanged(async (user) => {
    // Clear any existing listeners
    unsubscribeListeners.forEach(unsubscribe => unsubscribe());
    unsubscribeListeners = [];

    if (user) {
        try {
            const userDocRef = db.collection("users").doc(user.uid);
            const userDoc = await userDocRef.get();
            
            if (userDoc.exists) {
                currentUser = { uid: user.uid, ...userDoc.data() };
                appContainer.classList.remove('hidden');
                authContainer.classList.add('hidden');
                initializeAppUI();
            } else {
                // This case can happen if user is deleted from firestore but not auth
                await auth.signOut();
                alert("User data not found. Please register again.");
            }
        } catch (error) {
            console.error("Auth state change error:", error);
            alert("Error loading user data. Please try again.");
        }
    } else {
        currentUser = null;
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
        renderAuthForm('login');
    }
});

function initializeAppUI() {
    document.getElementById('user-display-name').textContent = `Welcome, ${currentUser.name}`;
    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
    
    // Initialize map if not already done
    if (!map) {
        map = L.map('map').setView([12.9141, 79.1325], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
    } else {
        // Clear existing markers
        map.eachLayer(layer => {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });
    }
    
    setupDashboardForRole();
}

function setupDashboardForRole() {
    const dashboard = document.getElementById('dashboard');
    const postBtn = document.getElementById('post-btn');

    if (currentUser.role === 'farmer') {
        dashboard.innerHTML = `<h2><i class="fas fa-shopping-basket"></i> Kirana Requests</h2><div id="item-list"></div>`;
        postBtn.innerHTML = "<i class='fas fa-plus'></i>";
        postBtn.setAttribute('title', 'Post Produce');
        postBtn.onclick = () => renderPostModal('produce');
        listenForData('requests');
    } else { // Kirana Owner
        dashboard.innerHTML = `<h2><i class="fas fa-seedling"></i> Available Produce</h2><div id="item-list"></div>`;
        postBtn.innerHTML = "<i class='fas fa-plus'></i>";
        postBtn.setAttribute('title', 'Post Request');
        postBtn.onclick = () => renderPostModal('request');
        listenForData('produce');
    }
}

// --- Real-time Data Functions ---
function listenForData(collectionName) {
    const itemsCollection = db.collection(collectionName);
    const q = itemsCollection.orderBy("timestamp", "desc");

    const unsubscribe = q.onSnapshot((snapshot) => {
        const itemList = document.getElementById('item-list');
        if (!itemList) return;
        
        itemList.innerHTML = '';
        
        // Clear existing markers from map
        if (map) {
            map.eachLayer(layer => {
                if (layer instanceof L.Marker) {
                    map.removeLayer(layer);
                }
            });
        }

        if (snapshot.empty) {
            itemList.innerHTML = `<div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No ${collectionName === 'produce' ? 'produce' : 'requests'} available yet</p>
            </div>`;
            return;
        }

        snapshot.forEach((doc) => {
            const item = { id: doc.id, ...doc.data() };
            const itemType = collectionName === 'produce' ? 'produce' : 'request';
            
            // Only show items from other users
            if (item.userId !== currentUser.uid) {
                renderItemCard(itemList, item, itemType);
                renderMapMarker(item, itemType);
            }
        });
    }, (error) => {
        console.error("Error listening to collection:", error);
        document.getElementById('item-list').innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading data. Please refresh the page.</p>
            </div>
        `;
    });
    
    unsubscribeListeners.push(unsubscribe);
}

// --- UI Rendering Functions ---
function renderAuthForm(formType) {
    const content = formType === 'login' ? `
        <div class="auth-form">
            <h2><i class="fas fa-sign-in-alt"></i> Login to Kisaan Connect</h2>
            <div class="input-group">
                <input type="email" id="login-email" placeholder="Email" required>
            </div>
            <div class="input-group">
                <input type="password" id="login-password" placeholder="Password" required>
            </div>
            <button id="login-btn" class="button-primary">Login</button>
            <p class="toggle-auth" data-form="register">Don't have an account? Register</p>
        </div>` : `
        <div class="auth-form">
            <h2><i class="fas fa-user-plus"></i> Create an Account</h2>
            <div class="input-group">
                <input type="text" id="register-name" placeholder="Full Name" required>
            </div>
            <div class="input-group">
                <input type="tel" id="register-phone" placeholder="Phone (e.g., 919876543210)" required>
            </div>
            <div class="input-group">
                <input type="email" id="register-email" placeholder="Email" required>
            </div>
            <div class="input-group">
                <input type="password" id="register-password" placeholder="Password" required>
            </div>
            <div class="input-group">
                <select id="register-role">
                    <option value="farmer">I am a Farmer</option>
                    <option value="owner">I am a Kirana Owner</option>
                </select>
            </div>
            <button id="register-btn" class="button-primary">Register</button>
            <p class="toggle-auth" data-form="login">Already have an account? Login</p>
        </div>`;
        
    authContainer.innerHTML = content;
    attachAuthFormListeners();
}

function attachAuthFormListeners() {
    if (document.getElementById('login-btn')) {
        document.getElementById('login-btn').addEventListener('click', handleLogin);
    }
    if (document.getElementById('register-btn')) {
        document.getElementById('register-btn').addEventListener('click', handleRegister);
    }
    
    document.querySelectorAll('.toggle-auth').forEach(element => {
        element.addEventListener('click', (e) => {
            const formType = e.target.dataset.form;
            renderAuthForm(formType);
        });
    });
}

function renderItemCard(container, item, type) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
        <h4>${item.itemName}</h4>
        <p><i class="fas fa-user"></i> By: ${item.userName}</p>
        <p><i class="fas fa-clock"></i> ${formatTimestamp(item.timestamp)}</p>
    `;
    card.onclick = () => renderDetailsModal(item, type);
    container.appendChild(card);
}

function renderMapMarker(item, type) {
    const lat = item.location?.lat || 12.9141 + (Math.random() - 0.5) * 0.05;
    const lng = item.location?.lng || 79.1325 + (Math.random() - 0.5) * 0.05;
    
    // Create custom icon based on type
    const iconHtml = type === 'produce' 
        ? `<div style="background-color: #4caf50; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"><i class="fas fa-seedling"></i></div>`
        : `<div style="background-color: #ff9800; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.2);"><i class="fas fa-shopping-basket"></i></div>`;
    
    const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });
    
    const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

    let popupContent = `
        <div style="min-width: 200px;">
            <b>${type === 'produce' ? 'Produce' : 'Request'}:</b> ${item.itemName}<br>
            <b>By:</b> ${item.userName}<br>
            <button class="view-details-btn button-primary" style="width: 100%; margin-top: 10px; padding: 8px;">
                <i class="fas fa-info-circle"></i> View Details
            </button>
        </div>`;
        
    marker.bindPopup(popupContent);

    marker.on('popupopen', () => {
        marker.getPopup().getElement().querySelector('.view-details-btn').addEventListener('click', () => {
            renderDetailsModal(item, type);
        });
    });
}

function renderDetailsModal(item, type) {
    const otherUser = { id: item.userId, name: item.userName, phone: item.userPhone };
    
    modalContainer.innerHTML = `
        <div class="modal-content">
            <h2>${type === 'produce' ? 'Produce' : 'Request'} Details</h2>
            <p><strong>Item:</strong> ${item.itemName}</p>
            <p><strong>Posted by:</strong> ${item.userName}</p>
            <p><strong>Contact:</strong> ${item.userPhone}</p>
            <p><strong>Posted on:</strong> ${formatTimestamp(item.timestamp)}</p>
            <div class="modal-buttons">
                <button id="whatsapp-btn" class="button-primary">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                </button>
                <button id="in-app-chat-btn" class="button-primary">
                    <i class="fas fa-comments"></i> In-App Chat
                </button>
                <button id="close-modal-btn" class="button-secondary">Close</button>
            </div>
        </div>`;
        
    modalContainer.classList.remove('hidden');

    document.getElementById('whatsapp-btn').onclick = () => {
        const message = `Hi, I'm interested in your ${type === 'produce' ? 'produce' : 'request'} for ${item.itemName} on Kisaan Connect`;
        window.open(`https://wa.me/${otherUser.phone}?text=${encodeURIComponent(message)}`, '_blank');
    };
    
    document.getElementById('in-app-chat-btn').onclick = () => {
        modalContainer.classList.add('hidden');
        renderChatUI(otherUser);
    };
    
    document.getElementById('close-modal-btn').onclick = () => {
        modalContainer.classList.add('hidden');
    };
}

function renderPostModal(type) {
    const title = type === 'produce' ? 'Post New Produce' : 'Post New Request';
    modalContainer.innerHTML = `
        <div class="modal-content">
            <h2>${title}</h2>
            <div class="auth-form">
                <div class="input-group">
                    <input type="text" id="item-name" placeholder="Item Name (e.g., Tomatoes)" required>
                </div>
                <div class="modal-buttons">
                    <button id="post-item-btn" class="button-primary">Post</button>
                    <button id="close-post-modal-btn" class="button-secondary">Cancel</button>
                </div>
            </div>
        </div>`;
        
    modalContainer.classList.remove('hidden');

    document.getElementById('post-item-btn').onclick = () => handlePostItem(type);
    document.getElementById('close-post-modal-btn').onclick = () => modalContainer.classList.add('hidden');
    
    // Add enter key support
    document.getElementById('item-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handlePostItem(type);
        }
    });
}

// --- ACTION HANDLERS ---
function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        alert("Please enter both email and password.");
        return;
    }
    
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            console.error("Login error:", error);
            alert("Login Error: " + error.message);
        });
}

function handleRegister() {
    const name = document.getElementById('register-name').value;
    const phone = document.getElementById('register-phone').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const role = document.getElementById('register-role').value;
    
    if (!name || !phone || !email || !password) {
        alert("Please fill out all fields.");
        return;
    }
    
    // Validate phone number format
    if (!/^(\+91|91|0)?[6789]\d{9}$/.test(phone)) {
        alert("Please enter a valid Indian phone number.");
        return;
    }

    auth.createUserWithEmailAndPassword(email, password)
        .then(userCredential => {
            const user = userCredential.user;
            return db.collection("users").doc(user.uid).set({
                name: name,
                phone: phone,
                role: role,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .catch(error => {
            console.error("Registration error:", error);
            alert("Registration Error: " + error.message);
        });
}

function handlePostItem(type) {
    const itemNameInput = document.getElementById('item-name');
    const itemName = itemNameInput.value.trim();
    
    if (!itemName) {
        alert("Please enter an item name.");
        return;
    }
    
    const collectionName = type === 'produce' ? 'produce' : 'requests';
    
    db.collection(collectionName).add({
        itemName: itemName,
        userId: currentUser.uid,
        userName: currentUser.name,
        userPhone: currentUser.phone,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        location: { 
            lat: 12.9141 + (Math.random() - 0.5) * 0.05, 
            lng: 79.1325 + (Math.random() - 0.5) * 0.05 
        }
    })
    .then(() => {
        modalContainer.classList.add('hidden');
        itemNameInput.value = '';
    })
    .catch(error => {
        console.error("Error posting:", error);
        alert("Error posting: " + error.message);
    });
}

// --- REAL-TIME CHAT UI AND LOGIC ---
function renderChatUI(otherUser) {
    chatContainer.innerHTML = `
        <div class="chat-header">
            <span><i class="fas fa-user"></i> Chat with ${otherUser.name}</span>
            <span class="close-chat" id="close-chat-btn">&times;</span>
        </div>
        <div class="chat-messages" id="messages-list"></div>
        <div class="chat-input">
            <input type="text" id="message-input" placeholder="Type a message...">
            <button id="send-message-btn"><i class="fas fa-paper-plane"></i></button>
        </div>`;
        
    chatContainer.classList.remove('hidden');
    
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-message-btn');
    const messagesDiv = document.getElementById('messages-list');

    const chatRoomId = [currentUser.uid, otherUser.id].sort().join('_');
    const messagesCollection = db.collection("chats").doc(chatRoomId).collection("messages");
    const q = messagesCollection.orderBy("timestamp");

    const unsubscribe = q.onSnapshot((snapshot) => {
        messagesDiv.innerHTML = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const msgDiv = document.createElement('div');
            msgDiv.textContent = msg.text;
            msgDiv.className = `message ${msg.senderId === currentUser.uid ? 'sent' : 'received'}`;
            messagesDiv.appendChild(msgDiv);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }, (error) => {
        console.error("Chat error:", error);
    });
    
    const stopListening = () => {
        unsubscribe();
        chatContainer.classList.add('hidden');
        const index = unsubscribeListeners.indexOf(unsubscribe);
        if (index > -1) unsubscribeListeners.splice(index, 1);
    };
    
    document.getElementById('close-chat-btn').onclick = stopListening;
    unsubscribeListeners.push(unsubscribe);

    const sendMessage = () => {
        const text = messageInput.value.trim();
        if (text === '') return;
        
        messagesCollection.add({
            text: text,
            senderId: currentUser.uid,
            senderName: currentUser.name,
            receiverId: otherUser.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(error => {
            console.error("Error sending message:", error);
            alert("Error sending message. Please try again.");
        });
        
        messageInput.value = '';
    };
    
    sendBtn.onclick = sendMessage;
    messageInput.onkeydown = (e) => {
        if (e.key === 'Enter') sendMessage();
    };
    
    // Focus on input field
    setTimeout(() => {
        messageInput.focus();
    }, 100);
}

// --- UTILITY FUNCTIONS ---
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Recently';
    
    const date = timestamp.toDate();
    const now = new Date();
    const diffInMs = now - date;
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins} min ago`;
    if (diffInHours < 24) return `${diffInHours} hr ago`;
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString();
}

// Initialize auth form on load
document.addEventListener('DOMContentLoaded', () => {
    renderAuthForm('login');
});

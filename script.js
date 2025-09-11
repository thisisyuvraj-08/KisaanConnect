// This event listener ensures that the entire HTML document is loaded and ready
// before our JavaScript code tries to run. This is the key fix for the blank screen issue.
document.addEventListener('DOMContentLoaded', () => {

    // --- Firebase Services (Initialized in index.html) ---
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- Global State and Elements ---
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app');
    const modalContainer = document.getElementById('modal-container');
    const chatContainer = document.getElementById('chat-container');

    let currentUser = null;
    let map;
    let unsubscribeListeners = []; // To manage real-time listeners

    // --- Main Application Flow ---
    auth.onAuthStateChanged(async (user) => {
        // Clear any previous real-time listeners to prevent data leaks or errors on logout
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
                    // This can happen if the user's database record was deleted but they are still logged in.
                    // We sign them out to fix this state.
                    await auth.signOut();
                    alert("User data not found. Please register again.");
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                alert("There was an error loading your profile. Please try refreshing the page.");
            }
        } else {
            // User is logged out
            currentUser = null;
            appContainer.classList.add('hidden');
            authContainer.classList.remove('hidden');
            renderAuthForm('login');
        }
    });

    function initializeAppUI() {
        document.getElementById('user-display-name').textContent = `Welcome, ${currentUser.name}`;
        document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
        
        if (!map) {
            map = L.map('map').setView([12.9141, 79.1325], 13); // Centered on Vellore
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        }
        
        setupDashboardForRole();
    }

    function setupDashboardForRole() {
        const dashboard = document.getElementById('dashboard');
        const postBtn = document.getElementById('post-btn');

        if (currentUser.role === 'farmer') {
            // Farmer's view
            dashboard.innerHTML = `<h2><i class="fas fa-shopping-basket"></i> Kirana Requests</h2><div id="item-list"></div>`;
            postBtn.title = "Post New Produce";
            postBtn.onclick = () => renderPostModal('produce');
            // A farmer sees requests from owners
            listenForData('requests');
        } else { 
            // Kirana Owner's view
            dashboard.innerHTML = `<h2><i class="fas fa-seedling"></i> Available Produce</h2><div id="item-list"></div>`;
            postBtn.title = "Post New Request";
            postBtn.onclick = () => renderPostModal('request');
            // An owner sees produce from farmers
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
            
            if (map) {
                map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer); });
            }

            if (snapshot.empty) {
                const itemType = collectionName === 'produce' ? 'produce' : 'requests';
                itemList.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>No ${itemType} available yet</p></div>`;
                return;
            }

            snapshot.forEach((doc) => {
                const item = { id: doc.id, ...doc.data() };
                const itemType = collectionName.slice(0, -1);
                
                // Crucial fix: Only show items from OTHER users
                if (item.userId !== currentUser.uid) {
                    renderItemCard(itemList, item, itemType);
                    renderMapMarker(item, itemType);
                }
            });
        }, (error) => {
            console.error(`Error listening to ${collectionName}:`, error);
            document.getElementById('item-list').innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>Error loading data. Please refresh.</p></div>`;
        });
        
        unsubscribeListeners.push(unsubscribe);
    }

    // --- UI Rendering Functions ---
    function renderAuthForm(formType) {
        const content = formType === 'login' ? `
            <div class="auth-form">
                <h2><i class="fas fa-sign-in-alt"></i> Login</h2>
                <div class="input-group"><input type="email" id="login-email" placeholder="Email" required></div>
                <div class="input-group"><input type="password" id="login-password" placeholder="Password" required></div>
                <button id="login-btn" class="button-primary">Login</button>
                <p class="toggle-auth" data-form="register">Don't have an account? Register</p>
            </div>` : `
            <div class="auth-form">
                <h2><i class="fas fa-user-plus"></i> Create Account</h2>
                <div class="input-group"><input type="text" id="register-name" placeholder="Full Name" required></div>
                <div class="input-group"><input type="tel" id="register-phone" placeholder="Phone (e.g., 919876543210)" required></div>
                <div class="input-group"><input type="email" id="register-email" placeholder="Email" required></div>
                <div class="input-group"><input type="password" id="register-password" placeholder="Password (min. 6 characters)" required></div>
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
        const loginBtn = document.getElementById('login-btn');
        const registerBtn = document.getElementById('register-btn');
        const toggleLinks = document.querySelectorAll('.toggle-auth');

        if (loginBtn) loginBtn.addEventListener('click', handleLogin);
        if (registerBtn) registerBtn.addEventListener('click', handleRegister);
        
        toggleLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                renderAuthForm(e.target.dataset.form);
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
        
        const iconHtml = type === 'produce' 
            ? `<div style="background-color: #4caf50; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: var(--shadow);"><i class="fas fa-seedling"></i></div>`
            : `<div style="background-color: #ff9800; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: var(--shadow);"><i class="fas fa-shopping-basket"></i></div>`;
        
        const customIcon = L.divIcon({ html: iconHtml, className: '', iconSize: [40, 40], iconAnchor: [20, 40] });
        
        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        const popupContent = `
            <div style="min-width: 180px;">
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
                <h2><i class="fas fa-info-circle"></i> ${type === 'produce' ? 'Produce' : 'Request'} Details</h2>
                <p><strong>Item:</strong> ${item.itemName}</p>
                <p><strong>Posted by:</strong> ${item.userName}</p>
                <div class="modal-buttons">
                    <button id="whatsapp-btn" class="button-primary"><i class="fab fa-whatsapp"></i> WhatsApp</button>
                    <button id="in-app-chat-btn" class="button-primary"><i class="fas fa-comments"></i> In-App Chat</button>
                    <button id="close-modal-btn" class="button-secondary">Close</button>
                </div>
            </div>`;
        modalContainer.classList.remove('hidden');

        document.getElementById('whatsapp-btn').onclick = () => {
            const message = `Hi, I'm interested in your ${type} for ${item.itemName} on Kisaan Connect.`;
            window.open(`https://wa.me/${otherUser.phone}?text=${encodeURIComponent(message)}`, '_blank');
        };
        document.getElementById('in-app-chat-btn').onclick = () => {
            modalContainer.classList.add('hidden');
            renderChatUI(otherUser);
        };
        document.getElementById('close-modal-btn').onclick = () => modalContainer.classList.add('hidden');
    }

    function renderPostModal(type) {
        const title = type === 'produce' ? 'Post New Produce' : 'Post New Request';
        modalContainer.innerHTML = `
            <div class="modal-content">
                <h2><i class="fas fa-plus-circle"></i> ${title}</h2>
                <div class="auth-form">
                    <div class="input-group"><input type="text" id="item-name" placeholder="Item Name (e.g., Tomatoes)"></div>
                    <div class="modal-buttons">
                        <button id="post-item-btn" class="button-primary">Post</button>
                        <button id="close-post-modal-btn" class="button-secondary">Cancel</button>
                    </div>
                </div>
            </div>`;
        modalContainer.classList.remove('hidden');

        document.getElementById('post-item-btn').onclick = () => handlePostItem(type);
        document.getElementById('close-post-modal-btn').onclick = () => modalContainer.classList.add('hidden');
    }

    // --- ACTION HANDLERS ---
    function handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        if (!email || !password) return alert("Please enter both email and password.");
        auth.signInWithEmailAndPassword(email, password)
            .catch(error => alert("Login Error: " + error.message));
    }

    function handleRegister() {
        const name = document.getElementById('register-name').value;
        const phone = document.getElementById('register-phone').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const role = document.getElementById('register-role').value;
        if (!name || !phone || !email || !password) return alert("Please fill out all fields.");
        if (password.length < 6) return alert("Password must be at least 6 characters long.");

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
            .catch(error => alert("Registration Error: " + error.message));
    }

    function handlePostItem(type) {
        const itemName = document.getElementById('item-name').value.trim();
        if (!itemName) return alert("Please enter an item name.");
        
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
        .then(() => modalContainer.classList.add('hidden'))
        .catch(error => alert("Error posting: " + error.message));
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
        });
        
        const stopListening = () => {
            unsubscribe();
            chatContainer.classList.add('hidden');
        };
        document.getElementById('close-chat-btn').onclick = stopListening;
        unsubscribeListeners.push(unsubscribe); // Add to global listeners to be cleared on logout

        const sendMessage = () => {
            const text = messageInput.value.trim();
            if (text === '') return;
            
            messagesCollection.add({
                text: text,
                senderId: currentUser.uid,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            messageInput.value = '';
        };

        sendBtn.onclick = sendMessage;
        messageInput.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };
    }

    // --- UTILITY FUNCTIONS ---
    function formatTimestamp(timestamp) {
        if (!timestamp) return 'Just now';
        const date = timestamp.toDate();
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        const diffInMins = Math.floor(diffInSeconds / 60);
        if (diffInMins < 60) return `${diffInMins} min ago`;
        const diffInHours = Math.floor(diffInMins / 60);
        if (diffInHours < 24) return `${diffInHours} hr ago`;
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays} days ago`;
    }

    // --- Initial Load ---
    // Start by showing the login form. The onAuthStateChanged listener will take over from here.
    renderAuthForm('login');
});

// Wait for the entire HTML document to be loaded and parsed
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
        unsubscribeListeners.forEach(unsubscribe => unsubscribe());
        unsubscribeListeners = [];

        if (user) {
            const userDocRef = db.collection("users").doc(user.uid);
            const userDoc = await userDocRef.get();
            if (userDoc.exists) {
                currentUser = { uid: user.uid, ...userDoc.data() };
                appContainer.classList.remove('hidden');
                authContainer.classList.add('hidden');
                initializeAppUI();
            } else {
                // This case can happen if user is deleted from firestore but not auth
                auth.signOut();
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
        
        if (!map) {
            map = L.map('map').setView([12.9141, 79.1325], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        }
        
        setupDashboardForRole();
    }

    function setupDashboardForRole() {
        const dashboard = document.getElementById('dashboard');
        const postBtn = document.getElementById('post-btn');

        if (currentUser.role === 'farmer') {
            dashboard.innerHTML = `<h2>Kirana Requests</h2><div id="item-list"></div>`;
            postBtn.textContent = "Post Produce";
            postBtn.onclick = () => renderPostModal('produce');
            listenForData('requests');
        } else { // Kirana Owner
            dashboard.innerHTML = `<h2>Available Produce</h2><div id="item-list"></div>`;
            postBtn.textContent = "Post Request";
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
            if(map) {
                 map.eachLayer(layer => { if (layer instanceof L.Marker) map.removeLayer(layer); });
            }

            snapshot.forEach((doc) => {
                const item = { id: doc.id, ...doc.data() };
                const itemType = collectionName === 'produce' ? 'produce' : 'request';
                
                if(item.userId !== currentUser.uid) {
                    renderItemCard(itemList, item, itemType);
                    renderMapMarker(item, itemType);
                }
            });
        });
        unsubscribeListeners.push(unsubscribe);
    }

    // --- UI Rendering Functions ---
    function renderAuthForm(formType) {
        const content = formType === 'login' ? `
            <div class="auth-form">
                <h2>Login to Kisaan Connect</h2>
                <div class="input-group"><input type="email" id="login-email" placeholder="Email" required></div>
                <div class="input-group"><input type="password" id="login-password" placeholder="Password" required></div>
                <button id="login-btn" class="button-primary">Login</button>
                <p class="toggle-auth" data-form="register">Don't have an account? Register</p>
            </div>` : `
            <div class="auth-form">
                <h2>Create an Account</h2>
                <div class="input-group"><input type="text" id="register-name" placeholder="Full Name" required></div>
                <div class="input-group"><input type="tel" id="register-phone" placeholder="Phone (e.g., 919876543210)" required></div>
                <div class="input-group"><input type="email" id="register-email" placeholder="Email" required></div>
                <div class="input-group"><input type="password" id="register-password" placeholder="Password" required></div>
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
        document.querySelector('.toggle-auth').addEventListener('click', (e) => {
            const formType = e.target.dataset.form;
            renderAuthForm(formType);
        });
    }

    function renderItemCard(container, item, type) {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <h4>${item.itemName}</h4>
            <p>By: ${item.userName}</p>
        `;
        card.onclick = () => renderDetailsModal(item, type);
        container.appendChild(card);
    }

    function renderMapMarker(item, type) {
        const lat = item.location?.lat || 12.9141 + (Math.random() - 0.5) * 0.05;
        const lng = item.location?.lng || 79.1325 + (Math.random() - 0.5) * 0.05;
        const marker = L.marker([lat, lng]).addTo(map);

        let popupContent = `<b>${type === 'produce' ? 'Produce' : 'Request'}:</b> ${item.itemName}<br>By: ${item.userName}<br><button class="view-details-btn button-secondary" style="padding: 5px 10px; margin-top: 5px;">View Details</button>`;
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
                <div class="modal-buttons">
                    <button id="whatsapp-btn" class="button-primary">Chat on WhatsApp</button>
                    <button id="in-app-chat-btn" class="button-primary">Chat in App</button>
                    <button id="close-modal-btn" class="button-secondary">Close</button>
                </div>
            </div>`;
        modalContainer.classList.remove('hidden');

        document.getElementById('whatsapp-btn').onclick = () => window.open(`https://wa.me/${otherUser.phone}`, '_blank');
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
                <h2>${title}</h2>
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
        auth.signInWithEmailAndPassword(email, password)
            .catch(error => alert("Login Error: " + error.message));
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

        auth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
                const user = userCredential.user;
                return db.collection("users").doc(user.uid).set({
                    name: name,
                    phone: phone,
                    role: role,
                    email: email
                });
            })
            .catch(error => alert("Registration Error: " + error.message));
    }

    function handlePostItem(type) {
        const itemName = document.getElementById('item-name').value;
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
        .then(() => modalContainer.classList.add('hidden'))
        .catch(error => alert("Error posting: " + error.message));
    }

    // --- REAL-TIME CHAT UI AND LOGIC ---
    function renderChatUI(otherUser) {
        chatContainer.innerHTML = `
            <div class="chat-header">
                <span>Chat with ${otherUser.name}</span>
                <span class="close-chat" id="close-chat-btn">&times;</span>
            </div>
            <div class="chat-messages" id="messages-list"></div>
            <div class="chat-input">
                <input type="text" id="message-input" placeholder="Type a message...">
                <button id="send-message-btn">Send</button>
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
            const index = unsubscribeListeners.indexOf(unsubscribe);
            if(index > -1) unsubscribeListeners.splice(index, 1);
        };
        document.getElementById('close-chat-btn').onclick = stopListening;

        const sendMessage = () => {
            const text = messageInput.value.trim();
            if (text === '') return;
            
            messagesCollection.add({
                text: text,
                senderId: currentUser.uid,
                receiverId: otherUser.id,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            messageInput.value = '';
        };
        sendBtn.onclick = sendMessage;
        messageInput.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };
    }
});

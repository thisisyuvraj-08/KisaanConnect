import { auth, db } from './firebase.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged,
    signOut 
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { 
    doc, 
    setDoc, 
    getDoc,
    collection,
    addDoc,
    query,
    where,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Global state
let currentUser = null;
let map;

// --- AUTHENTICATION ---
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        currentUser = { uid: user.uid, email: user.email, ...userDoc.data() };
        
        appContainer.classList.remove('hidden');
        authContainer.classList.add('hidden');
        
        document.getElementById('user-display-name').textContent = currentUser.name;
        initializeApp();
    } else {
        currentUser = null;
        appContainer.classList.add('hidden');
        authContainer.classList.remove('hidden');
        renderLoginForm();
    }
});

function renderLoginForm() {
    authContainer.innerHTML = `
        <div class="auth-form">
            <h2>Login</h2>
            <input type="email" id="login-email" placeholder="Email" required>
            <input type="password" id="login-password" placeholder="Password" required>
            <button id="login-btn">Login</button>
            <p id="show-register">Don't have an account? Register</p>
        </div>
    `;
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('show-register').addEventListener('click', renderRegisterForm);
}

function renderRegisterForm() {
    authContainer.innerHTML = `
        <div class="auth-form">
            <h2>Register</h2>
            <input type="text" id="register-name" placeholder="Full Name" required>
            <input type="tel" id="register-phone" placeholder="Phone Number (for WhatsApp)" required>
            <input type="email" id="register-email" placeholder="Email" required>
            <input type="password" id="register-password" placeholder="Password" required>
            <select id="register-role">
                <option value="farmer">I am a Farmer</option>
                <option value="owner">I am a Kirana Owner</option>
            </select>
            <button id="register-btn">Register</button>
            <p id="show-login">Already have an account? Login</p>
        </div>
    `;
    document.getElementById('register-btn').addEventListener('click', handleRegister);
    document.getElementById('show-login').addEventListener('click', renderLoginForm);
}

async function handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert("Error logging in: " + error.message);
    }
}

async function handleRegister() {
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const name = document.getElementById('register-name').value;
    const phone = document.getElementById('register-phone').value;
    const role = document.getElementById('register-role').value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Save user details to Firestore
        await setDoc(doc(db, "users", user.uid), {
            name: name,
            phone: phone,
            role: role,
            email: email
        });

    } catch (error) {
        alert("Error registering: " + error.message);
    }
}

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));


// --- APPLICATION INITIALIZATION ---
function initializeApp() {
    initMap();
    setupDashboard();
    listenForData();
}

function initMap() {
    // This is a placeholder. A real app would get user's location.
    map = L.map('map').setView([12.9141, 79.1325], 13); // Vellore
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
}

function setupDashboard() {
    const dashboard = document.querySelector('.dashboard');
    if (currentUser.role === 'farmer') {
        dashboard.innerHTML = `<h3>Your Requests</h3><div id="requests-list"></div>`;
        document.getElementById('post-btn').textContent = "Post Produce";
        document.getElementById('post-btn').onclick = renderPostProduceModal;
    } else {
        dashboard.innerHTML = `<h3>Available Produce</h3><div id="produce-list"></div>`;
        document.getElementById('post-btn').textContent = "Post Request";
        document.getElementById('post-btn').onclick = renderPostRequestModal;
    }
}

// --- REAL-TIME DATA LISTENING ---
function listenForData() {
    if (currentUser.role === 'farmer') {
        // Farmer sees requests from owners
        const q = query(collection(db, "requests"));
        onSnapshot(q, (snapshot) => {
            const requestsList = document.getElementById('requests-list');
            requestsList.innerHTML = ''; // Clear old list
            snapshot.forEach((doc) => {
                const request = doc.data();
                // Add marker to map
                L.marker([12.9141, 79.1325]).addTo(map) // Placeholder location
                    .bindPopup(`<b>Request:</b> ${request.item}<br>By: ${request.ownerName}`)
                    .on('click', () => renderDetailsModal(request, 'request'));
            });
        });
    } else {
        // Owner sees produce from farmers
        const q = query(collection(db, "produce"));
        onSnapshot(q, (snapshot) => {
            const produceList = document.getElementById('produce-list');
            produceList.innerHTML = ''; // Clear old list
            snapshot.forEach((doc) => {
                const produce = doc.data();
                 // Add marker to map
                 L.marker([12.9141, 79.1325]).addTo(map) // Placeholder location
                 .bindPopup(`<b>Produce:</b> ${produce.item}<br>By: ${produce.farmerName}`)
                 .on('click', () => renderDetailsModal(produce, 'produce'));
            });
        });
    }
}

// --- MODALS and UI ---

function renderDetailsModal(data, type) {
    const modalContainer = document.getElementById('modal-container');
    let detailsHtml = '';
    let contactUser;

    if (type === 'request') {
        detailsHtml = `<h2>Request Details</h2><p>Item: ${data.item}</p><p>By: ${data.ownerName}</p>`;
        contactUser = { id: data.ownerId, name: data.ownerName, phone: data.ownerPhone };
    } else {
        detailsHtml = `<h2>Produce Details</h2><p>Item: ${data.item}</p><p>By: ${data.farmerName}</p>`;
        contactUser = { id: data.farmerId, name: data.farmerName, phone: data.farmerPhone };
    }

    modalContainer.innerHTML = `
        <div class="modal-content">
            ${detailsHtml}
            <button id="whatsapp-btn">Chat on WhatsApp</button>
            <button id="in-app-chat-btn">Chat in App</button>
            <button id="close-modal-btn">Close</button>
        </div>
    `;
    modalContainer.classList.remove('hidden');

    document.getElementById('whatsapp-btn').onclick = () => {
        window.open(`https://wa.me/${contactUser.phone}`, '_blank');
    };
    document.getElementById('in-app-chat-btn').onclick = () => {
        modalContainer.classList.add('hidden');
        startChat(contactUser);
    };
    document.getElementById('close-modal-btn').onclick = () => {
        modalContainer.classList.add('hidden');
    };
}

// --- CHAT FUNCTIONALITY ---

function startChat(otherUser) {
    const chatContainer = document.getElementById('chat-container');
    chatContainer.classList.remove('hidden');
    chatContainer.innerHTML = `
        <div class="chat-header">Chat with ${otherUser.name}</div>
        <div class="chat-messages" id="messages"></div>
        <div class="chat-input">
            <input type="text" id="message-input" placeholder="Type a message...">
            <button id="send-btn">Send</button>
        </div>
    `;

    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesDiv = document.getElementById('messages');

    // Create a unique chat room ID
    const chatRoomId = [currentUser.uid, otherUser.id].sort().join('_');
    const chatRef = collection(db, "chats", chatRoomId, "messages");
    const q = query(chatRef);

    // Listen for messages
    onSnapshot(q, (snapshot) => {
        messagesDiv.innerHTML = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const messageEl = document.createElement('div');
            messageEl.textContent = msg.text;
            messageEl.classList.add('message');
            messageEl.classList.add(msg.senderId === currentUser.uid ? 'sent' : 'received');
            messagesDiv.appendChild(messageEl);
        });
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });

    // Send message
    sendBtn.onclick = async () => {
        if (messageInput.value.trim() === '') return;
        
        await addDoc(chatRef, {
            text: messageInput.value,
            senderId: currentUser.uid,
            receiverId: otherUser.id,
            timestamp: serverTimestamp()
        });
        messageInput.value = '';
    };
}

// Initial load
if (!currentUser) {
    renderLoginForm();
}

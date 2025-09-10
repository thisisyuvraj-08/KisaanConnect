// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDnhwxpN_6VXNY2rkfKJuA5XFmSERSOFsM",
  authDomain: "kisaan-connect-da56d.firebaseapp.com",
  projectId: "kisaan-connect-da56d",
  storageBucket: "kisaan-connect-da56d.firebasestorage.app",
  messagingSenderId: "401721766160",
  appId: "1:401721766160:web:fe4ec1d3d2cc0f19f07595",
  measurementId: "G-9VQVCJYCWE"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// App state
let user = null;
let userData = null;
let userLocation = null;
let map = null;

// DOM Elements
const authModal = document.getElementById('auth-modal');
const notification = document.getElementById('notification');
const loader = document.getElementById('loader');
const authClose = document.getElementById('auth-close');

// Show authentication modal on load
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already logged in
  auth.onAuthStateChanged((user) => {
    if (user) {
      // User is signed in
      handleUserSignedIn(user);
    } else {
      // No user is signed in, show auth modal
      authModal.style.display = 'flex';
    }
  });
  
  // Initialize map
  initMap();
  
  // Set up auth form submission
  document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
  
  // Set up auth tabs
  const authTabs = document.querySelectorAll('.auth-tab');
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Toggle role field visibility
      const roleGroup = document.getElementById('role-group');
      const nameGroup = document.getElementById('name-group');
      const phoneGroup = document.getElementById('phone-group');
      const authBtn = document.querySelector('.auth-btn');
      
      if (tab.textContent === 'Sign Up') {
        roleGroup.style.display = 'block';
        nameGroup.style.display = 'block';
        phoneGroup.style.display = 'block';
        authBtn.textContent = 'Create Account';
      } else {
        roleGroup.style.display = 'none';
        nameGroup.style.display = 'none';
        phoneGroup.style.display = 'none';
        authBtn.textContent = 'Login';
      }
    });
  });
  
  // Close auth modal
  authClose.addEventListener('click', () => {
    authModal.style.display = 'none';
  });
});

// Initialize Leaflet map
function initMap() {
  // Use default location (Delhi, India)
  const defaultLocation = [28.6139, 77.2090];
  
  // Initialize map
  map = L.map('map').setView(defaultLocation, 10);
  
  // Add OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  
  // Add user location marker
  L.marker(defaultLocation)
    .addTo(map)
    .bindPopup('<h3>Your Location</h3>')
    .openPopup();
  
  // Add sample markers
  L.marker([28.62, 77.22])
    .addTo(map)
    .bindPopup('<h3>Vegetable Paradise</h3><p>Tomatoes - 100kg</p>');
    
  L.marker([28.58, 77.18])
    .addTo(map)
    .bindPopup('<h3>Fruit King</h3><p>Apples - 50kg</p>');
}

// Show notification
function showNotification(message, type = 'success') {
  const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
  notification.innerHTML = `<i class="fas ${icon}"></i><div class="notification-content">${message}</div>`;
  notification.className = `notification ${type} show`;
  
  setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

// Show/hide loader
function setLoading(loading) {
  if (loading) {
    loader.classList.remove('hidden');
  } else {
    loader.classList.add('hidden');
  }
}

// Handle user sign in
async function handleUserSignedIn(user) {
  setLoading(true);
  
  try {
    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    
    if (userDoc.exists) {
      userData = userDoc.data();
      
      // Update UI with user info
      const userAvatar = document.querySelector('.user-avatar');
      userAvatar.textContent = userData.name ? userData.name.charAt(0).toUpperCase() : 'U';
      
      // Hide auth modal
      authModal.style.display = 'none';
      
      showNotification('Welcome back!', 'success');
    } else {
      // User document doesn't exist, sign out
      await auth.signOut();
    }
  } catch (error) {
    console.error('Error getting user data:', error);
    showNotification('Error loading user data', 'error');
  }
  
  setLoading(false);
}

// Handle auth form submission
async function handleAuthSubmit(e) {
  e.preventDefault();
  setLoading(true);
  
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const isSignUp = document.querySelector('.auth-tab:nth-child(2)').classList.contains('active');
  
  try {
    if (isSignUp) {
      // Sign up
      const role = document.getElementById('auth-role').value;
      const name = document.getElementById('auth-name').value;
      const phone = document.getElementById('auth-phone').value;
      
      if (!role) {
        throw new Error('Please select a role');
      }
      
      // Create user with email and password
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;
      
      // Save user data to Firestore
      await db.collection('users').doc(user.uid).set({
        email: email,
        name: name,
        phone: phone,
        role: role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      showNotification('Account created successfully!', 'success');
    } else {
      // Sign in
      await auth.signInWithEmailAndPassword(email, password);
      showNotification('Logged in successfully!', 'success');
    }
  } catch (error) {
    console.error('Auth error:', error);
    showNotification(error.message, 'error');
  }
  
  setLoading(false);
}

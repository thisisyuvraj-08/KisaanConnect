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

// Mapbox configuration
const MAPBOX_ACCESS_TOKEN = "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NmNuczAwemYycXBndjN6bWZ3N3gifQ.FwM1h9gQ27Z6f1n3lA5yng";

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// App state
let user = null;
let userData = null;
let userLocation = null;
let map = null;
let mapMarkers = [];
let currentPage = 'home';
let currentChatUser = null;
let postsListener = null;
let chatListener = null;

// DOM Elements
const authModal = document.getElementById('auth-modal');
const notification = document.getElementById('notification');
const loader = document.getElementById('loader');
const mainContent = document.getElementById('main-content');
const userMenu = document.getElementById('user-menu');
const userDropdown = document.getElementById('user-dropdown');
const createPostBtn = document.getElementById('create-post-btn');
const postModal = document.getElementById('post-modal');
const closePostModal = document.getElementById('close-post-modal');
const editPostModal = document.getElementById('edit-post-modal');
const closeEditPostModal = document.getElementById('close-edit-post-modal');
const chatModal = document.getElementById('chat-modal');
const chatCloseBtn = document.getElementById('chat-close-btn');
const chatCallBtn = document.getElementById('chat-call-btn');
const chatWhatsappBtn = document.getElementById('chat-whatsapp-btn');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const getLocationBtn = document.getElementById('get-location-btn');
const locationStatus = document.getElementById('post-location-status');

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is logged in
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // User is signed in
      await handleUserSignedIn(user);
    } else {
      // User is signed out
      handleUserSignedOut();
    }
  });

  // Set up event listeners
  setupEventListeners();
});

// Set up all event listeners
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page');
      navigateTo(page);
    });
  });

  // User menu
  userMenu.addEventListener('click', toggleUserDropdown);
  document.addEventListener('click', (e) => {
    if (!userMenu.contains(e.target) && !userDropdown.contains(e.target)) {
      userDropdown.classList.add('hidden');
    }
  });

  // Auth modal tabs
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      switchAuthTab(tabName);
    });
  });

  // Auth form submission
  document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);

  // Create post
  createPostBtn.addEventListener('click', () => {
    postModal.classList.remove('hidden');
  });

  closePostModal.addEventListener('click', () => {
    postModal.classList.add('hidden');
  });

  document.getElementById('post-form').addEventListener('submit', handleCreatePost);

  // Edit post
  closeEditPostModal.addEventListener('click', () => {
    editPostModal.classList.add('hidden');
  });

  document.getElementById('edit-post-form').addEventListener('submit', handleEditPost);

  // Chat
  chatCloseBtn.addEventListener('click', () => {
    chatModal.classList.add('hidden');
    if (chatListener) {
      chatListener();
    }
  });

  chatSendBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  chatCallBtn.addEventListener('click', initiateCallFromChat);
  chatWhatsappBtn.addEventListener('click', openWhatsAppFromChat);

  // User dropdown actions
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('my-posts-btn').addEventListener('click', showMyPosts);
  document.getElementById('profile-btn').addEventListener('click', showProfile);

  // Location button
  getLocationBtn.addEventListener('click', getLocationForPost);
}

// Handle user sign in
async function handleUserSignedIn(user) {
  setLoading(true);
  
  try {
    // Get user data from Firestore
    const userDoc = await db.collection('users').doc(user.uid).get();
    
    if (userDoc.exists) {
      userData = userDoc.data();
      userData.uid = user.uid;
      
      // Update UI
      updateUIAfterLogin();
      
      // Load initial data based on user role
      if (userData.role === 'farmer') {
        loadShopRequests();
      } else {
        loadProducePosts();
      }
      
      // Hide auth modal
      authModal.style.display = 'none';
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

// Handle user sign out
function handleUserSignedOut() {
  user = null;
  userData = null;
  
  // Clear any listeners
  if (postsListener) postsListener();
  if (chatListener) chatListener();
  
  // Show auth modal
  authModal.style.display = 'flex';
  
  // Reset UI
  mainContent.innerHTML = '';
  userDropdown.classList.add('hidden');
}

// Update UI after login
function updateUIAfterLogin() {
  // Update user avatar with first letter of name
  const userAvatar = document.querySelector('.user-avatar');
  userAvatar.textContent = userData.name ? userData.name.charAt(0).toUpperCase() : 'U';
  
  // Render home page
  renderHomePage();
}

// Get location for post creation
function getLocationForPost() {
  locationStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Getting your location...';
  
  if (!navigator.geolocation) {
    locationStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Geolocation is not supported by your browser';
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      locationStatus.innerHTML = '<i class="fas fa-check-circle"></i> Location acquired successfully!';
    },
    (error) => {
      console.error('Error getting location:', error);
      locationStatus.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Unable to get your location. Please try again.';
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000
    }
  );
}

// Switch auth tab
function switchAuthTab(tabName) {
  // Update active tab
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`.auth-tab[data-tab="${tabName}"]`).classList.add('active');
  
  // Show/hide fields based on tab
  const roleGroup = document.getElementById('role-group');
  const nameGroup = document.getElementById('name-group');
  const phoneGroup = document.getElementById('phone-group');
  const authBtn = document.querySelector('.auth-btn');
  
  if (tabName === 'signup') {
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
}

// Handle auth form submission
async function handleAuthSubmit(e) {
  e.preventDefault();
  setLoading(true);
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const isSignUp = document.querySelector('.auth-tab[data-tab="signup"]').classList.contains('active');
  
  try {
    if (isSignUp) {
      // Sign up
      const role = document.getElementById('role').value;
      const name = document.getElementById('name').value;
      const phone = document.getElementById('phone').value;
      
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

// Handle create post
async function handleCreatePost(e) {
  e.preventDefault();
  setLoading(true);
  
  try {
    const postType = document.getElementById('post-type').value;
    const produceType = document.getElementById('produce-type').value;
    const quantity = document.getElementById('quantity').value;
    const unit = document.getElementById('unit').value;
    const price = document.getElementById('price').value;
    const description = document.getElementById('description').value;
    const deadlineHours = parseInt(document.getElementById('deadline').value);
    
    // Check if location is available
    if (!userLocation) {
      showNotification('Please enable location to create a post', 'error');
      setLoading(false);
      return;
    }
    
    // Calculate expiry date
    const now = new Date();
    const expiryDate = new Date(now.getTime() + deadlineHours * 60 * 60 * 1000);
    
    // Create post object
    const postData = {
      type: postType,
      produceType: produceType,
      quantity: quantity,
      unit: unit,
      price: price,
      description: description,
      userId: userData.uid,
      userName: userData.name,
      userPhone: userData.phone,
      location: new firebase.firestore.GeoPoint(
        userLocation.latitude,
        userLocation.longitude
      ),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      expiresAt: expiryDate,
      status: 'active'
    };
    
    // Save to Firestore
    await db.collection('posts').add(postData);
    
    // Close modal and reset form
    postModal.classList.add('hidden');
    e.target.reset();
    
    showNotification('Post created successfully!', 'success');
  } catch (error) {
    console.error('Error creating post:', error);
    showNotification('Error creating post', 'error');
  }
  
  setLoading(false);
}

// Handle edit post
async function handleEditPost(e) {
  e.preventDefault();
  setLoading(true);
  
  try {
    const postId = document.getElementById('edit-post-id').value;
    const produceType = document.getElementById('edit-produce-type').value;
    const quantity = document.getElementById('edit-quantity').value;
    const unit = document.getElementById('edit-unit').value;
    const price = document.getElementById('edit-price').value;
    const description = document.getElementById('edit-description').value;
    
    // Update post in Firestore
    await db.collection('posts').doc(postId).update({
      produceType: produceType,
      quantity: quantity,
      unit: unit,
      price: price,
      description: description,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Close modal
    editPostModal.classList.add('hidden');
    
    showNotification('Post updated successfully!', 'success');
  } catch (error) {
    console.error('Error updating post:', error);
    showNotification('Error updating post', 'error');
  }
  
  setLoading(false);
}

// Load shop requests (for farmers)
function loadShopRequests() {
  if (postsListener) postsListener(); // Remove previous listener
  
  postsListener = db.collection('posts')
    .where('type', '==', 'request')
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      const posts = [];
      snapshot.forEach(doc => {
        const post = doc.data();
        post.id = doc.id;
        
        // Check if post is expired
        if (post.expiresAt && post.expiresAt.toDate() < new Date()) {
          // Mark as expired
          db.collection('posts').doc(doc.id).update({
            status: 'expired'
          });
          return;
        }
        
        // Check distance if user location is available
        if (userLocation && post.location) {
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            post.location.latitude,
            post.location.longitude
          );
          
          post.distance = distance;
          
          // Only show posts within 50km (for demo purposes)
          if (distance <= 50) {
            posts.push(post);
          }
        } else {
          posts.push(post);
        }
      });
      
      renderPosts(posts, 'shop');
    }, error => {
      console.error('Error loading posts:', error);
    });
}

// Load produce posts (for shopkeepers)
function loadProducePosts() {
  if (postsListener) postsListener(); // Remove previous listener
  
  postsListener = db.collection('posts')
    .where('type', '==', 'produce')
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      const posts = [];
      snapshot.forEach(doc => {
        const post = doc.data();
        post.id = doc.id;
        
        // Check if post is expired
        if (post.expiresAt && post.expiresAt.toDate() < new Date()) {
          // Mark as expired
          db.collection('posts').doc(doc.id).update({
            status: 'expired'
          });
          return;
        }
        
        // Check distance if user location is available
        if (userLocation && post.location) {
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            post.location.latitude,
            post.location.longitude
          );
          
          post.distance = distance;
          
          // Only show posts within 50km (for demo purposes)
          if (distance <= 50) {
            posts.push(post);
          }
        } else {
          posts.push(post);
        }
      });
      
      renderPosts(posts, 'produce');
    }, error => {
      console.error('Error loading posts:', error);
    });
}

// Render posts to the UI
function renderPosts(posts, type) {
  const postsContainer = document.getElementById('posts-container');
  
  if (!postsContainer) {
    // Create container if it doesn't exist
    const feedSection = document.querySelector('.feed-section');
    if (feedSection) {
      const newContainer = document.createElement('div');
      newContainer.id = 'posts-container';
      newContainer.className = 'feed-list';
      feedSection.appendChild(newContainer);
    }
    return;
  }
  
  // Clear previous posts
  postsContainer.innerHTML = '';
  
  if (posts.length === 0) {
    postsContainer.innerHTML = `
      <div class="text-center" style="padding: 2rem;">
        <p>No posts found in your area.</p>
        <p>Try increasing your search radius or check back later.</p>
      </div>
    `;
    return;
  }
  
  // Render each post
  posts.forEach(post => {
    const postEl = document.createElement('div');
    postEl.className = 'feed-card';
    
    // Calculate time remaining
    const now = new Date();
    const expiresAt = post.expiresAt.toDate();
    const timeRemaining = expiresAt - now;
    const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
    const daysRemaining = Math.floor(hoursRemaining / 24);
    
    let timeText = '';
    if (daysRemaining > 0) {
      timeText = `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`;
    } else {
      timeText = `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} remaining`;
    }
    
    postEl.innerHTML = `
      <div class="feed-avatar">${post.userName ? post.userName.charAt(0).toUpperCase() : 'U'}</div>
      <div class="feed-content">
        <h3 class="feed-title">${post.produceType} • ${post.quantity} ${post.unit}</h3>
        <div class="feed-meta">
          <div>Price: ₹${post.price} per ${post.unit}</div>
          <div>By: ${post.userName || 'Unknown'}</div>
          ${post.distance ? `<div>Distance: ${post.distance.toFixed(1)} km away</div>` : ''}
        </div>
        ${post.description ? `<div class="feed-description">${post.description}</div>` : ''}
        <div class="feed-expiry">${timeText}</div>
        <div class="feed-actions">
          <button class="action-btn" onclick="initiateCall('${post.userPhone}')">
            <i class="fas fa-phone"></i>
            Call
          </button>
          <button class="action-btn" onclick="openWhatsApp('${post.userPhone}')">
            <i class="fab fa-whatsapp"></i>
            WhatsApp
          </button>
          <button class="action-btn" onclick="startChat('${post.userId}', '${post.userName}', '${post.userPhone}')">
            <i class="fas fa-comment"></i>
            Chat
          </button>
          ${post.userId === userData.uid ? `
            <button class="action-btn secondary" onclick="editPost('${post.id}')">
              <i class="fas fa-edit"></i>
              Edit
            </button>
            <button class="action-btn secondary" onclick="deletePost('${post.id}')">
              <i class="fas fa-trash"></i>
              Delete
            </button>
          ` : ''}
        </div>
      </div>
    `;
    
    postsContainer.appendChild(postEl);
  });
}

// Calculate distance between two coordinates (in km)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// Initiate a call
function initiateCall(phoneNumber) {
  if (!phoneNumber) {
    showNotification('Phone number not available', 'error');
    return;
  }
  
  window.open(`tel:${phoneNumber}`, '_self');
}

// Open WhatsApp
function openWhatsApp(phoneNumber) {
  if (!phoneNumber) {
    showNotification('Phone number not available', 'error');
    return;
  }
  
  // Remove any non-digit characters from phone number
  const cleanedPhone = phoneNumber.replace(/\D/g, '');
  window.open(`https://wa.me/91${cleanedPhone}`, '_blank');
}

// Initiate call from chat
function initiateCallFromChat() {
  if (!currentChatUser || !currentChatUser.phone) {
    showNotification('Phone number not available', 'error');
    return;
  }
  
  window.open(`tel:${currentChatUser.phone}`, '_self');
}

// Open WhatsApp from chat
function openWhatsAppFromChat() {
  if (!currentChatUser || !currentChatUser.phone) {
    showNotification('Phone number not available', 'error');
    return;
  }
  
  // Remove any non-digit characters from phone number
  const cleanedPhone = currentChatUser.phone.replace(/\D/g, '');
  window.open(`https://wa.me/91${cleanedPhone}`, '_blank');
}

// Start chat with a user
function startChat(userId, userName, userPhone) {
  if (!userId || userId === userData.uid) {
    showNotification('Cannot chat with yourself', 'error');
    return;
  }
  
  currentChatUser = {
    id: userId,
    name: userName,
    phone: userPhone
  };
  
  // Update chat modal
  document.getElementById('chat-user-avatar').textContent = userName.charAt(0).toUpperCase();
  document.getElementById('chat-user-name').textContent = userName;
  
  // Clear previous messages
  chatMessages.innerHTML = '';
  
  // Load chat messages
  loadChatMessages(userId);
  
  // Show chat modal
  chatModal.classList.remove('hidden');
}

// Load chat messages
function loadChatMessages(userId) {
  if (chatListener) chatListener(); // Remove previous listener
  
  // Generate a unique chat ID based on user IDs
  const chatId = [userData.uid, userId].sort().join('_');
  
  chatListener = db.collection('chats')
    .doc(chatId)
    .collection('messages')
    .orderBy('timestamp', 'asc')
    .onSnapshot(snapshot => {
      chatMessages.innerHTML = '';
      
      snapshot.forEach(doc => {
        const message = doc.data();
        addMessageToChat(message, message.senderId === userData.uid);
      });
      
      // Scroll to bottom
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

// Send chat message
async function sendChatMessage() {
  const messageText = chatInput.value.trim();
  
  if (!messageText || !currentChatUser) return;
  
  try {
    // Generate a unique chat ID based on user IDs
    const chatId = [userData.uid, currentChatUser.id].sort().join('_');
    
    // Add message to Firestore
    await db.collection('chats').doc(chatId).collection('messages').add({
      text: messageText,
      senderId: userData.uid,
      senderName: userData.name,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Clear input
    chatInput.value = '';
  } catch (error) {
    console.error('Error sending message:', error);
    showNotification('Error sending message', 'error');
  }
}

// Add message to chat UI
function addMessageToChat(message, isSent) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${isSent ? 'sent' : 'received'}`;
  
  const timestamp = message.timestamp ? message.timestamp.toDate() : new Date();
  const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  messageEl.innerHTML = `
    <div class="message-text">${message.text}</div>
    <div class="message-time">${timeString}</div>
  `;
  
  chatMessages.appendChild(messageEl);
}

// Edit post
async function editPost(postId) {
  try {
    const postDoc = await db.collection('posts').doc(postId).get();
    
    if (postDoc.exists) {
      const post = postDoc.data();
      
      // Fill the edit form with post data
      document.getElementById('edit-post-id').value = postId;
      document.getElementById('edit-produce-type').value = post.produceType || '';
      document.getElementById('edit-quantity').value = post.quantity || '';
      document.getElementById('edit-unit').value = post.unit || '';
      document.getElementById('edit-price').value = post.price || '';
      document.getElementById('edit-description').value = post.description || '';
      
      // Show the edit modal
      editPostModal.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error loading post for editing:', error);
    showNotification('Error loading post', 'error');
  }
}

// Delete post
async function deletePost(postId) {
  if (!confirm('Are you sure you want to delete this post?')) return;
  
  try {
    await db.collection('posts').doc(postId).update({
      status: 'deleted'
    });
    
    showNotification('Post deleted successfully', 'success');
  } catch (error) {
    console.error('Error deleting post:', error);
    showNotification('Error deleting post', 'error');
  }
}

// Show user's own posts
async function showMyPosts() {
  setLoading(true);
  
  try {
    const querySnapshot = await db.collection('posts')
      .where('userId', '==', userData.uid)
      .orderBy('createdAt', 'desc')
      .get();
    
    const posts = [];
    querySnapshot.forEach(doc => {
      const post = doc.data();
      post.id = doc.id;
      posts.push(post);
    });
    
    // Render posts
    renderMyPosts(posts);
    
    // Update UI
    navigateTo('my-posts');
  } catch (error) {
    console.error('Error loading user posts:', error);
    showNotification('Error loading your posts', 'error');
  }
  
  setLoading(false);
}

// Render user's own posts
function renderMyPosts(posts) {
  const myPostsPage = document.createElement('div');
  myPostsPage.className = 'my-posts-page';
  
  myPostsPage.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">My Posts</h2>
    </div>
    <div class="feed-list" id="my-posts-container"></div>
  `;
  
  mainContent.innerHTML = '';
  mainContent.appendChild(myPostsPage);
  
  const container = document.getElementById('my-posts-container');
  
  if (posts.length === 0) {
    container.innerHTML = `
      <div class="text-center" style="padding: 2rem;">
        <p>You haven't created any posts yet.</p>
        <button class="action-btn" onclick="postModal.classList.remove('hidden')">
          <i class="fas fa-plus"></i>
          Create Your First Post
        </button>
      </div>
    `;
    return;
  }
  
  posts.forEach(post => {
    const postEl = document.createElement('div');
    postEl.className = 'feed-card';
    
    // Calculate time remaining or status
    let statusText = '';
    let statusClass = '';
    
    if (post.status === 'expired') {
      statusText = 'Expired';
      statusClass = 'expired';
    } else if (post.status === 'deleted') {
      statusText = 'Deleted';
      statusClass = 'deleted';
    } else {
      const now = new Date();
      const expiresAt = post.expiresAt.toDate();
      
      if (expiresAt < now) {
        statusText = 'Expired';
        statusClass = 'expired';
      } else {
        const timeRemaining = expiresAt - now;
        const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
        const daysRemaining = Math.floor(hoursRemaining / 24);
        
        if (daysRemaining > 0) {
          statusText = `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`;
        } else {
          statusText = `${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''} remaining`;
        }
        statusClass = 'active';
      }
    }
    
    postEl.innerHTML = `
      <div class="feed-avatar">${post.userName ? post.userName.charAt(0).toUpperCase() : 'U'}</div>
      <div class="feed-content">
        <h3 class="feed-title">${post.produceType} • ${post.quantity} ${post.unit}</h3>
        <div class="feed-meta">
          <div>Price: ₹${post.price} per ${post.unit}</div>
          <div>Type: ${post.type === 'produce' ? 'Selling' : 'Requesting'}</div>
          <div>Status: <span class="status ${statusClass}">${statusText}</span></div>
          <div>Created: ${post.createdAt ? post.createdAt.toDate().toLocaleDateString() : 'Unknown'}</div>
        </div>
        ${post.description ? `<div class="feed-description">${post.description}</div>` : ''}
        <div class="feed-actions">
          ${post.status === 'active' ? `
            <button class="action-btn secondary" onclick="editPost('${post.id}')">
              <i class="fas fa-edit"></i>
              Edit
            </button>
          ` : ''}
          <button class="action-btn secondary" onclick="deletePost('${post.id}')">
            <i class="fas fa-trash"></i>
            Delete
          </button>
        </div>
      </div>
    `;
    
    container.appendChild(postEl);
  });
}

// Show user profile
function showProfile() {
  const profilePage = document.createElement('div');
  profilePage.className = 'profile-page';
  
  profilePage.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">My Profile</h2>
    </div>
    <div class="card">
      <div class="profile-info">
        <div class="profile-avatar">${userData.name ? userData.name.charAt(0).toUpperCase() : 'U'}</div>
        <div class="profile-details">
          <h3>${userData.name || 'No name provided'}</h3>
          <p>Email: ${userData.email}</p>
          <p>Phone: ${userData.phone || 'No phone provided'}</p>
          <p>Role: ${userData.role === 'farmer' ? 'Farmer' : 'Shopkeeper'}</p>
          <p>Member since: ${userData.createdAt ? userData.createdAt.toDate().toLocaleDateString() : 'Unknown'}</p>
        </div>
      </div>
      <div class="profile-actions">
        <button class="action-btn" onclick="getLocationForApp()">
          <i class="fas fa-map-marker-alt"></i>
          Update My Location
        </button>
      </div>
    </div>
  `;
  
  mainContent.innerHTML = '';
  mainContent.appendChild(profilePage);
  userDropdown.classList.add('hidden');
}

// Get location for the app
function getLocationForApp() {
  if (!navigator.geolocation) {
    showNotification('Geolocation is not supported by your browser', 'error');
    return;
  }
  
  showNotification('Getting your location...', 'success');
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      showNotification('Location updated successfully!', 'success');
      
      // Update user location in Firestore
      if (userData) {
        db.collection('users').doc(userData.uid).update({
          location: new firebase.firestore.GeoPoint(
            userLocation.latitude,
            userLocation.longitude
          ),
          lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    },
    (error) => {
      console.error('Error getting location:', error);
      showNotification('Unable to get your location', 'error');
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000
    }
  );
}

// Navigate to different pages
function navigateTo(page) {
  currentPage = page;
  
  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');
  
  // Render the appropriate page
  switch (page) {
    case 'home':
      renderHomePage();
      break;
    case 'map':
      renderMapPage();
      break;
    case 'chat':
      renderChatPage();
      break;
    default:
      renderHomePage();
  }
}

// Render home page
function renderHomePage() {
  const homePage = document.createElement('div');
  homePage.className = 'home-page';
  
  homePage.innerHTML = `
    <div class="welcome-banner">
      <h1>Welcome, ${userData.name || 'User'}!</h1>
      <p>${userData.role === 'farmer' ? 'Browse shop requests in your area' : 'Find fresh produce from local farmers'}</p>
    </div>
    
    <div class="feed-section">
      <div class="section-header">
        <h2 class="section-title">${userData.role === 'farmer' ? 'Nearby Shop Requests' : 'Available Produce'}</h2>
        <div class="filter-controls">
          <select class="filter-select" id="distance-filter">
            <option value="10">Within 10 km</option>
            <option value="25">Within 25 km</option>
            <option value="50" selected>Within 50 km</option>
            <option value="100">Within 100 km</option>
          </select>
        </div>
      </div>
      <div class="feed-list" id="posts-container">
        <div class="text-center" style="padding: 2rem;">
          <p>Loading posts...</p>
        </div>
      </div>
    </div>
  `;
  
  mainContent.innerHTML = '';
  mainContent.appendChild(homePage);
  
  // Set up distance filter
  const distanceFilter = document.getElementById('distance-filter');
  if (distanceFilter) {
    distanceFilter.addEventListener('change', () => {
      // Reload posts with new filter
      if (userData.role === 'farmer') {
        loadShopRequests();
      } else {
        loadProducePosts();
      }
    });
  }
  
  // Load appropriate posts
  if (userData.role === 'farmer') {
    loadShopRequests();
  } else {
    loadProducePosts();
  }
}

// Render map page
function renderMapPage() {
  const mapPage = document.createElement('div');
  mapPage.className = 'map-page';
  
  mapPage.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">Local Map</h2>
      <div class="filter-controls">
        <select class="filter-select" id="map-type-filter">
          <option value="all">Show All</option>
          <option value="produce" ${userData.role === 'shopkeeper' ? 'selected' : ''}>Produce Only</option>
          <option value="request" ${userData.role === 'farmer' ? 'selected' : ''}>Requests Only</option>
        </select>
      </div>
    </div>
    <div class="map-container" id="map"></div>
  `;
  
  mainContent.innerHTML = '';
  mainContent.appendChild(mapPage);
  
  // Initialize map
  initMap();
  
  // Set up map type filter
  const mapTypeFilter = document.getElementById('map-type-filter');
  if (mapTypeFilter) {
    mapTypeFilter.addEventListener('change', () => {
      // Reload map with new filter
      initMap();
    });
  }
}

// Initialize map
function initMap() {
  if (!userLocation) {
    // Try to get user location for map
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          userLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
          renderMapWithLocation();
        },
        (error) => {
          // Use default location if unable to get user location
          userLocation = { latitude: 28.6139, longitude: 77.2090 };
          renderMapWithLocation();
        }
      );
    } else {
      // Use default location if geolocation is not supported
      userLocation = { latitude: 28.6139, longitude: 77.2090 };
      renderMapWithLocation();
    }
  } else {
    renderMapWithLocation();
  }
}

// Render map with location
function renderMapWithLocation() {
  // Remove existing map if any
  if (map) {
    map.remove();
    mapMarkers.forEach(marker => marker.remove());
    mapMarkers = [];
  }
  
  // Initialize Mapbox map
  mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [userLocation.longitude, userLocation.latitude],
    zoom: 10
  });
  
  // Add user location marker
  const userMarker = new mapboxgl.Marker({ color: '#2e7d32' })
    .setLngLat([userLocation.longitude, userLocation.latitude])
    .setPopup(new mapboxgl.Popup().setHTML(`
      <h3>Your Location</h3>
      <p>${userData.name || 'User'}</p>
    `))
    .addTo(map);
  
  mapMarkers.push(userMarker);
  
  // Load posts for map
  const mapTypeFilter = document.getElementById('map-type-filter');
  const filterValue = mapTypeFilter ? mapTypeFilter.value : 'all';
  
  let query = db.collection('posts').where('status', '==', 'active');
  
  if (filterValue !== 'all') {
    query = query.where('type', '==', filterValue);
  }
  
  query.get().then(snapshot => {
    snapshot.forEach(doc => {
      const post = doc.data();
      
      // Check distance if user location is available
      if (userLocation && post.location) {
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          post.location.latitude,
          post.location.longitude
        );
        
        // Only show posts within 50km (for demo purposes)
        if (distance <= 50) {
          // Create marker
          const markerColor = post.type === 'produce' ? '#ff9800' : '#2196f3';
          const markerIcon = post.type === 'produce' ? '🛒' : '🌾';
          
          const markerEl = document.createElement('div');
          markerEl.className = 'map-marker';
          markerEl.innerHTML = `<div class="marker-icon">${markerIcon}</div>`;
          markerEl.style.color = markerColor;
          markerEl.style.fontSize = '24px';
          
          const marker = new mapboxgl.Marker(markerEl)
            .setLngLat([post.location.longitude, post.location.latitude])
            .setPopup(new mapboxgl.Popup().setHTML(`
              <h3>${post.produceType}</h3>
              <p>${post.quantity} ${post.unit} • ₹${post.price}/${post.unit}</p>
              <p>By: ${post.userName || 'Unknown'}</p>
              <p>Distance: ${distance.toFixed(1)} km</p>
              <button onclick="startChat('${post.userId}', '${post.userName}', '${post.userPhone}')" style="margin-top: 10px; padding: 5px 10px; background: #2e7d32; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Chat
              </button>
            `))
            .addTo(map);
          
          mapMarkers.push(marker);
        }
      }
    });
  }).catch(error => {
    console.error('Error loading posts for map:', error);
  });
}

// Render chat page
function renderChatPage() {
  const chatPage = document.createElement('div');
  chatPage.className = 'chat-page';
  
  chatPage.innerHTML = `
    <div class="section-header">
      <h2 class="section-title">Recent Chats</h2>
    </div>
    <div class="chat-list" id="chats-container">
      <div class="text-center" style="padding: 2rem;">
        <p>Start a chat by clicking on the "Chat" button on any post.</p>
      </div>
    </div>
  `;
  
  mainContent.innerHTML = '';
  mainContent.appendChild(chatPage);
  
  // Load recent chats
  loadRecentChats();
}

// Load recent chats
function loadRecentChats() {
  // This would typically query Firestore for recent chats
  // For now, we'll show a placeholder
  const chatsContainer = document.getElementById('chats-container');
  
  if (chatsContainer) {
    chatsContainer.innerHTML = `
      <div class="text-center" style="padding: 2rem;">
        <p>Start a chat by clicking on the "Chat" button on any post.</p>
      </div>
    `;
  }
}

// Toggle user dropdown
function toggleUserDropdown() {
  userDropdown.classList.toggle('hidden');
}

// Handle logout
async function handleLogout() {
  setLoading(true);
  
  try {
    await auth.signOut();
    showNotification('Logged out successfully', 'success');
  } catch (error) {
    console.error('Error signing out:', error);
    showNotification('Error signing out', 'error');
  }
  
  setLoading(false);
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

// Set loading state
function setLoading(loading) {
  if (loading) {
    loader.classList.remove('hidden');
  } else {
    loader.classList.add('hidden');
  }
}

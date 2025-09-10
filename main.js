// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDnhwxpN_6VXNY2rkfKJuA5XFmSERSOFsM",
    authDomain: "kisaan-connect-da56d.firebaseapp.com",
    projectId: "kisaan-connect-da56d",
    storageBucket: "kisaan-connect-da56d.appspot.com",
    messagingSenderId: "401721766160",
    appId: "1:401721766160:web:fe4ec1d3d2cc0f19f07595"
};

// ❗ IMPORTANT: PASTE YOUR MAPBOX TOKEN HERE
const MAPBOX_ACCESS_TOKEN = 'YOUR_MAPBOX_ACCESS_TOKEN';

// --- APPLICATION STATE ---
let db, map;
let userRole = null;
let userLocation = null;
let markers = [];

// --- DOM ELEMENTS ---
const mainContent = document.getElementById('main-content');
const userViewControls = document.getElementById('user-view-controls');
const loadingOverlay = document.getElementById('loading-overlay');
const contactModal = document.getElementById('contact-modal');

// --- INITIALIZATION ---
function initialize() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log("Firebase Initialized.");
        render();
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        showNotification("Critical Error: Could not connect to the database.", "error");
    } finally {
        // Hide initial loader once everything is ready
        setTimeout(() => loadingOverlay.classList.remove('visible'), 500);
    }
}

// --- UI RENDERING & CONTROL ---
function render() {
    mainContent.innerHTML = '';
    userViewControls.innerHTML = '';
    if (map) { map.remove(); map = null; }

    if (!userRole) {
        renderRoleSelection();
    } else {
        renderUserControls();
        mainContent.style.opacity = 0; // For fade-in effect
        if (userRole === 'farmer') {
            renderFarmerView();
        } else if (userRole === 'shop-owner') {
            renderShopOwnerView();
        }
        initializeViewForRole(userRole);
        setTimeout(() => mainContent.style.opacity = 1, 50); // Trigger fade-in
    }
}

function renderRoleSelection() {
    mainContent.innerHTML = `
        <div class="role-selection-view">
            <h2 class="role-selection-title">Connecting Fields to Local Stores</h2>
            <p class="role-selection-subtitle">The simplest way for farmers to sell surplus produce and for shop owners to source fresh, local goods.</p>
            <div class="role-buttons">
                <button class="btn btn-primary" id="farmer-role-btn">I'm a Farmer 🧑‍🌾</button>
                <button class="btn btn-secondary" id="shop-owner-role-btn">I'm a Shop Owner 🛒</button>
            </div>
        </div>
    `;
    document.getElementById('farmer-role-btn').onclick = () => handleRoleSelect('farmer');
    document.getElementById('shop-owner-role-btn').onclick = () => handleRoleSelect('shop-owner');
}

function renderUserControls() {
    const switchButton = document.createElement('button');
    switchButton.textContent = 'Switch Role';
    switchButton.className = 'btn btn-outline';
    switchButton.onclick = () => handleRoleSelect(null);
    userViewControls.appendChild(switchButton);
}

function renderFarmerView() {
    mainContent.innerHTML = `
        <div class="view-grid">
            <div class="form-container">
                <h2 class="form-title">Post Your Produce</h2>
                <form id="produce-form">
                    <div class="form-group">
                        <label for="productName">Product Name</label>
                        <input type="text" id="productName" name="productName" class="form-input" required placeholder="e.g., Organic Tomatoes">
                    </div>
                    <div class="form-group">
                        <label for="quantity">Quantity (in kg)</label>
                        <input type="number" id="quantity" name="quantity" class="form-input" required placeholder="e.g., 25">
                    </div>
                    <div class="form-group">
                        <label for="price">Price (per kg)</label>
                        <input type="number" id="price" name="price" class="form-input" required placeholder="e.g., 18">
                    </div>
                    <button type="submit" id="submit-button" class="btn btn-primary" style="width: 100%;">Post to Marketplace</button>
                </form>
            </div>
            <div class="card">
                <h2 class="card-title">Your Location</h2>
                <div id="map"></div>
                <p id="location-status" style="text-align:center; margin-top:1rem;"></p>
            </div>
        </div>
    `;
}

function renderShopOwnerView() {
    mainContent.innerHTML = `
        <div class="card card-full-height">
            <h2 class="card-title">Live Marketplace</h2>
            <div id="map"></div>
        </div>
    `;
}

// --- CORE LOGIC & EVENT HANDLERS ---
function handleRoleSelect(role) {
    userRole = role;
    render();
}

async function initializeViewForRole(role) {
    loadingOverlay.classList.add('visible');
    try {
        const position = await getCurrentLocation();
        userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch (error) {
        console.error(error.message);
        showNotification("Could not get location. Using a default.", "error");
        userLocation = { lat: 28.6139, lng: 77.2090 }; // Default to Delhi
    } finally {
        initializeMap([userLocation.lng, userLocation.lat]);
        if (role === 'farmer') setupFarmerView();
        else if (role === 'shop-owner') setupShopOwnerView();
        loadingOverlay.classList.remove('visible');
    }
}

function setupFarmerView() {
    document.getElementById('location-status').textContent = `📍 Your location is set.`;
    addSingleMarker([userLocation.lng, userLocation.lat], '#1d4ed8', 'Your Location');
    document.getElementById('produce-form').addEventListener('submit', handleFormSubmit);
}

function setupShopOwnerView() {
    addSingleMarker([userLocation.lng, userLocation.lat], '#c2410c', 'Your Shop');
    listenForPosts();
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const submitButton = document.getElementById('submit-button');
    if (!userLocation) return showNotification("Your location is required to post.", "error");

    submitButton.disabled = true;
    submitButton.textContent = "Posting...";

    const postData = {
        farmerName: "Anonymous Farmer", // Placeholder
        phone: "0123456789", // Placeholder
        productName: event.target.productName.value,
        quantity: parseInt(event.target.quantity.value),
        price: parseFloat(event.target.price.value),
        location: userLocation,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        await db.collection("produce_posts").add(postData);
        showNotification(`"${postData.productName}" posted successfully!`, "success");
        event.target.reset();
    } catch (error) {
        console.error("Error adding document: ", error);
        showNotification("Error posting produce. Please try again.", "error");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Post to Marketplace";
    }
}

// --- FIREBASE & MAPBOX FUNCTIONS ---
function listenForPosts() {
    db.collection('produce_posts').orderBy("createdAt", "desc").onSnapshot((snapshot) => {
        const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMarkers(posts);
    }, (error) => {
        console.error("Error listening to posts:", error);
    });
}

function initializeMap(center) {
    if (MAPBOX_ACCESS_TOKEN === 'YOUR_MAPBOX_ACCESS_TOKEN') {
        showNotification("Map is not configured.", 'error');
        document.getElementById('map').innerHTML = `<div style="text-align:center; padding: 2rem;">Please add a Mapbox token in main.js</div>`;
        return;
    }
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: center,
        zoom: 12
    });
    map.addControl(new mapboxgl.NavigationControl());
}

function addSingleMarker(coords, color, text) {
    if (!map) return;
    new mapboxgl.Marker({ color }).setLngLat(coords).setPopup(new mapboxgl.Popup().setText(text)).addTo(map);
}

function renderMarkers(posts) {
    if (!map) return;
    markers.forEach(marker => marker.remove());
    markers = [];

    posts.forEach(post => {
        if (!post.location?.lat) return;
        const el = document.createElement('div');
        el.className = 'produce-marker';

        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div class="popup-content">
                <h3 class="popup-title">${post.productName}</h3>
                <div class="popup-details">
                    <p><strong>Quantity:</strong> ${post.quantity} kg</p>
                    <p><strong>Price:</strong> ₹${post.price}/kg</p>
                </div>
                <button class="btn btn-secondary" style="width:100%" data-post-id="${post.id}">View Contact</button>
            </div>
        `);
        
        const newMarker = new mapboxgl.Marker(el)
            .setLngLat([post.location.lng, post.location.lat])
            .setPopup(popup)
            .addTo(map);

        // Add event listener to the "View Contact" button within the popup
        popup.on('open', () => {
            document.querySelector(`[data-post-id="${post.id}"]`).addEventListener('click', () => {
                showContactModal(post);
            });
        });
        
        markers.push(newMarker);
    });
}

// --- UTILITIES ---
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Geolocation is not supported."));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 7000,
            maximumAge: 0
        });
    });
}

function showNotification(message, type = 'success') {
    const banner = document.getElementById('notification-banner');
    const messageEl = document.getElementById('notification-message');
    messageEl.textContent = message;
    banner.style.backgroundColor = type === 'success' ? 'var(--green-primary)' : 'var(--red-error)';
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 3500);
}

function showContactModal(post) {
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <h2 class="modal-title">Contact Details</h2>
        <p class="modal-detail"><span>Farmer:</span> ${post.farmerName}</p>
        <p class="modal-detail"><span>Product:</span> ${post.productName}</p>
        <p class="modal-detail"><span>Phone:</span> <a href="tel:${post.phone}" style="color:var(--blue-primary);">${post.phone}</a></p>
    `;
    contactModal.classList.add('visible');
}

document.getElementById('modal-close-btn').onclick = () => contactModal.classList.remove('visible');
contactModal.onclick = (e) => {
    if (e.target === contactModal) contactModal.classList.remove('visible');
};

// --- START THE APP ---
document.addEventListener('DOMContentLoaded', initialize);

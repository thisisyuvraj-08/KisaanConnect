// --- Geolocation Helper ---
function getLocation() {
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(pos => {
			userLocation = {
				lat: pos.coords.latitude,
				lng: pos.coords.longitude
			};
			hideAuth();
			listenStoreRequests();
			// Ensure user's own requests and produces are loaded
			if (typeof myProduceUnsub === 'function') myProduceUnsub();
			if (typeof myRequestsUnsub === 'function') myRequestsUnsub();
		}, () => {
			alert('Location access is required for distance filtering.');
		});
	} else {
		alert('Geolocation is not supported.');
	}
}
// --- Auth System (Phone/Password & OTP) ---
const authModal = document.getElementById('authModal');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

const showRegisterBtn = document.getElementById('showRegisterBtn');
const showLoginBtn = document.getElementById('showLoginBtn');
const showLoginLink = document.getElementById('showLoginLink');
const authTitle = document.getElementById('authTitle');

let currentUser = null;
// Camera snap logic for produce form
const snapPhotoBtn = document.getElementById('snapPhotoBtn');
const cameraPreview = document.getElementById('cameraPreview');
const photoCanvas = document.getElementById('photoCanvas');
const snappedPhoto = document.getElementById('snappedPhoto');
let snappedImageData = null;

if (snapPhotoBtn) {
	let stream = null;
	snapPhotoBtn.addEventListener('click', async function() {
		if (!cameraPreview.style.display || cameraPreview.style.display === 'none') {
			// Start camera
			try {
				stream = await navigator.mediaDevices.getUserMedia({ video: true });
				cameraPreview.srcObject = stream;
				cameraPreview.style.display = 'block';
				photoCanvas.style.display = 'none';
				snappedPhoto.style.display = 'none';
				snapPhotoBtn.textContent = 'Take Photo';
				document.getElementById('produceImage').parentElement.style.display = '';
			} catch (err) {
				alert('Unable to access camera.');
			}
		} else {
			// Take photo
			photoCanvas.getContext('2d').drawImage(cameraPreview, 0, 0, photoCanvas.width, photoCanvas.height);
			snappedImageData = photoCanvas.toDataURL('image/png');
			window.snappedImageData = snappedImageData;
			snappedPhoto.src = snappedImageData;
			snappedPhoto.style.display = 'block';
			photoCanvas.style.display = 'none';
			cameraPreview.style.display = 'none';
			snapPhotoBtn.textContent = 'Snap Photo';
			// Hide upload/snap controls after photo is taken
			document.getElementById('produceImage').parentElement.style.display = 'none';
			snapPhotoBtn.style.display = 'none';
			// Stop camera
			if (stream) {
				stream.getTracks().forEach(track => track.stop());
				stream = null;
			}
		}
	});
}

function showAuth() {
	authModal.classList.remove('hidden');
	roleModal.classList.add('hidden');
}
function hideAuth() {
	authModal.classList.add('hidden');
}

function showRoleModal() {
	roleModal.classList.remove('hidden');
}

// --- Phone/Password Login ---
loginForm && loginForm.addEventListener('submit', async function(e) {
	e.preventDefault();
	const phone = document.getElementById('loginPhone').value;
	const password = document.getElementById('loginPassword').value;
	const userSnap = await db.collection('users').doc(phone).get();
	if (!userSnap.exists) {
		alert('Account does not exist. Please register.');
		return;
	}
	if (userSnap.data().password === password) {
		// Sign in with Firebase custom token for phone/password users
		// If you use email/password, use signInWithEmailAndPassword
		// If you use phone auth, use signInWithPhoneNumber
		// For this prototype, use signInWithEmailAndPassword with phone as email
		try {
			await auth.signInWithEmailAndPassword(phone + '@kisaan.com', password);
		} catch (err) {
			// If user not found in Firebase Auth, create it
			try {
				await auth.createUserWithEmailAndPassword(phone + '@kisaan.com', password);
				await auth.signInWithEmailAndPassword(phone + '@kisaan.com', password);
			} catch (e) {
				alert('Login failed. Please try again.');
				return;
			}
		}
		// The rest is handled by onAuthStateChanged
	} else {
		alert('Incorrect password.');
	}
});

// --- Phone/Password Registration ---
registerForm && registerForm.addEventListener('submit', async function(e) {
	e.preventDefault();
	const name = document.getElementById('registerName').value;
	const phone = document.getElementById('registerPhone').value;
	const password = document.getElementById('registerPassword').value;
	const userSnap = await db.collection('users').doc(phone).get();
	if (userSnap.exists) {
		alert('Phone number already registered. Please login.');
		return;
	}
	await db.collection('users').doc(phone).set({ password, name });
	try {
		await auth.createUserWithEmailAndPassword(phone + '@kisaan.com', password);
		await auth.signInWithEmailAndPassword(phone + '@kisaan.com', password);
	} catch (e) {
		alert('Registration failed. Please try again.');
		return;
	}
	// The rest is handled by onAuthStateChanged
});

// --- Remove OTP logic ---

// Show auth modal on load
window.onload = function() {
	// Profile dropdown logic and delete/sign out actions
	document.addEventListener('DOMContentLoaded', function() {
		const profileBtn = document.getElementById('profileBtn');
		const profileDropdown = document.getElementById('profileDropdown');
		const signOutBtn = document.getElementById('signOutBtn');
		const deleteAccountBtn = document.getElementById('deleteAccountBtn');
		function closeDropdown() {
			const menu = profileBtn.closest('.profile-menu');
			menu.classList.remove('open');
		}
		profileBtn.addEventListener('click', function(e) {
			e.stopPropagation();
			const menu = profileBtn.closest('.profile-menu');
			menu.classList.toggle('open');
		});
		document.addEventListener('click', function(e) {
			if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
				closeDropdown();
			}
		});
		profileDropdown.addEventListener('click', function(e) {
			e.stopPropagation();
		});
		profileBtn.addEventListener('keydown', function(e) {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				profileBtn.click();
			}
		});

		// Sign out functionality
		if (signOutBtn) {
			signOutBtn.addEventListener('click', function() {
				localStorage.clear();
				alert('Signed out.');
				window.location.reload();
			});
		}

		// Delete account functionality
		if (deleteAccountBtn) {
			deleteAccountBtn.addEventListener('click', async function() {
				if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
					if (currentUser && currentUser.phone) {
						try {
							// Delete user document
							await db.collection('users').doc(currentUser.phone).delete();
							// Delete all posts by user in farmerPosts
							const produceQuery = await db.collection('farmerPosts').where('user', '==', currentUser.phone).get();
							const batch = db.batch();
							produceQuery.forEach(doc => batch.delete(doc.ref));
							// Show auth modal on load
							window.onload = function() {
								// Profile dropdown logic and delete/sign out actions
								document.addEventListener('DOMContentLoaded', function() {
									const profileBtn = document.getElementById('profileBtn');
									const profileDropdown = document.getElementById('profileDropdown');
									const signOutBtn = document.getElementById('signOutBtn');
									const deleteAccountBtn = document.getElementById('deleteAccountBtn');
									function closeDropdown() {
										const menu = profileBtn.closest('.profile-menu');
										menu.classList.remove('open');
									}
									profileBtn.addEventListener('click', function(e) {
										e.stopPropagation();
										const menu = profileBtn.closest('.profile-menu');
										menu.classList.toggle('open');
									});
									document.addEventListener('click', function(e) {
										if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
											closeDropdown();
										}
									});
									profileDropdown.addEventListener('click', function(e) {
										e.stopPropagation();
									});
									profileBtn.addEventListener('keydown', function(e) {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											profileBtn.click();
										}
									});

									// Sign out functionality
									if (signOutBtn) {
										signOutBtn.addEventListener('click', function() {
											localStorage.clear();
											alert('Signed out.');
											window.location.reload();
										});
									}

									// Delete account functionality
									if (deleteAccountBtn) {
										deleteAccountBtn.addEventListener('click', async function() {
											if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
												if (currentUser && currentUser.phone) {
													try {
														// Delete user document
														await db.collection('users').doc(currentUser.phone).delete();
														// Delete all posts by user in farmerPosts
														const produceQuery = await db.collection('farmerPosts').where('user', '==', currentUser.phone).get();
														const batch = db.batch();
														produceQuery.forEach(doc => batch.delete(doc.ref));
														// Delete all posts by user in storeRequests
														const requestQuery = await db.collection('storeRequests').where('user', '==', currentUser.phone).get();
														requestQuery.forEach(doc => batch.delete(doc.ref));
														await batch.commit();
														localStorage.clear();
														alert('Account and all your posts deleted. You must register again to use the website.');
														window.location.reload();
													} catch (err) {
														localStorage.clear();
														alert('Account deleted locally. You must register again to use the website.');
														window.location.reload();
													}
												} else {
													localStorage.clear();
													alert('Account deleted locally. You must register again to use the website.');
													window.location.reload();
												}
											}
										});
									}

									// Farmer form: include quantity in Firestore post
									if (document.getElementById('produceForm')) {
										document.getElementById('produceForm').addEventListener('submit', function(e) {
											const quantityInput = document.getElementById('produceQuantity');
											if (quantityInput && !quantityInput.value) {
												e.preventDefault();
												alert('Please enter the quantity you are selling in kgs.');
											}
										});
									}

									// Kirana form: include quantity in Firestore post
									if (document.getElementById('requestForm')) {
										document.getElementById('requestForm').addEventListener('submit', function(e) {
											const quantityInput = document.getElementById('requestQuantity');
											if (quantityInput && !quantityInput.value) {
												e.preventDefault();
												alert('Please enter the quantity you want in kgs.');
											}
										});
									}
								});
			currentUser = { phone, name: userSnap.data().name };
			localStorage.setItem('kisaanUser', JSON.stringify(currentUser));
			let role = userSnap.data().role || localStorage.getItem('lastRole');
			currentUser.name = userSnap.data().name;
			userRole = role;
			roleModal.classList.add('hidden');
			if (role === 'farmer') {
				farmerSection.classList.remove('hidden');
				kiranaSection.classList.add('hidden');
				getLocation();
				listenStoreRequests();
				listenFarmerPosts();
			} else {
				kiranaSection.classList.remove('hidden');
				farmerSection.classList.add('hidden');
				getLocation();
				listenFarmerPosts();
				listenStoreRequests();
			}
			addSwitchRoleBtn();
		}
		hideAuth();
	});
	// Only handle Firebase Auth users (OTP/phone/email) here if needed
	// For phone/password users, persistent login is handled by localStorage + Firestore above
// --- Auth System ---
// ...existing code...
// --- Language Switch Logic (single instance) ---
// ...existing code...

function showAuth() {
	authModal.classList.remove('hidden');
	roleModal.classList.add('hidden');
}
function hideAuth() {
	authModal.classList.add('hidden');
}

function showRoleModal() {
	roleModal.classList.remove('hidden');
}

// ...existing code...

// Persistent login and auto-load listings
// Removed duplicate persistent login logic. Now handled by auth.onAuthStateChanged above.
// --- Data Storage ---
function saveData(key, value) {
	localStorage.setItem(key, JSON.stringify(value));
}
function loadData(key) {
	return JSON.parse(localStorage.getItem(key) || '[]');
}

// --- Helper: Distance Calculation ---
function getDistance(lat1, lng1, lat2, lng2) {
	const R = 6371; // km
	const dLat = (lat2-lat1)*Math.PI/180;
	const dLng = (lng2-lng1)*Math.PI/180;
	const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
	const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	return R*c;
}

// --- Farmer: Post Produce (Firestore) ---
const produceForm = document.getElementById('produceForm');
produceForm && produceForm.addEventListener('submit', function(e) {
		e.preventDefault();
		if (!currentUser) { alert('Please login first.'); return; }
		const name = document.getElementById('produceName').value;
		const price = document.getElementById('producePrice').value;
		const distance = document.getElementById('produceDistance').value;
		const imageInput = document.getElementById('produceImage');
		// Use snapped photo if available, else use uploaded photo
		if (window.snappedImageData) {
			submitProduce(window.snappedImageData);
		} else if (imageInput.files[0]) {
			const reader = new FileReader();
			reader.onload = function(evt) {
				submitProduce(evt.target.result);
			};
			reader.readAsDataURL(imageInput.files[0]);
		} else {
			alert('Please upload or snap a photo of your produce.');
			document.getElementById('produceImage').parentElement.style.display = '';
			snapPhotoBtn.style.display = '';
		}

		function submitProduce(imgData) {
			if (!userLocation || userLocation.lat === undefined || userLocation.lng === undefined) {
				alert('Location not available. Please allow location access.');
				return;
			}
			const contact = currentUser.phone;
			const quantity = document.getElementById('produceQuantity') ? document.getElementById('produceQuantity').value : '';
			const post = {
				name,
				price,
				quantity, // <-- ensure quantity is uploaded
				distance: Number(distance),
				image: imgData,
				lat: userLocation.lat,
				lng: userLocation.lng,
				contact,
				user: currentUser.phone,
				userName: currentUser.name,
				created: firebase.firestore.FieldValue.serverTimestamp()
			};
			db.collection('farmerPosts').add(post).then(() => {
				listenFarmerPosts();
				alert('Produce posted!');
				produceForm.reset();
				window.snappedImageData = null;
				document.getElementById('snappedPhoto').style.display = 'none';
				notifyNearby('New produce posted nearby!');
			});
		}
});

// --- Kirana: Post Request (Firestore) ---
const requestForm = document.getElementById('requestForm');
requestForm && requestForm.addEventListener('submit', function(e) {
	e.preventDefault();
	if (!currentUser) { alert('Please login first.'); return; }
	const name = document.getElementById('requestName').value;
	const quantity = document.getElementById('requestQuantity').value;
	const distance = document.getElementById('requestDistance').value;
	const contact = currentUser.phone;
	// Ensure userName is always defined
	const userName = currentUser.name || 'Unknown';
	if (!userLocation || userLocation.lat === undefined || userLocation.lng === undefined) {
		alert('Location not available. Please allow location access.');
		return;
	}
	const req = {
		name,
		quantity,
		distance: Number(distance),
		lat: userLocation.lat,
		lng: userLocation.lng,
		contact,
		user: currentUser.phone,
		userName,
		created: firebase.firestore.FieldValue.serverTimestamp()
	};
	db.collection('storeRequests').add(req).then(() => {
		listenStoreRequests();
		alert('Request posted!');
		requestForm.reset();
		notifyNearby('New kirana request nearby!');
	});
});

// --- Notification Simulation ---
function notifyNearby(msg) {
	if (window.Notification && Notification.permission === 'granted') {
		new Notification(msg);
	} else if (window.Notification && Notification.permission !== 'denied') {
		Notification.requestPermission().then(function (permission) {
			if (permission === 'granted') {
				new Notification(msg);
			} else {
				alert(msg);
			}
		});
	} else {
		alert(msg);
	}
}

// --- Real-time Farmer Posts for Kirana (Firestore) ---
let farmerPostsUnsub = null;
let myProduceUnsub = null;
let myRequestsUnsub = null;
let storeRequestsUnsub = null;
function listenFarmerPosts() {
    const container = document.getElementById('farmerPosts');
    const myContainer = document.getElementById('myProducePosts');
    if (!container || !currentUser) return;
    const myDist = userLocation ? Number(document.getElementById('requestDistance')?.value || 10) : null;
    // Nearby posts (only if location available)
    if (farmerPostsUnsub) farmerPostsUnsub();
    farmerPostsUnsub = db.collection('farmerPosts').orderBy('created', 'desc')
        .onSnapshot(snapshot => {
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const post = doc.data();
                if (userLocation && myDist !== null) {
                    if (getDistance(userLocation.lat, userLocation.lng, post.lat, post.lng) <= myDist && post.user !== currentUser.phone) {
                        const div = document.createElement('div');
                        div.className = 'listing';
                        div.innerHTML = `<strong>${post.name}</strong> by ${post.userName || 'Unknown'}<br>
                            <img src="${post.image}" style="max-width:100px;max-height:100px;"><br>
                            Price: ₹${post.price}<br>
							Quantity: ${post.quantity ? post.quantity : '0'} kg<br>
                            <button onclick="showContact('${post.contact}', ${post.lat}, ${post.lng})">Accept & Get Contact</button>`;
                        container.appendChild(div);
                    }
                } else {
                    // If no location, show all except own
                    if (post.user !== currentUser.phone) {
                        const div = document.createElement('div');
                        div.className = 'listing';
                        div.innerHTML = `<strong>${post.name}</strong> by ${post.userName || 'Unknown'}<br>
                            <img src="${post.image}" style="max-width:100px;max-height:100px;"><br>
                            Price: ₹${post.price}<br>
                            Quantity: ${(typeof post.quantity !== 'undefined' && post.quantity !== null && post.quantity !== '') ? post.quantity : '0'} kg<br>
                            <button onclick="showContact('${post.contact}', ${post.lat}, ${post.lng})">Accept & Get Contact</button>`;
                        container.appendChild(div);
                    }
                }
            });
        });
    // My posts (always show, even if no location)
    if (myProduceUnsub) myProduceUnsub();
    myProduceUnsub = db.collection('farmerPosts').where('user', '==', currentUser.phone).orderBy('created', 'desc')
        .onSnapshot(snapshot => {
            myContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const post = doc.data();
                const div = document.createElement('div');
                div.className = 'listing';
                div.innerHTML = `<strong>${post.name}</strong> by ${currentUser.name}<br>
                    <img src="${post.image}" style="max-width:100px;max-height:100px;"><br>
                    Price: ₹${post.price}<br>
					Quantity: ${post.quantity ? post.quantity : '0'} kg<br>
                    <button class="remove-btn" style="background:#c00;color:#fff;padding:4px 12px;border:none;border-radius:4px;font-weight:500;margin-top:6px;cursor:pointer;" data-remove-id="${doc.id}">Remove</button>`;
                myContainer.appendChild(div);
            });
            // Add event listeners for remove buttons
            myContainer.querySelectorAll('.remove-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const postId = btn.getAttribute('data-remove-id');
                    if (confirm('Are you sure you want to remove this post?')) {
                        db.collection('farmerPosts').doc(postId).delete().then(() => {
                            // Remove the post element instantly
                            btn.closest('.listing').remove();
                        });
                    }
                });
            });
        });
}

function listenStoreRequests() {
    const container = document.getElementById('storeRequests');
    const myContainer = document.getElementById('myRequests');
    if (!container || !userLocation || !currentUser) return;
    const myDist = Number(document.getElementById('produceDistance')?.value || 10);
    // Nearby requests
    if (storeRequestsUnsub) storeRequestsUnsub();
    storeRequestsUnsub = db.collection('storeRequests')
        .onSnapshot(snapshot => {
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const req = doc.data();
                if (getDistance(userLocation.lat, userLocation.lng, req.lat, req.lng) <= myDist && req.user !== currentUser.phone) {
                    const div = document.createElement('div');
                    div.className = 'listing';
                    div.innerHTML = `<strong>${req.name}</strong> by ${req.userName || 'Unknown'}<br>
						Quantity: ${req.quantity ? req.quantity : '0'} kg<br>
                        <button onclick="showContact('${req.contact}', ${req.lat}, ${req.lng})">Accept & Get Contact</button>`;
                    container.appendChild(div);
                }
            });
        });
    // My requests
    if (myRequestsUnsub) myRequestsUnsub();
    myRequestsUnsub = db.collection('storeRequests').where('user', '==', currentUser.phone)
        .onSnapshot(snapshot => {
            myContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const req = doc.data();
                const div = document.createElement('div');
                div.className = 'listing';
                div.innerHTML = `<strong>${req.name}</strong> by ${currentUser.name}<br>
					Quantity: ${req.quantity ? req.quantity : '0'} kg<br>
                    <button class="remove-btn" style="background:#c00;color:#fff;padding:4px 12px;border:none;border-radius:4px;font-weight:500;margin-top:6px;cursor:pointer;" data-remove-id="${doc.id}">Remove</button>`;
                myContainer.appendChild(div);
            });
            // Add event listeners for remove buttons
            myContainer.querySelectorAll('.remove-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const reqId = btn.getAttribute('data-remove-id');
                    if (confirm('Are you sure you want to remove this request?')) {
                        db.collection('storeRequests').doc(reqId).delete().then(() => {
                            // Remove the request element instantly
                            btn.closest('.listing').remove();
                        });
                    }
                });
            });
        });
}

// Permanent robust dropdown toggle
function setupProfileDropdown() {
    const profileBtn = document.getElementById('profileBtn');
    const profileDropdown = document.getElementById('profileDropdown');
    if (profileBtn && profileDropdown) {
        function closeDropdown() {
            profileDropdown.style.display = 'none';
            profileBtn.setAttribute('aria-expanded', 'false');
            profileBtn.parentElement.classList.remove('open');
		}
	}
        function openDropdown() {
            profileDropdown.style.display = 'flex';
            profileBtn.setAttribute('aria-expanded', 'true');
            profileBtn.parentElement.classList.add('open');
        }
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (profileDropdown.style.display === 'flex') {
                closeDropdown();
            } else {
                openDropdown();
            }
        });
        document.addEventListener('click', function(e) {
            if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
                closeDropdown();
            }
        });
        profileDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        profileBtn.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (profileDropdown.style.display === 'flex') {
                    closeDropdown();
                } else {
                    openDropdown();
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setupProfileDropdown();
	// Persistent login for phone/password users (localStorage + Firestore)
	const savedUser = localStorage.getItem('kisaanUser');
	if (savedUser) {
		try {
			currentUser = JSON.parse(savedUser);
		} catch (e) {
			localStorage.removeItem('kisaanUser');
			showAuth();
			return;
		}
		if (currentUser && typeof currentUser.phone === 'string' && currentUser.phone.length > 0) {
			db.collection('users').doc(currentUser.phone).get().then(userSnap => {
				if (!userSnap.exists) {
					localStorage.removeItem('kisaanUser');
					showAuth();
					return;
				}
				let role = userSnap.data().role || localStorage.getItem('lastRole');
				currentUser.name = userSnap.data().name;
				userRole = role;
				roleModal.classList.add('hidden');
				if (role === 'farmer') {
					farmerSection.classList.remove('hidden');
					kiranaSection.classList.add('hidden');
					getLocation();
					listenStoreRequests();
					listenFarmerPosts();
				} else {
					kiranaSection.classList.remove('hidden');
					farmerSection.classList.add('hidden');
					getLocation();
					listenFarmerPosts();
					listenStoreRequests();
				}
				addSwitchRoleBtn();
				// Always load user's own produce posts after reload
				listenFarmerPosts();
				hideAuth();
			});
			return;
		} else {
			localStorage.removeItem('kisaanUser');
			showAuth();
			return;
		}
	}
	showAuth();
	loginForm.classList.remove('hidden');
	registerForm.classList.add('hidden');
	authTitle.textContent = 'Login';
	showLoginLink.classList.add('hidden');
}

	// Only handle Firebase Auth users (OTP/phone/email) here if needed
	// For phone/password users, persistent login is handled by localStorage + Firestore above
	// ...existing code...
// --- Role Selection ---
// --- Language Switch ---
// Translation logic is now handled in index.html for full coverage and market-ready features.
const roleModal = document.getElementById('roleModal');
const farmerBtn = document.getElementById('farmerBtn');
const kiranaBtn = document.getElementById('kiranaBtn');
const farmerSection = document.getElementById('farmerSection');
const kiranaSection = document.getElementById('kiranaSection');
const switchRoleBtn = document.createElement('button');
switchRoleBtn.textContent = 'Switch Role';
switchRoleBtn.style.margin = '1rem 0';

let userRole = null;
let userLocation = null;

farmerBtn.onclick = () => setUserRole('farmer');
kiranaBtn.onclick = () => setUserRole('kirana');

function setUserRole(role) {
	userRole = role;
	roleModal.classList.add('hidden');
	if (role === 'farmer') {
		farmerSection.classList.remove('hidden');
		kiranaSection.classList.add('hidden');
	} else {
		kiranaSection.classList.remove('hidden');
		farmerSection.classList.add('hidden');
	}
	getLocation();
	// Save role to Firestore for this user
	if (currentUser) {
		db.collection('users').doc(currentUser.phone).set({ role }, { merge: true });
		localStorage.setItem('lastRole', role);
	}
	addSwitchRoleBtn();
}

function addSwitchRoleBtn() {
	if (userRole === 'farmer') {
		farmerSection.classList.remove('hidden');
		kiranaSection.classList.add('hidden');
		getLocation();
		listenStoreRequests();
		listenFarmerPosts();
	} else if (userRole === 'kirana') {
		kiranaSection.classList.remove('hidden');
		farmerSection.classList.add('hidden');
		getLocation();
		listenFarmerPosts();
		listenStoreRequests();
	}
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(pos => {
			userLocation = {
				lat: pos.coords.latitude,
				lng: pos.coords.longitude
			};
			initMap();
		}, () => {
			alert('Location access is required for distance filtering.');
		});
	} else {
		alert('Geolocation is not supported.');
	}
}

// --- Map Setup ---
let map;
function initMap() {
	// Fix: Remove old map instance if exists
	if (map) {
		map.remove();
	}
	map = L.map('map').setView([userLocation.lat, userLocation.lng], 13);
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '© OpenStreetMap contributors'
	}).addTo(map);
	L.marker([userLocation.lat, userLocation.lng]).addTo(map)
		.bindPopup('You are here').openPopup();
}
// ...existing code...

function switchLanguage(lang) {
	document.querySelectorAll('[data-i18n]').forEach(el => {
		const key = el.getAttribute('data-i18n');
		el.textContent = translations[lang][key] || key;
	});
}

if (languageDropdown) {
	languageDropdown.addEventListener('change', function() {
		switchLanguage(this.value);
	});
}

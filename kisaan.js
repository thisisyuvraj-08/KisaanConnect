// --- Firebase Config ---
const firebaseConfig = {
    apiKey: "AIzaSyDnhwxpN_6VXNY2rkfKJuA5XFmSERSOFsM",
    authDomain: "kisaan-connect-da56d.firebaseapp.com",
    projectId: "kisaan-connect-da56d",
    storageBucket: "kisaan-connect-da56d.appspot.com",
    messagingSenderId: "401721766160",
    appId: "1:401721766160:web:29644ebd5bcc3116f07595",
    measurementId: "G-9VQVCJYCWE"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// All code runs after DOMContentLoaded for safe element access!
document.addEventListener('DOMContentLoaded', function() {
    // --- UI Elements ---
    const authModal = document.getElementById('authModal');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const showLoginLink = document.getElementById('showLoginLink');
    const authError = document.getElementById('authError');
    const roleModal = document.getElementById('roleModal');
    const farmerSection = document.getElementById('farmerSection');
    const kiranaSection = document.getElementById('kiranaSection');
    const mapSection = document.getElementById('mapSection');
    const languageDropdown = document.getElementById('languageDropdown');

    // --- State ---
    let currentUser = null;
    let userRole = null;
    let userLocation = null;

    // --- Camera snap logic for produce form ---
    const snapPhotoBtn = document.getElementById('snapPhotoBtn');
    const cameraPreview = document.getElementById('cameraPreview');
    const photoCanvas = document.getElementById('photoCanvas');
    const snappedPhoto = document.getElementById('snappedPhoto');
    window.snappedImageData = null;
    if (snapPhotoBtn) {
        let stream = null;
        snapPhotoBtn.addEventListener('click', async function() {
            if (!cameraPreview.style.display || cameraPreview.style.display === 'none') {
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
                photoCanvas.getContext('2d').drawImage(cameraPreview, 0, 0, photoCanvas.width, photoCanvas.height);
                window.snappedImageData = photoCanvas.toDataURL('image/png');
                snappedPhoto.src = window.snappedImageData;
                snappedPhoto.style.display = 'block';
                photoCanvas.style.display = 'none';
                cameraPreview.style.display = 'none';
                snapPhotoBtn.textContent = 'Snap Photo';
                document.getElementById('produceImage').parentElement.style.display = 'none';
                snapPhotoBtn.style.display = 'none';
                if (stream) {
                    stream.getTracks().forEach(track => track.stop());
                    stream = null;
                }
            }
        });
    }

    // --- Auth Modal Logic ---
    function showAuth() {
        authModal.classList.remove('hidden');
        roleModal.classList.add('hidden');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        authTitle.textContent = 'Login';
        showLoginLink.classList.add('hidden');
        showRegisterBtn.style.display = '';
    }
    function hideAuth() {
        authModal.classList.add('hidden');
    }
    function showRoleModal() {
        roleModal.classList.remove('hidden');
    }

    showRegisterBtn && showRegisterBtn.addEventListener('click', function() {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        authTitle.textContent = 'Register';
        showLoginLink.classList.remove('hidden');
        showRegisterBtn.style.display = 'none';
    });
    showLoginBtn && showLoginBtn.addEventListener('click', function() {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        authTitle.textContent = 'Login';
        showLoginLink.classList.add('hidden');
        showRegisterBtn.style.display = '';
    });

    document.getElementById('showRegisterBtn').onclick = function() {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('registerForm').classList.remove('hidden');
        document.getElementById('showLoginLink').classList.remove('hidden');
    };
    document.getElementById('showLoginBtn').onclick = function() {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
        document.getElementById('showLoginLink').classList.add('hidden');
    };

    // --- Login ---
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
            currentUser = { phone, name: userSnap.data().name };
            localStorage.setItem('kisaanUser', JSON.stringify(currentUser));
            const savedLang = localStorage.getItem('kisaanLang') || 'en';
            if (languageDropdown) {
                languageDropdown.value = savedLang;
                switchLanguage(savedLang);
            }
            hideAuth();
            let role = userSnap.data().role || localStorage.getItem('lastRole');
            if (role) {
                setUserRole(role);
            } else {
                showRoleModal();
            }
            listenFarmerPosts();
        } else {
            alert('Incorrect password.');
        }
    });

    // --- Register ---
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
        currentUser = { phone, name };
        localStorage.setItem('kisaanUser', JSON.stringify(currentUser));
        const savedLang = localStorage.getItem('kisaanLang') || 'en';
        if (languageDropdown) {
            languageDropdown.value = savedLang;
            switchLanguage(savedLang);
        }
        hideAuth();
        showRoleModal();
        alert('Registration successful!');
        listenFarmerPosts();
    });

    // --- Delete Account ---
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    if (deleteAccountBtn) {
        deleteAccountBtn.onclick = function() {
            if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                if (currentUser && currentUser.phone) {
                    db.collection('users').doc(currentUser.phone).delete().then(() => {
                        localStorage.clear();
                        alert('Account deleted. You must register again to use the website.');
                        window.location.reload();
                    }).catch(() => {
                        localStorage.clear();
                        alert('Account deleted locally. You must register again to use the website.');
                        window.location.reload();
                    });
                } else {
                    localStorage.clear();
                    alert('Account deleted locally. You must register again to use the website.');
                    window.location.reload();
                }
            }
        };
    }

    // --- Geolocation Helper ---
    function getLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                userLocation = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                };
                initMap();
                rerenderAll();
                listenFarmerPosts();
                listenStoreRequests();
            }, () => {
                alert('Location access is required for distance filtering.');
            });
        } else {
            alert('Geolocation is not supported.');
        }
    }

    // --- Role Selection ---
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
        if (currentUser) {
            db.collection('users').doc(currentUser.phone).set({ role }, { merge: true });
            localStorage.setItem('lastRole', role);
        }
    }

    // --- Save/Load Data ---
    function saveData(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
    function loadData(key) {
        return JSON.parse(localStorage.getItem(key) || '[]');
    }

    // --- Helper: Distance Calculation ---
    function getDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
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
            const post = {
                name,
                price,
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
    function listenFarmerPosts() {
        const container = document.getElementById('farmerPosts');
        const myContainer = document.getElementById('myProducePosts');
        if (!container || !currentUser) return;
        const myDist = userLocation ? Number(document.getElementById('requestDistance')?.value || 10) : null;
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
                                <button onclick="showContact('${post.contact}', ${post.lat}, ${post.lng})">Accept & Get Contact</button>`;
                            container.appendChild(div);
                        }
                    } else {
                        if (post.user !== currentUser.phone) {
                            const div = document.createElement('div');
                            div.className = 'listing';
                            div.innerHTML = `<strong>${post.name}</strong> by ${post.userName || 'Unknown'}<br>
                                <img src="${post.image}" style="max-width:100px;max-height:100px;"><br>
                                Price: ₹${post.price}<br>
                                <button onclick="showContact('${post.contact}', ${post.lat}, ${post.lng})">Accept & Get Contact</button>`;
                            container.appendChild(div);
                        }
                    }
                });
            });
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
                        <button class="remove-btn" data-remove-id="${doc.id}">Remove</button>`;
                    myContainer.appendChild(div);
                });
                myContainer.querySelectorAll('.remove-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const postId = btn.getAttribute('data-remove-id');
                        if (confirm('Are you sure you want to remove this post?')) {
                            db.collection('farmerPosts').doc(postId).delete().then(() => {
                                btn.closest('.listing').remove();
                            });
                        }
                    });
                });
            });
    }

    // --- Real-time Store Requests for Farmer (Firestore) ---
    let storeRequestsUnsub = null;
    let myRequestsUnsub = null;
    function listenStoreRequests() {
        const container = document.getElementById('storeRequests');
        const myContainer = document.getElementById('myRequests');
        if (!container || !userLocation || !currentUser) return;
        const myDist = Number(document.getElementById('produceDistance')?.value || 10);
        if (storeRequestsUnsub) storeRequestsUnsub();
        storeRequestsUnsub = db.collection('storeRequests')
            .onSnapshot(snapshot => {
                container.innerHTML = '';
                snapshot.forEach(doc => {
                    const req = doc.data();
                    if (getDistance(userLocation.lat, userLocation.lng, req.lat, req.lng) <= myDist && req.user !== currentUser.phone) {
                        const div = document.createElement('div');
                        div.className = 'listing';
                        div.innerHTML = `<strong>${req.name}</strong> by ${req.userName || 'Unknown'}<br>Quantity: ${req.quantity}<br>
                        <button onclick="showContact('${req.contact}', ${req.lat}, ${req.lng})">Accept & Get Contact</button>`;
                        container.appendChild(div);
                    }
                });
            });
        if (myRequestsUnsub) myRequestsUnsub();
        myRequestsUnsub = db.collection('storeRequests').where('user', '==', currentUser.phone)
            .onSnapshot(snapshot => {
                myContainer.innerHTML = '';
                snapshot.forEach(doc => {
                    const req = doc.data();
                    const div = document.createElement('div');
                    div.className = 'listing';
                    div.innerHTML = `<strong>${req.name}</strong> by ${currentUser.name}<br>Quantity: ${req.quantity}<br>
                        <button class="remove-btn" data-remove-id="${doc.id}">Remove</button>`;
                    myContainer.appendChild(div);
                });
                myContainer.querySelectorAll('.remove-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const reqId = btn.getAttribute('data-remove-id');
                        if (confirm('Are you sure you want to remove this request?')) {
                            db.collection('storeRequests').doc(reqId).delete().then(() => {
                                btn.closest('.listing').remove();
                            });
                        }
                    });
                });
            });
    }

    // --- Show Contact Modal ---
    window.showContact = function(contact) {
        let args = arguments;
        let contactText = contact;
        let phone = contact.replace(/\D/g, '');
        if (args.length === 3 && userLocation) {
            const lat = args[1], lng = args[2];
            const dist = getDistance(userLocation.lat, userLocation.lng, lat, lng).toFixed(2);
            contactText += `\nDistance: ${dist} km`;
        }
        document.getElementById('contactInfo').textContent = contactText;
        const whatsappBtn = document.getElementById('whatsappBtn');
        if (whatsappBtn) {
            whatsappBtn.onclick = function() {
                window.open(`https://wa.me/${phone}`, '_blank');
            };
        }
        document.getElementById('contactModal').classList.remove('hidden');
    };
    document.getElementById('closeContact').onclick = function() {
        document.getElementById('contactModal').classList.add('hidden');
    };

    // --- Re-render on location or distance change ---
    function rerenderAll() {
        if (userRole === 'farmer') listenStoreRequests();
        if (userRole === 'kirana') listenFarmerPosts();
    }
    document.getElementById('produceDistance')?.addEventListener('input', rerenderAll);
    document.getElementById('requestDistance')?.addEventListener('input', rerenderAll);

    // --- Map ---
    let map;
    function initMap() {
        if (map) {
            map.remove();
        }
        map = L.map('map').setView([userLocation.lat, userLocation.lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        L.marker([userLocation.lat, userLocation.lng]).addTo(map)
            .bindPopup('You are here').openPopup();
        if (userRole === 'farmer') {
            db.collection('storeRequests').get().then(snapshot => {
                snapshot.forEach(doc => {
                    const req = doc.data();
                    const myDist = Number(document.getElementById('produceDistance')?.value || 10);
                    if (getDistance(userLocation.lat, userLocation.lng, req.lat, req.lng) <= myDist) {
                        L.marker([req.lat, req.lng]).addTo(map)
                            .bindPopup(`Kirana Request: ${req.name}<br>Quantity: ${req.quantity}<br>By: ${req.userName || req.user}`);
                    }
                });
            });
        } else if (userRole === 'kirana') {
            db.collection('farmerPosts').get().then(snapshot => {
                snapshot.forEach(doc => {
                    const post = doc.data();
                    const myDist = Number(document.getElementById('requestDistance')?.value || 10);
                    if (getDistance(userLocation.lat, userLocation.lng, post.lat, post.lng) <= myDist) {
                        L.marker([post.lat, post.lng]).addTo(map)
                            .bindPopup(`Farmer Produce: ${post.name}<br>Price: ₹${post.price}<br>By: ${post.userName || post.user}`);
                    }
                });
            });
        }
        rerenderAll();
    }

    // --- Language Switch ---
    const translations = {
        en: {},
        hi: {
            'Login': 'लॉगिन',
            'Register': 'रजिस्टर',
            'Farmer': 'किसान',
            'Kirana Store': 'किराना स्टोर',
            'Produce': 'उत्पाद',
            'Request': 'अनुरोध',
            'Accept & Get Contact': 'स्वीकारें और संपर्क प्राप्त करें',
            'You are here': 'आप यहाँ हैं',
        }
    };
    function switchLanguage(lang) {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = translations[lang][key] || key;
        });
    }
    if (languageDropdown) {
        languageDropdown.addEventListener('change', function() {
            localStorage.setItem('kisaanLang', this.value);
            switchLanguage(this.value);
        });
    }

    // --- Persistent login and auto-load listings ---
    (function initialLoad() {
        const savedLang = localStorage.getItem('kisaanLang') || 'en';
        if (languageDropdown) {
            languageDropdown.value = savedLang;
            switchLanguage(savedLang);
        }
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
                });
                return;
            } else {
                localStorage.removeItem('kisaanUser');
                showAuth();
                return;
            }
        }
        showAuth();
    })();

    // --- Auth State Listener ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            // Check if user has a role
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (!userDoc.exists) {
                // New user, show role modal
                authModal.classList.add('hidden');
                roleModal.classList.remove('hidden');
                farmerSection.classList.add('hidden');
                kiranaSection.classList.add('hidden');
                mapSection.classList.add('hidden');
            } else {
                const role = userDoc.data().role;
                authModal.classList.add('hidden');
                roleModal.classList.add('hidden');
                if (role === 'farmer') {
                    farmerSection.classList.remove('hidden');
                    kiranaSection.classList.add('hidden');
                } else if (role === 'kirana') {
                    kiranaSection.classList.remove('hidden');
                    farmerSection.classList.add('hidden');
                }
                mapSection.classList.remove('hidden');
            }
        } else {
            // Not logged in
            authModal.classList.remove('hidden');
            roleModal.classList.add('hidden');
            farmerSection.classList.add('hidden');
            kiranaSection.classList.add('hidden');
            mapSection.classList.add('hidden');
        }
    });

    // --- Login/Register Logic ---
    loginForm.onsubmit = function(e) {
        e.preventDefault();
        authError.textContent = '';
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        auth.signInWithEmailAndPassword(email, password)
            .catch(err => authError.textContent = err.message);
    };

    registerForm.onsubmit = async function(e) {
        e.preventDefault();
        authError.textContent = '';
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const phone = document.getElementById('registerPhone').value.trim();
        const password = document.getElementById('registerPassword').value;
        try {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            await db.collection('users').doc(cred.user.uid).set({
                name, email, phone, role: null
            });
            await cred.user.updateProfile({ displayName: name });
        } catch (err) {
            authError.textContent = err.message;
        }
    };

    // --- Show/Hide Register/Login ---
    showRegisterBtn.onclick = function() {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        showLoginLink.classList.remove('hidden');
    };
    showLoginBtn.onclick = function() {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        showLoginLink.classList.add('hidden');
    };

    // --- Role Selection ---
    document.getElementById('farmerBtn').onclick = async function() {
        const user = auth.currentUser;
        if (user) {
            await db.collection('users').doc(user.uid).update({ role: 'farmer' });
            roleModal.classList.add('hidden');
            farmerSection.classList.remove('hidden');
            kiranaSection.classList.add('hidden');
            mapSection.classList.remove('hidden');
        }
    };
    document.getElementById('kiranaBtn').onclick = async function() {
        const user = auth.currentUser;
        if (user) {
            await db.collection('users').doc(user.uid).update({ role: 'kirana' });
            roleModal.classList.add('hidden');
            kiranaSection.classList.remove('hidden');
            farmerSection.classList.add('hidden');
            mapSection.classList.remove('hidden');
        }
    };
});

// Firebase config (copied from index.html)
const firebaseConfig = {
    apiKey: "AIzaSyBqUMK7HiPudsEpvM9lcd77IrZOHihuKHY",
    authDomain: "kisaan-connect-4481a.firebaseapp.com",
    projectId: "kisaan-connect-4481a",
    storageBucket: "kisaan-connect-4481a.firebasestorage.app",
    messagingSenderId: "924663926760",
    appId: "1:924663926760:web:68ea2a8bd93ee7ddca9e5d"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Load all farmer posts
function loadFarmerPosts() {
    const container = document.getElementById('farmerPosts');
    db.collection('farmerPosts').orderBy('created', 'desc').onSnapshot(snapshot => {
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const post = doc.data();
            const div = document.createElement('div');
            div.className = 'listing';
            div.innerHTML = `<strong>${post.name}</strong> by ${post.userName || 'Unknown'}<br>
                Price: ₹${post.price}<br>
                Quantity: ${post.quantity || '0'} kg<br>
                <button onclick="deleteFarmerPost('${doc.id}')">Delete</button>`;
            container.appendChild(div);
        });
    });
}

// Load all kirana requests
function loadKiranaRequests() {
    const container = document.getElementById('kiranaRequests');
    db.collection('storeRequests').orderBy('created', 'desc').onSnapshot(snapshot => {
        container.innerHTML = '';
        snapshot.forEach(doc => {
            const req = doc.data();
            const div = document.createElement('div');
            div.className = 'listing';
            div.innerHTML = `<strong>${req.name}</strong> by ${req.userName || 'Unknown'}<br>
                Quantity: ${req.quantity || '0'} kg<br>
                <button onclick="deleteKiranaRequest('${doc.id}')">Delete</button>`;
            container.appendChild(div);
        });
    });
}

// Delete functions
function deleteFarmerPost(id) {
    if (confirm('Delete this farmer post?')) {
        db.collection('farmerPosts').doc(id).delete();
    }
}
function deleteKiranaRequest(id) {
    if (confirm('Delete this kirana request?')) {
        db.collection('storeRequests').doc(id).delete();
    }
}

// Initialize
window.onload = function() {
    loadFarmerPosts();
    loadKiranaRequests();
};

// Register function
document.getElementById('registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const mobile = document.getElementById('registerMobile').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const userType = document.getElementById('registerUserType').value;
    
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    // Create user with email (using mobile as username)
    auth.createUserWithEmailAndPassword(`${mobile}@agriconnect.com`, password)
        .then((userCredential) => {
            // Add user data to Firestore
            return db.collection('users').doc(userCredential.user.uid).set({
                mobile: mobile,
                userType: userType,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            alert('Registration successful!');
            bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
            // Redirect based on user type
            if (userType === 'farmer') {
                window.location.href = 'farmer-dashboard.html';
            } else {
                window.location.href = 'buyer-dashboard.html';
            }
        })
        .catch((error) => {
            alert('Error: ' + error.message);
        });
});

// Login function
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const mobile = document.getElementById('loginMobile').value;
    const password = document.getElementById('loginPassword').value;
    
    auth.signInWithEmailAndPassword(`${mobile}@agriconnect.com`, password)
        .then((userCredential) => {
            // Get user data from Firestore
            return db.collection('users').doc(userCredential.user.uid).get();
        })
        .then((doc) => {
            if (doc.exists) {
                const userData = doc.data();
                alert('Login successful!');
                bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
                // Redirect based on user type
                if (userData.userType === 'farmer') {
                    window.location.href = 'farmer-dashboard.html';
                } else {
                    window.location.href = 'buyer-dashboard.html';
                }
            }
        })
        .catch((error) => {
            alert('Error: ' + error.message);
        });
});

// Check user authentication state
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        console.log('User is signed in:', user.uid);
    } else {
        // User is signed out
        console.log('User is signed out');
    }
});

// Logout function
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch((error) => {
        alert('Error signing out: ' + error.message);
    });
}
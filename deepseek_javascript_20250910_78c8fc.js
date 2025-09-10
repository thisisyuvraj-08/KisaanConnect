// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD-3x6-ao3ZbjCNax86tpJNBHZcfpcui4Y",
  authDomain: "kisaan-44f65.firebaseapp.com",
  projectId: "kisaan-44f65",
  storageBucket: "kisaan-44f65.firebasestorage.app",
  messagingSenderId: "189931584643",
  appId: "1:189931584643:web:86c000be9c7ba20faa6fb6",
  measurementId: "G-J1WHK367VS"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Export Firebase services
window.db = db;
window.auth = auth;
window.storage = storage;
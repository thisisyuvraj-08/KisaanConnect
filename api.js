// api.js
import { firebaseConfig } from './firebase-config.js';
import { state } from './main.js';

// Firebase v11 compat API is loaded from CDN via index.html
let db = null;

/**
 * Initializes Firebase app and Firestore instance.
 * @param {FirebaseApp} app 
 */
export function initializeApi(app) {
  if (!db) {
    db = firebase.firestore();
  }
  return db;
}

/**
 * Posts a new produce item as a document in Firestore.
 * @param {Object} postData - Must include: produceType, quantity, price, location {lat, lng}, farmerName
 */
export async function postProduce(postData) {
  if (!db) throw new Error("Firestore not initialized");
  return db.collection('produce_posts').add({
    ...postData,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

/**
 * Real-time listener for produce_posts.
 * Calls renderMarkers(posts) on data update.
 */
export function listenForPosts() {
  if (!db) throw new Error("Firestore not initialized");
  db.collection('produce_posts')
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      const posts = [];
      snapshot.forEach(doc => {
        posts.push({ id: doc.id, ...doc.data() });
      });
      // Import dynamically to avoid circular import
      import('./map.js').then(module => {
        module.renderMarkers(posts);
      });
    });
}

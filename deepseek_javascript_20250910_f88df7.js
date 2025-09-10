// Notification handling functions

// Listen for new orders
function listenForOrders(userId, userType) {
    if (userType === 'farmer') {
        // Listen for orders where farmerId matches current user
        db.collection('orders')
            .where('farmerId', '==', userId)
            .where('status', '==', 'pending')
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added') {
                        const order = change.doc.data();
                        showNotification('New Order', `You have a new order for ${order.productName} from ${order.buyerName}`);
                    }
                });
            });
    } else if (userType === 'buyer') {
        // Listen for orders where buyerId matches current user
        db.collection('orders')
            .where('buyerId', '==', userId)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'modified') {
                        const order = change.doc.data();
                        const previousStatus = change.doc._previousStatus;
                        
                        if (previousStatus === 'pending' && order.status === 'accepted') {
                            showNotification('Order Accepted', `Your order for ${order.productName} has been accepted by the farmer`);
                        } else if (previousStatus === 'pending' && order.status === 'rejected') {
                            showNotification('Order Rejected', `Your order for ${order.productName} has been rejected by the farmer`);
                        } else if (previousStatus === 'accepted' && order.status === 'completed') {
                            showNotification('Order Completed', `Your order for ${order.productName} has been completed`);
                        }
                    }
                });
            });
    }
}

// Listen for new requests (for farmers)
function listenForRequests(userId) {
    // This would require geoqueries to find requests within the farmer's area
    // For now, we'll use a simple implementation
    
    db.collection('requests')
        .where('status', '==', 'active')
        .onSnapshot((snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    const request = change.doc.data();
                    showNotification('New Request', `A buyer is looking for ${request.productName} within ${request.visibilityRange} km`);
                }
            });
        });
}

// Show notification
function showNotification(title, message) {
    // Check if browser supports notifications
    if (!("Notification" in window)) {
        console.log("This browser does not support notifications");
        return;
    }
    
    // Check if notification permissions are already granted
    if (Notification.permission === "granted") {
        createNotification(title, message);
    } else if (Notification.permission !== "denied") {
        // Request permission from user
        Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
                createNotification(title, message);
            }
        });
    }
    
    // Also update the notification badge in the UI
    updateNotificationBadge();
}

// Create notification
function createNotification(title, message) {
    const notification = new Notification(title, {
        body: message,
        icon: '/path/to/icon.png' // You would add an icon for your app
    });
    
    notification.onclick = function() {
        window.focus();
        notification.close();
    };
}

// Update notification badge
function updateNotificationBadge() {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        const currentCount = parseInt(badge.textContent) || 0;
        badge.textContent = currentCount + 1;
        badge.style.display = 'flex';
    }
}

// Reset notification badge
function resetNotificationBadge() {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        badge.textContent = '0';
        badge.style.display = 'none';
    }
}

// Initialize notifications
function initNotifications(userId, userType) {
    // Request notification permission
    if ("Notification" in window) {
        Notification.requestPermission();
    }
    
    // Set up listeners based on user type
    if (userType === 'farmer') {
        listenForOrders(userId, userType);
        listenForRequests(userId);
    } else if (userType === 'buyer') {
        listenForOrders(userId, userType);
    }
}
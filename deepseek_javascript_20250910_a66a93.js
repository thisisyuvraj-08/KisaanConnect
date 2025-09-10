// Admin-specific JavaScript functionality

// Load admin dashboard data
function loadAdminDashboard() {
    // Load users count
    Promise.all([
        db.collection('users').where('userType', '==', 'farmer').get(),
        db.collection('users').where('userType', '==', 'buyer').get(),
        db.collection('products').where('status', '==', 'active').get(),
        db.collection('orders').where('status', '==', 'pending').get(),
        db.collection('orders').where('status', '==', 'completed').get()
    ])
    .then(([farmersSnapshot, buyersSnapshot, productsSnapshot, pendingOrdersSnapshot, completedOrdersSnapshot]) => {
        // Update stats
        document.querySelectorAll('.badge.bg-primary.fs-6')[0].textContent = 
            farmersSnapshot.size + buyersSnapshot.size;
        document.querySelectorAll('.badge.bg-success.fs-6')[0].textContent = 
            productsSnapshot.size;
        document.querySelectorAll('.badge.bg-warning.fs-6')[0].textContent = 
            pendingOrdersSnapshot.size;
        document.querySelectorAll('.badge.bg-info.fs-6')[0].textContent = 
            completedOrdersSnapshot.size;
    })
    .catch((error) => {
        console.error('Error loading admin dashboard data: ', error);
    });
    
    // Load recent orders
    loadRecentOrders();
    
    // Load users
    loadUsers();
}

// Load recent orders
function loadRecentOrders() {
    db.collection('orders')
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get()
        .then((querySnapshot) => {
            const ordersTable = document.querySelector('.table tbody');
            ordersTable.innerHTML = '';
            
            querySnapshot.forEach((doc) => {
                const order = doc.data();
                const row = document.createElement('tr');
                
                // Format date
                const orderDate = order.createdAt.toDate();
                const formattedDate = formatDate(orderDate);
                
                row.innerHTML = `
                    <td>#${doc.id.substring(0, 8)}</td>
                    <td>${order.productName}</td>
                    <td>${order.farmerName || 'N/A'}</td>
                    <td>${order.buyerName || 'N/A'}</td>
                    <td>${order.quantity} ${order.unit}</td>
                    <td>₹${order.total}</td>
                    <td><span class="badge bg-${getStatusColor(order.status)}">${order.status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="viewOrder('${doc.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                `;
                
                ordersTable.appendChild(row);
            });
        })
        .catch((error) => {
            console.error('Error loading orders: ', error);
        });
}

// Load users
function loadUsers() {
    // Load farmers
    db.collection('users')
        .where('userType', '==', 'farmer')
        .get()
        .then((querySnapshot) => {
            const farmersTable = document.querySelector('#farmers tbody');
            farmersTable.innerHTML = '';
            
            querySnapshot.forEach((doc) => {
                const user = doc.data();
                const row = document.createElement('tr');
                
                // Get farmer's product count
                db.collection('products')
                    .where('farmerId', '==', doc.id)
                    .get()
                    .then((productsSnapshot) => {
                        row.innerHTML = `
                            <td>${user.fullName || 'N/A'}</td>
                            <td>${user.mobile}</td>
                            <td>${productsSnapshot.size}</td>
                            <td>${formatDate(user.createdAt.toDate())}</td>
                            <td><span class="badge bg-success">Active</span></td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary me-1" onclick="viewUser('${doc.id}')">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="deactivateUser('${doc.id}')">
                                    <i class="fas fa-ban"></i>
                                </button>
                            </td>
                        `;
                    });
                
                farmersTable.appendChild(row);
            });
        })
        .catch((error) => {
            console.error('Error loading farmers: ', error);
        });
    
    // Load buyers
    db.collection('users')
        .where('userType', '==', 'buyer')
        .get()
        .then((querySnapshot) => {
            const buyersTable = document.querySelector('#buyers tbody');
            buyersTable.innerHTML = '';
            
            querySnapshot.forEach((doc) => {
                const user = doc.data();
                const row = document.createElement('tr');
                
                // Get buyer's order count
                db.collection('orders')
                    .where('buyerId', '==', doc.id)
                    .get()
                    .then((ordersSnapshot) => {
                        row.innerHTML = `
                            <td>${user.storeName || 'N/A'}</td>
                            <td>${user.fullName || 'N/A'}</td>
                            <td>${user.mobile}</td>
                            <td>${ordersSnapshot.size}</td>
                            <td>${formatDate(user.createdAt.toDate())}</td>
                            <td><span class="badge bg-success">Active</span></td>
                            <td>
                                <button class="btn btn-sm btn-outline-primary me-1" onclick="viewUser('${doc.id}')">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="deactivateUser('${doc.id}')">
                                    <i class="fas fa-ban"></i>
                                </button>
                            </td>
                        `;
                    });
                
                buyersTable.appendChild(row);
            });
        })
        .catch((error) => {
            console.error('Error loading buyers: ', error);
        });
}

// Get status color for badges
function getStatusColor(status) {
    switch(status) {
        case 'completed':
            return 'success';
        case 'pending':
            return 'warning';
        case 'in progress':
            return 'info';
        default:
            return 'secondary';
    }
}

// View order details
function viewOrder(orderId) {
    // Implementation for viewing order details
    console.log('View order: ', orderId);
}

// View user details
function viewUser(userId) {
    // Implementation for viewing user details
    console.log('View user: ', userId);
}

// Deactivate user
function deactivateUser(userId) {
    if (confirm('Are you sure you want to deactivate this user?')) {
        db.collection('users').doc(userId).update({
            status: 'inactive'
        })
        .then(() => {
            alert('User deactivated successfully');
            loadUsers();
        })
        .catch((error) => {
            alert('Error deactivating user: ' + error.message);
        });
    }
}

// Initialize admin dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadAdminDashboard();
});
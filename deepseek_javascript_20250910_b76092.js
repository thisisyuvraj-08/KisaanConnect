// Buyer-specific JavaScript functionality

// Initialize map (pseudo-code)
function initBuyerMap() {
    // This would initialize a map with the buyer's location and nearby farmers
    console.log("Buyer map would be initialized here");
}

// Create request function
document.getElementById('createRequestForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const user = auth.currentUser;
    
    if (!user) {
        alert('Please log in to create requests');
        return;
    }
    
    // Get form values
    const productName = document.querySelector('#createRequestForm input[type="text"]').value;
    const category = document.querySelector('#createRequestForm select').value;
    const quantity = document.querySelector('#createRequestForm input[type="number"]').value;
    const unit = document.querySelectorAll('#createRequestForm select')[1].value;
    const maxPrice = document.querySelectorAll('#createRequestForm input[type="number"]')[1].value;
    const description = document.querySelector('#createRequestForm textarea').value;
    const visibilityRange = document.getElementById('requestRange').value;
    
    // Add request to Firestore
    db.collection('requests').add({
        buyerId: user.uid,
        productName: productName,
        category: category,
        quantity: quantity,
        unit: unit,
        maxPrice: maxPrice,
        description: description,
        visibilityRange: visibilityRange,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'active'
    })
    .then((docRef) => {
        alert('Request created successfully!');
        document.getElementById('createRequestForm').reset();
        // Refresh requests list
        loadBuyerRequests();
    })
    .catch((error) => {
        alert('Error creating request: ' + error.message);
    });
});

// Load buyer's requests
function loadBuyerRequests() {
    const user = auth.currentUser;
    
    if (!user) return;
    
    db.collection('requests')
        .where('buyerId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .get()
        .then((querySnapshot) => {
            const requestsList = document.querySelector('.list-group');
            requestsList.innerHTML = '';
            
            querySnapshot.forEach((doc) => {
                const request = doc.data();
                const requestItem = document.createElement('div');
                requestItem.className = 'list-group-item';
                
                // Format date
                const requestDate = request.createdAt.toDate();
                const formattedDate = formatDate(requestDate);
                
                requestItem.innerHTML = `
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${request.productName} - ${request.quantity} ${request.unit}</h6>
                        <small class="text-${request.status === 'active' ? 'success' : 'secondary'}">${request.status}</small>
                    </div>
                    <p class="mb-1">Max price: ₹${request.maxPrice}/${request.unit}</p>
                    <small>Created: ${formattedDate}</small>
                `;
                
                requestsList.appendChild(requestItem);
            });
        })
        .catch((error) => {
            console.error('Error loading requests: ', error);
        });
}

// Load nearby products
function loadNearbyProducts() {
    const user = auth.currentUser;
    
    if (!user) return;
    
    // In a real implementation, we would get the user's location first
    // then query for products within their specified range
    
    // For demo purposes, we'll just get all products
    db.collection('products')
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .get()
        .then((querySnapshot) => {
            const productsGrid = document.getElementById('productsGrid');
            productsGrid.innerHTML = '';
            
            querySnapshot.forEach((doc) => {
                const product = doc.data();
                const productCard = document.createElement('div');
                productCard.className = 'col-md-6 mb-3';
                
                // In a real implementation, we would calculate distance here
                const distance = (Math.random() * 5).toFixed(1); // Random distance for demo
                
                productCard.innerHTML = `
                    <div class="card h-100">
                        <img src="https://images.unsplash.com/photo-1561136594-7f68413baa99?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=80" class="card-img-top product-image" alt="${product.productName}">
                        <div class="card-body">
                            <h5 class="card-title">${product.productName}</h5>
                            <p class="card-text">${product.description || 'Fresh produce from local farm'}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <strong>₹${product.price}/${product.unit}</strong>
                                    <div class="text-muted small">${product.quantity} ${product.unit} available</div>
                                </div>
                                <span class="badge bg-info">${distance} km away</span>
                            </div>
                        </div>
                        <div class="card-footer">
                            <button class="btn btn-primary w-100" onclick="openOrderModal('${doc.id}')">Place Order</button>
                        </div>
                    </div>
                `;
                
                productsGrid.appendChild(productCard);
            });
        })
        .catch((error) => {
            console.error('Error loading products: ', error);
        });
}

// Open order modal
function openOrderModal(productId) {
    // Get product details and populate the order modal
    db.collection('products').doc(productId).get()
        .then((doc) => {
            if (doc.exists) {
                const product = doc.data();
                // Populate modal with product details
                document.querySelector('#orderModal input[readonly]').value = product.productName;
                document.querySelectorAll('#orderModal input[readonly]')[1].value = `₹${product.price}/${product.unit}`;
                
                // Set max quantity
                const quantityInput = document.querySelector('#orderModal input[type="number"]');
                quantityInput.max = product.quantity;
                quantityInput.value = 1;
                
                // Calculate total
                updateOrderTotal(product.price);
                
                // Show modal
                const orderModal = new bootstrap.Modal(document.getElementById('orderModal'));
                orderModal.show();
            }
        })
        .catch((error) => {
            console.error('Error getting product: ', error);
        });
}

// Update order total when quantity changes
function updateOrderTotal(pricePerUnit) {
    const quantityInput = document.querySelector('#orderModal input[type="number"]');
    const totalInput = document.querySelectorAll('#orderModal input[readonly]')[2];
    
    quantityInput.addEventListener('input', () => {
        const quantity = parseInt(quantityInput.value);
        const total = quantity * pricePerUnit;
        totalInput.value = `₹${total}`;
    });
}

// Place order
document.getElementById('orderForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const user = auth.currentUser;
    
    if (!user) {
        alert('Please log in to place an order');
        return;
    }
    
    // Get form values
    const quantity = document.querySelector('#orderForm input[type="number"]').value;
    const deliveryPreference = document.querySelector('#orderForm select').value;
    const message = document.querySelector('#orderForm textarea').value;
    
    // In a real implementation, we would get the product ID and create an order
    alert('Order placed successfully!');
    
    // Hide modal
    const orderModal = bootstrap.Modal.getInstance(document.getElementById('orderModal'));
    orderModal.hide();
});

// Initialize buyer dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadBuyerRequests();
    loadNearbyProducts();
    initBuyerMap();
});
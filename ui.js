// ui.js

/**
 * Renders the main app UI based on role.
 * @param {'farmer'|'shop_owner'|null} role
 * @param {function} onRoleSelect - callback(role)
 */
export function renderApp(role, onRoleSelect) {
  const main = document.getElementById('main-content');
  main.innerHTML = "";

  if (!role) {
    // Role selection view
    main.innerHTML = `
      <section class="card" style="text-align:center;">
        <h2>Who are you?</h2>
        <button id="select-farmer">I'm a Farmer</button>
        <button id="select-shop-owner">I'm a Shop Owner</button>
      </section>
    `;
    document.getElementById('select-farmer').onclick = () => onRoleSelect('farmer');
    document.getElementById('select-shop-owner').onclick = () => onRoleSelect('shop_owner');
    return;
  }

  if (role === 'farmer') {
    main.innerHTML = `
      <section class="card">
        <h2>Post Your Surplus Produce</h2>
        <form id="produce-form" autocomplete="off">
          <label for="produceType">Produce</label>
          <input type="text" id="produceType" name="produceType" required placeholder="e.g. Tomatoes" maxlength="32">
          
          <label for="quantity">Quantity</label>
          <input type="number" id="quantity" name="quantity" required min="1" max="99999" placeholder="e.g. 100">
          
          <label for="unit">Unit</label>
          <select id="unit" name="unit" required>
            <option value="kg">kg</option>
            <option value="quintal">quintal</option>
            <option value="box">box</option>
          </select>
          
          <label for="price">Expected Price (₹)</label>
          <input type="number" id="price" name="price" required min="1" max="100000" placeholder="e.g. 200">
          
          <label for="farmerName">Your Name</label>
          <input type="text" id="farmerName" name="farmerName" placeholder="Optional">

          <button id="submit-btn" type="submit">Post Produce</button>
        </form>
      </section>
      <div class="map-container" id="map"></div>
      <div class="text-muted" style="text-align:center;font-size:0.96em;">Your location is used to show produce on map for local shop owners.</div>
    `;
  }

  if (role === 'shop_owner') {
    main.innerHTML = `
      <div class="map-container" id="map" style="height: 80vh; max-width: 98vw;"></div>
      <div class="text-muted" style="text-align:center;font-size:0.97em;padding-top:0.5em;">
        Tap on markers to view produce details from nearby farmers.
      </div>
    `;
  }
}

/**
 * Shows a dismissible notification banner (success/error).
 * @param {string} message 
 * @param {'success'|'error'} type 
 */
export function showNotification(message, type='success') {
  const el = document.getElementById('notification-banner');
  el.textContent = message;
  el.className = `notification ${type} show`;
  setTimeout(() => {
    el.classList.remove('show');
  }, 3200);
}

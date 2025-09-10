:root {
  --primary: #1e8c4e;
  --primary-dark: #145b32;
  --accent: #3993e0;
  --background: #f4faf6;
  --card: #fff;
  --text: #1b2e2c;
  --muted: #5b7d7a;
  --radius: 1.2rem;
  --shadow: 0 4px 24px rgba(30,140,78,0.10), 0 1.5px 6px rgba(0,0,0,0.08);
  --fab-size: 56px;
}

html, body {
  margin: 0;
  padding: 0;
  background: var(--background);
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
  color: var(--text);
  min-height: 100vh;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

header {
  background: linear-gradient(90deg,var(--primary),var(--primary-dark) 95%);
  color: #fff;
  box-shadow: var(--shadow);
}
.header-content {
  max-width: 1200px;
  margin: 0 auto;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2vw;
}
.logo {
  font-size: 1.25em;
  font-weight: 700;
  display: flex;
  gap: 0.7em;
  align-items: center;
  letter-spacing: 0.04em;
}
.logo-icon {
  width: 1.8em;
  height: 1.8em;
  margin-right: 0.3em;
  vertical-align: middle;
}
#role-indicator {
  font-size: 1.05em;
  color: #fff;
  opacity: 0.85;
}
main#main-content {
  flex: 1;
  padding: 1.2rem 0.5rem 1rem 0.5rem;
  max-width: 680px;
  margin: 0 auto;
  width: 100%;
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  gap: 1.7rem;
  position: relative;
}
@media (min-width: 701px) {
  main#main-content { max-width: 800px; }
}

.card {
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 1.4rem 1.1rem 1.1rem 1.1rem;
  margin-bottom: 1.1rem;
  animation: fadeInUp 0.5s;
}

@keyframes fadeInUp {
  0% { opacity: 0; transform: translateY(32px);}
  100% { opacity: 1; transform: translateY(0);}
}

.feed-list {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}
.feed-card {
  background: var(--card);
  border-radius: 1rem;
  box-shadow: 0 2px 12px rgba(30,140,78,0.07);
  display: flex;
  align-items: flex-start;
  gap: 1.1em;
  padding: 1.1em 1.1em 0.7em 1.1em;
  position: relative;
  animation: fadeInUp 0.5s;
}
.feed-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #c9f7e4;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5em;
  font-weight: bold;
  color: var(--primary-dark);
}
.feed-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.feed-meta {
  font-size: 0.97em;
  color: var(--muted);
}
.feed-actions {
  display: flex;
  gap: 1em;
  margin-top: 0.4em;
}
.feed-action-btn {
  background: #f4faf6;
  border: none;
  color: var(--primary-dark);
  border-radius: 1em;
  padding: 0.41em 1.1em;
  margin: 0.1em 0.18em 0.1em 0;
  font-size: 1.02em;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 1.5px 7px rgba(30,140,78,0.06);
  transition: background 0.21s, color 0.21s;
}
.feed-action-btn:hover {
  background: var(--primary);
  color: #fff;
}
.feed-qty {
  font-weight: 600;
  color: var(--primary-dark);
}
.feed-title {
  font-size: 1.06em;
  font-weight: 600;
  margin-bottom: 0.2em;
}
.fab {
  position: fixed;
  bottom: 2.2em;
  right: 2.2em;
  width: var(--fab-size);
  height: var(--fab-size);
  background: var(--primary);
  border-radius: 50%;
  color: #fff;
  font-size: 2.3em;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(30,140,78,0.18);
  cursor: pointer;
  z-index: 99;
  transition: background 0.25s;
  border: none;
  outline: none;
}
.fab:active { background: var(--primary-dark);}
.fab:hover { background: var(--accent);}
.mapboxgl-canvas { border-radius: 1.1rem; }

.map-container {
  width: 100%;
  height: 320px;
  border-radius: 1.1rem;
  box-shadow: var(--shadow);
  overflow: hidden;
  margin-bottom: 1.2rem;
  background: #dff4e3;
  margin-top:2rem;
}

.map-radius {
  margin: 0.9em 0 0.5em 0;
  display: flex;
  gap: 1.3em;
  align-items: center;
  font-size: 1em;
}
.map-radius label { font-weight: 500; }
.map-radius select {
  border-radius: 0.5em;
  padding: 0.2em 1.1em;
  font-size: 1em;
}

button, .button {
  background: linear-gradient(90deg,var(--primary), var(--primary-dark));
  color: #fff;
  border: none;
  border-radius: 1.2em;
  padding: 0.81rem 1.8rem;
  font-size: 1.02rem;
  font-weight: 600;
  margin: 0.18em 0.4em 0.18em 0;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(30,140,78,0.12);
  transition: background 0.21s, transform 0.19s;
  position: relative;
  outline: none;
}
button:active { background: var(--primary-dark); transform: scale(0.97);}
button[disabled] { background: var(--muted); color: #fff; cursor: not-allowed; opacity: 0.7;}
button .ripple {
  position: absolute;
  border-radius: 50%;
  transform: scale(0);
  animation: ripple-effect 0.6s linear;
  background: rgba(255,255,255,0.45);
}
@keyframes ripple-effect {
  to { transform: scale(2.7); opacity: 0;}
}

form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
label { font-weight: 500; margin-bottom: 0.18rem;}
input, select, textarea {
  border-radius: 0.66em;
  border: 1.5px solid #e0e4e0;
  padding: 0.91em 1em;
  font-size: 1.04em;
  background: #f0f8f3;
  transition: border-color 0.2s, box-shadow 0.2s;
}
input:focus, select:focus, textarea:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px var(--primary, #1e8c4e, 0.08);
}
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button { opacity: 0.5; }

#notification-banner {
  position: fixed;
  top: 1.3rem;
  right: 1.2rem;
  min-width: 200px;
  max-width: 350px;
  padding: 1.1em 1.7em;
  z-index: 1100;
  border-radius: 1.1em;
  box-shadow: 0 2px 12px rgba(30,140,78,0.12);
  font-weight: 600;
  font-size: 1.09em;
  opacity: 0;
  pointer-events: none;
  transition: opacity .34s, transform .34s;
  transform: translateY(-36px) scale(.97);
  letter-spacing: 0.01em;
  background: #e8f9ee;
  color: var(--primary);
  border: 2px solid var(--primary);
}
#notification-banner.show { opacity: 1; pointer-events: auto; transform: translateY(0) scale(1);}
#notification-banner.error { background: #fff3f1; color: #e74c3c; border: 2px solid #ffb1a8;}

.loader-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(248,250,252,0.63);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.33s;
  opacity: 1;
}
.loader-overlay.hidden { opacity: 0; pointer-events: none;}
.loader {
  border: 7px solid #e0e4e0;
  border-top: 7px solid var(--primary);
  border-radius: 50%;
  width: 54px;
  height: 54px;
  animation: spin 0.83s linear infinite;
}
@keyframes spin { 100% { transform: rotate(360deg); } }
.text-muted { color: var(--muted); font-size: 0.98em;}
.center { text-align: center;}

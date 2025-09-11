// --- Speech-to-Text with Gemini Extraction ---
function setupMicButton(micBtnId, nameId, quantityId, priceId, langSelectId) {
	const micBtn = document.getElementById(micBtnId);
	if (!micBtn) return;
	micBtn.addEventListener('click', async function() {
		// 1. Use Web Speech API for speech-to-text
		let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
		if (!SpeechRecognition) {
			alert('Speech recognition not supported in this browser.');
			return;
		}
		const recognition = new SpeechRecognition();
		recognition.lang = (document.getElementById(langSelectId)?.value || 'en');
		recognition.interimResults = false;
		recognition.maxAlternatives = 1;
		micBtn.disabled = true;
		micBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
		recognition.start();
		recognition.onresult = async function(event) {
			const transcript = event.results[0][0].transcript;
			micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
			micBtn.disabled = false;
			// 2. Send transcript to Gemini API for extraction
			const prompt = `Extract the quantity, product name, price per unit, and unit from this sentence. Return a JSON object with keys: quantity, product, price, unit. Sentence: "${transcript}". Respond only with JSON.`;
			try {
				const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						contents: [{ parts: [{ text: prompt }] }]
					})
				});
				const data = await response.json();
				let resultText = '';
				if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
					resultText = data.candidates[0].content.parts[0].text;
				} else if (data.error && data.error.message) {
					throw new Error(data.error.message);
				} else {
					alert('Could not extract information.');
					return;
				}
				// Try to parse JSON from Gemini response
				let result;
				try {
					result = JSON.parse(resultText.replace(/```json|```/g, '').trim());
				} catch (e) {
					alert('Could not parse extracted data: ' + resultText);
					return;
				}
				// Fill fields if present
				if (result.product && document.getElementById(nameId)) document.getElementById(nameId).value = result.product;
				if (result.quantity && document.getElementById(quantityId)) document.getElementById(quantityId).value = result.quantity;
				if (result.price && document.getElementById(priceId)) document.getElementById(priceId).value = result.price;
				// Optionally show unit or alert
				if (result.unit) {
					// You can display the unit somewhere if needed
				}
			} catch (err) {
				alert('Error extracting info: ' + err.message);
			}
		};
		recognition.onerror = function(event) {
			micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
			micBtn.disabled = false;
			alert('Speech recognition error: ' + event.error);
		};
		recognition.onend = function() {
			micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
			micBtn.disabled = false;
		};
	});
}

// Setup mic buttons for both forms (farmer and kirana)
document.addEventListener('DOMContentLoaded', function() {
	setupMicButton('micProduceBtn', 'produceName', 'produceQuantity', 'producePrice', 'languageDropdown');
	setupMicButton('micRequestBtn', 'requestName', 'requestQuantity', null, 'languageDropdown');
});
	// ...existing code...
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
			// Always load both own and others' requests/produces after login
			listenFarmerPosts();
			listenStoreRequests();
			// Ensure user's own requests and produces are loaded
			if (typeof myProduceUnsub === 'function') myProduceUnsub();
			if (typeof myRequestsUnsub === 'function') myRequestsUnsub();
		}, () => {
			alert('Location access is required for distance filtering.');
		});
	} else {
		alert('Geolocation is not supported.');
	}
}
// --- i18next Translation Integration ---
// Add your translation resources here
const resources = {
	en: {
		translation: {
			"Login": "Login",
			"Register": "Register",
			"Already have an account?": "Already have an account?",
			"Welcome to Kissan Connect": "Welcome to Kissan Connect",
			"Select your role:": "Select your role:",
			"Farmer": "Farmer",
			"Choose Farmer": "Choose Farmer",
			"Grocery Store": "Grocery Store",
			"Grow and sell your produce directly to local stores.": "Grow and sell your produce directly to local stores.",
			"Kirana Store": "Kirana Store",
			"Kisaan Connect": "Kisaan Connect",
			"Profile": "Profile",
			"Sign Out": "Sign Out",
			"Delete Account": "Delete Account",
			"Upload Your Produce": "Upload Your Produce",
			"Produce": "Produce",
			"My Produce Posts": "My Produce Posts",
			"Upload Image:": "Upload Image:",
			"Nearby Kirana Store Requests": "Nearby Kirana Store Requests",
			"Request Goods": "Request Goods",
			"Request": "Request",
			"My Requests": "My Requests",
			"Nearby Farmer Posts": "Nearby Farmer Posts",
			"Map": "Map",
			"Contact Details": "Contact Details",
			"WhatsApp": "WhatsApp",
			"Close": "Close",
			"Quantity (kg)": "Quantity (kg)",
			"Price per KG": "Price per KG",
			"Visible to stores within": "Visible to stores within",
			"Range (km)": "Range (km)",
			"Requested Produce": "Requested Produce",
			"Visible to farmers within": "Visible to farmers within",
			"Quantity": "Quantity",
			"Range": "Range"
			// Add more as needed
		}
	},
	hi: {
		translation: {
			"Login": "लॉगिन",
			"Register": "रजिस्टर",
			"Already have an account?": "पहले से खाता है?",
			"Welcome to Kissan Connect": "किसान कनेक्ट में आपका स्वागत है",
			"Select your role:": "अपनी भूमिका चुनें:",
			"Farmer": "किसान",
			"Choose Farmer": "किसान चुनें",
			"Grocery Store": "किराना स्टोर",
			"Grow and sell your produce directly to local stores.": "अपनी उपज सीधे स्थानीय दुकानों को बेचें।",
			"Kirana Store": "किराना स्टोर",
			"Kisaan Connect": "किसान कनेक्ट",
			"Profile": "प्रोफ़ाइल",
			"Sign Out": "साइन आउट",
			"Delete Account": "खाता हटाएं",
			"Upload Your Produce": "अपना उत्पाद अपलोड करें",
			"Produce": "उत्पाद",
			"My Produce Posts": "मेरी उत्पाद पोस्ट",
			"Upload Image:": "छवि अपलोड करें:",
			"Nearby Kirana Store Requests": "नजदीकी किराना स्टोर अनुरोध",
			"Request Goods": "माल का अनुरोध करें",
			"Request": "अनुरोध",
			"My Requests": "मेरे अनुरोध",
			"Nearby Farmer Posts": "नजदीकी किसान पोस्ट",
			"Map": "मानचित्र",
			"Contact Details": "संपर्क विवरण",
			"WhatsApp": "व्हाट्सएप",
			"Close": "बंद करें",
			"Quantity (kg)": "मात्रा (किग्रा)",
			"Price per KG": "प्रति किग्रा मूल्य",
			"Visible to stores within": "दुकानों के लिए दृश्य सीमा",
			"Range (km)": "सीमा (किमी)",
			"Requested Produce": "अनुरोधित उत्पाद",
			"Visible to farmers within": "किसानों के लिए दृश्य सीमा",
			"Quantity": "मात्रा",
			"Range": "सीमा"
			// Add more as needed
		}
	},
	pa: {
		translation: {
			"Login": "ਲੌਗਇਨ",
			"Register": "ਰਜਿਸਟਰ",
			"Already have an account?": "ਕੀ ਤੁਹਾਡਾ ਪਹਿਲਾਂ ਹੀ ਖਾਤਾ ਹੈ?",
			"Welcome to Kissan Connect": "ਕਿਸਾਨ ਕਨੈਕਟ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ",
			"Select your role:": "ਆਪਣੀ ਭੂਮਿਕਾ ਚੁਣੋ:",
			"Farmer": "ਕਿਸਾਨ",
			"Choose Farmer": "ਕਿਸਾਨ ਚੁਣੋ",
			"Grocery Store": "ਕਿਰਾਨਾ ਸਟੋਰ",
			"Grow and sell your produce directly to local stores.": "ਆਪਣੀ ਉਪਜ ਸਿੱਧਾ ਸਥਾਨਕ ਦੁਕਾਨਾਂ ਨੂੰ ਵੇਚੋ।",
			"Kirana Store": "ਕਿਰਾਨਾ ਸਟੋਰ",
			"Kisaan Connect": "ਕਿਸਾਨ ਕਨੈਕਟ",
			"Profile": "ਪ੍ਰੋਫਾਈਲ",
			"Sign Out": "ਸਾਈਨ ਆਉਟ",
			"Delete Account": "ਖਾਤਾ ਹਟਾਓ",
			"Upload Your Produce": "ਆਪਣੀ ਉਪਜ ਅੱਪਲੋਡ ਕਰੋ",
			"Produce": "ਉਪਜ",
			"My Produce Posts": "ਮੇਰੀ ਉਪਜ ਪੋਸਟਾਂ",
			"Upload Image:": "ਚਿੱਤਰ ਅੱਪਲੋਡ ਕਰੋ:",
			"Nearby Kirana Store Requests": "ਨੇੜਲੇ ਕਿਰਾਨਾ ਸਟੋਰ ਦੀਆਂ ਬੇਨਤੀਆਂ",
			"Request Goods": "ਸਮਾਨ ਦੀ ਬੇਨਤੀ ਕਰੋ",
			"Request": "ਬੇਨਤੀ",
			"My Requests": "ਮੇਰੀਆਂ ਬੇਨਤੀਆਂ",
			"Nearby Farmer Posts": "ਨੇੜਲੇ ਕਿਸਾਨ ਪੋਸਟਾਂ",
			"Map": "ਨਕਸ਼ਾ",
			"Contact Details": "ਸੰਪਰਕ ਵੇਰਵੇ",
			"WhatsApp": "ਵਟਸਐਪ",
			"Close": "ਬੰਦ ਕਰੋ",
			"Quantity (kg)": "ਮਾਤਰਾ (ਕਿਲੋਗ੍ਰਾਮ)",
			"Price per KG": "ਪ੍ਰਤੀ ਕਿਲੋਗ੍ਰਾਮ ਕੀਮਤ",
			"Visible to stores within": "ਦੁਕਾਨਾਂ ਲਈ ਦਿੱਖ ਸੀਮਾ",
			"Range (km)": "ਰੇਂਜ (ਕਿਲੋਮੀਟਰ)",
			"Requested Produce": "ਬੇਨਤੀ ਕੀਤੀ ਉਪਜ",
			"Visible to farmers within": "ਕਿਸਾਨਾਂ ਲਈ ਦਿੱਖ ਸੀਮਾ",
			"Quantity": "ਮਾਤਰਾ",
			"Range": "ਰੇਂਜ"
			// Add more as needed
		}
	}
	// Add more languages as needed
	};

// Initialize i18next

// Set initial language from dropdown or default
const langDropdown = document.getElementById('languageDropdown');
const initialLang = langDropdown ? langDropdown.value : 'en';
i18next.init({
	lng: initialLang,
	debug: false,
	resources
}, function(err, t) {
	if (err) return console.error('i18next error:', err);
	translateAllText();
});

// Listen for language changes
if (langDropdown) {
	langDropdown.addEventListener('change', function() {
		i18next.changeLanguage(this.value, function(err, t) {
			if (err) return console.error('i18next error:', err);
			translateAllText();
		});
	});
}

function translateAllText() {
	// Translate all elements with data-i18n attribute
	document.querySelectorAll('[data-i18n]').forEach(el => {
		const key = el.getAttribute('data-i18n');
		if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
			// For input/textarea, update placeholder
			el.setAttribute('placeholder', i18next.t(key));
		} else {
			// For other elements, update textContent
			el.textContent = i18next.t(key);
		}
	});
	// Translate all text nodes in the body (brute force)
	function walk(node) {
		if (node.nodeType === 3) { // Text node
			const original = node.nodeValue.trim();
			if (original && i18next.exists(original)) {
				node.nodeValue = i18next.t(original);
			}
		} else {
			node.childNodes.forEach(walk);
		}
	}
	walk(document.body);
}
// --- Auth System (Phone/Password & OTP) ---
const authModal = document.getElementById('authModal');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

const showRegisterBtn = document.getElementById('showRegisterBtn');
const showLoginBtn = document.getElementById('showLoginBtn');
const showLoginLink = document.getElementById('showLoginLink');
const authTitle = document.getElementById('authTitle');

let currentUser = null;
// Camera snap logic for produce form
const snapPhotoBtn = document.getElementById('snapPhotoBtn');
const cameraPreview = document.getElementById('cameraPreview');
const photoCanvas = document.getElementById('photoCanvas');
const snappedPhoto = document.getElementById('snappedPhoto');
let snappedImageData = null;

if (snapPhotoBtn) {
	let stream = null;
	snapPhotoBtn.addEventListener('click', async function() {
		if (!cameraPreview.style.display || cameraPreview.style.display === 'none') {
			// Start camera
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
			// Take photo
			photoCanvas.getContext('2d').drawImage(cameraPreview, 0, 0, photoCanvas.width, photoCanvas.height);
			snappedImageData = photoCanvas.toDataURL('image/png');
			window.snappedImageData = snappedImageData;
			snappedPhoto.src = snappedImageData;
			snappedPhoto.style.display = 'block';
			photoCanvas.style.display = 'none';
			cameraPreview.style.display = 'none';
			snapPhotoBtn.textContent = 'Snap Photo';
			// Hide upload/snap controls after photo is taken
			document.getElementById('produceImage').parentElement.style.display = 'none';
			snapPhotoBtn.style.display = 'none';
			// Stop camera
			if (stream) {
				stream.getTracks().forEach(track => track.stop());
				stream = null;
			}
		}
	});
}

function showAuth() {
	authModal.classList.remove('hidden');
	roleModal.classList.add('hidden');
}
function hideAuth() {
	authModal.classList.add('hidden');
}

function showRoleModal() {
	roleModal.classList.remove('hidden');
}

// --- Phone/Password Login ---
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
		// Restore language preference after login
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
		// Always load user's own produce posts after login
		listenFarmerPosts();
	} else {
		alert('Incorrect password.');
	}
});

// --- Phone/Password Registration ---
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
	// Restore language preference after register
	const savedLang = localStorage.getItem('kisaanLang') || 'en';
	if (languageDropdown) {
		languageDropdown.value = savedLang;
		switchLanguage(savedLang);
	}
	hideAuth();
	showRoleModal();
	alert('Registration successful!');
	// Always load user's own produce posts after registration
	listenFarmerPosts();
});

// --- Remove OTP logic ---

// Show auth modal on load
window.onload = function() {
	// Profile dropdown logic and delete/sign out actions
	document.addEventListener('DOMContentLoaded', function() {
		const profileBtn = document.getElementById('profileBtn');
		const profileDropdown = document.getElementById('profileDropdown');
		const signOutBtn = document.getElementById('signOutBtn');
		const deleteAccountBtn = document.getElementById('deleteAccountBtn');

		// Ultimate robust dropdown toggle
		if (profileBtn && profileDropdown) {
			function closeDropdown() {
				const menu = profileBtn.closest('.profile-menu');
				menu.classList.remove('open');
			}
			profileBtn.addEventListener('click', function(e) {
				e.stopPropagation();
				const menu = profileBtn.closest('.profile-menu');
				menu.classList.toggle('open');
			});
			document.addEventListener('click', function(e) {
				if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
					closeDropdown();
				}
			});
			profileDropdown.addEventListener('click', function(e) {
				e.stopPropagation();
			});
			profileBtn.addEventListener('keydown', function(e) {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					profileBtn.click();
				}
			});
		}

		// Sign out functionality
		if (signOutBtn) {
			signOutBtn.addEventListener('click', function() {
				localStorage.clear();
				alert('Signed out.');
				window.location.reload();
			});
		}

		// Delete account functionality
		if (deleteAccountBtn) {
			deleteAccountBtn.addEventListener('click', async function() {
				if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
					if (currentUser && currentUser.phone) {
						try {
							// Delete user document
							await db.collection('users').doc(currentUser.phone).delete();
							// Delete all posts by user in farmerPosts
							const produceQuery = await db.collection('farmerPosts').where('user', '==', currentUser.phone).get();
							const batch = db.batch();
							produceQuery.forEach(doc => batch.delete(doc.ref));
							// Delete all posts by user in storeRequests
							const requestQuery = await db.collection('storeRequests').where('user', '==', currentUser.phone).get();
							requestQuery.forEach(doc => batch.delete(doc.ref));
							await batch.commit();
							localStorage.clear();
							alert('Account and all your posts deleted. You must register again to use the website.');
							window.location.reload();
						} catch (err) {
							localStorage.clear();
							alert('Account deleted locally. You must register again to use the website.');
							window.location.reload();
						}
					} else {
						localStorage.clear();
						alert('Account deleted locally. You must register again to use the website.');
						window.location.reload();
					}
				}
			});
		}

		// Farmer form: include quantity in Firestore post
		const produceForm = document.getElementById('produceForm');
		if (produceForm) {
			produceForm.addEventListener('submit', function(e) {
				const quantityInput = document.getElementById('produceQuantity');
				if (quantityInput && !quantityInput.value) {
					e.preventDefault();
					alert('Please enter the quantity you are selling in kgs.');
				}
			});
		}

		// Kirana form: include quantity in Firestore post
		const requestForm = document.getElementById('requestForm');
		if (requestForm) {
			requestForm.addEventListener('submit', function(e) {
				const quantityInput = document.getElementById('requestQuantity');
				if (quantityInput && !quantityInput.value) {
					e.preventDefault();
					alert('Please enter the quantity you want in kgs.');
				}
			});
		}
	});
	// Restore language preference and set up dropdown
	const savedLang = localStorage.getItem('kisaanLang') || 'en';
	if (languageDropdown) {
		languageDropdown.value = savedLang;
		switchLanguage(savedLang);
		languageDropdown.onchange = function() {
			localStorage.setItem('kisaanLang', this.value);
			switchLanguage(this.value);
		};
	}

	// Persistent login
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
				addSwitchRoleBtn();
				// Always load user's own produce posts after reload
				listenFarmerPosts();
			});
			return;
		} else {
			localStorage.removeItem('kisaanUser');
			showAuth();
			return;
		}
	}
	showAuth();
	loginForm.classList.remove('hidden');
	registerForm.classList.add('hidden');
	authTitle.textContent = 'Login';
	showLoginLink.classList.add('hidden');
};

// UI switching logic
showRegisterBtn && showRegisterBtn.addEventListener('click', function() {
	loginForm.classList.add('hidden');
	registerForm.classList.remove('hidden');
	authTitle.textContent = 'Register';
	showLoginLink.classList.remove('hidden');
	showRegisterBtn.style.display = 'none'; // Hide register button when register form is open
});
	localStorage.setItem('kisaanUser', JSON.stringify(currentUser));
showLoginBtn && showLoginBtn.addEventListener('click', function() {
	loginForm.classList.remove('hidden');
	registerForm.classList.add('hidden');
	authTitle.textContent = 'Login';
	showLoginLink.classList.add('hidden');
	showRegisterBtn.style.display = ''; // Show register button when register form is closed
});

// Also allow clicking the 'Already have an account?' text to switch to login
showLoginLink && showLoginLink.addEventListener('click', function(e) {
	// If the user clicks anywhere on the 'Already have an account?' paragraph, switch to login
	loginForm.classList.remove('hidden');
	registerForm.classList.add('hidden');
	authTitle.textContent = 'Login';
	showLoginLink.classList.add('hidden');
	showRegisterBtn.style.display = '';
});
// --- Firebase Setup ---
const db = firebase.firestore();
const auth = firebase.auth();
// --- Auth System ---
// ...existing code...
// Ensure all try blocks have catch
// (No stray or incomplete try blocks found in this file)
// --- Gemini API Suggestion Logic ---
const GEMINI_API_KEY = 'AIzaSyBh_L9D8D-CcAnFm53gd2WFP3L5PMEv0l8'; // Replace with your actual Gemini API key
const getSuggestionBtn = document.getElementById('getSuggestionBtn');
if (getSuggestionBtn) {
	getSuggestionBtn.addEventListener('click', async function() {
		const product = document.getElementById('produceName')?.value;
		const location = userLocation;
		if (!product || !location) {
			alert('Please enter the product name and allow location access.');
			return;
		}
		getSuggestionBtn.textContent = 'Loading...';
		getSuggestionBtn.disabled = true;
		try {
			// Updated prompt and endpoint for Gemini API v1
			const prompt = `Suggest a fair price per kilo unit (kg/lit/etc) for ${product} in ${location.lat},${location.lng} using latest data from official Indian Gov. website  and local market prices. Return only the number.`;
			const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }]
				})
			});
			const data = await response.json();
			let suggestion = '';
			if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
				suggestion = data.candidates[0].content.parts[0].text;
			} else if (data.error && data.error.message) {
				throw new Error(data.error.message);
			} else {
				suggestion = 'No suggestion available.';
			}
			// Try to extract a valid number
			const match = suggestion.match(/\d+(\.\d+)?/);
			if (match) {
				document.getElementById('producePrice').value = match[0];
				alert('Suggested price: ' + match[0]);
			} else {
				alert('Suggestion: ' + suggestion);
			}
		} catch (err) {
			alert('Error fetching suggestion: ' + err.message);
		}
		getSuggestionBtn.textContent = 'Get Suggestion';
		getSuggestionBtn.disabled = false;
	});
}
// --- Language Switch Logic (single instance) ---
// ...existing code...

function showAuth() {
	authModal.classList.remove('hidden');
	roleModal.classList.add('hidden');
}
function hideAuth() {
	authModal.classList.add('hidden');
}

function showRoleModal() {
	roleModal.classList.remove('hidden');
}

// ...existing code...

// Persistent login and auto-load listings
window.onload = function() {
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
				addSwitchRoleBtn();
			});
			return;
		} else {
			// corrupted or incomplete user data, clear and show login
			localStorage.removeItem('kisaanUser');
			showAuth();
			return;
		}
	}
	showAuth();
	loginForm.classList.remove('hidden');
	registerForm.classList.add('hidden');
	authTitle.textContent = 'Login';
	showLoginLink.classList.add('hidden');
};
// --- Data Storage ---
function saveData(key, value) {
	localStorage.setItem(key, JSON.stringify(value));
}
function loadData(key) {
	return JSON.parse(localStorage.getItem(key) || '[]');
}

// --- Helper: Distance Calculation ---
function getDistance(lat1, lng1, lat2, lng2) {
	const R = 6371; // km
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
		// Use snapped photo if available, else use uploaded photo
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
			const quantity = document.getElementById('produceQuantity') ? document.getElementById('produceQuantity').value : '';
			const post = {
				name,
				price,
				quantity, // <-- ensure quantity is uploaded
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
	// Ensure userName is always defined
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
let myRequestsUnsub = null;
let storeRequestsUnsub = null;
function listenFarmerPosts() {
    const container = document.getElementById('farmerPosts');
    const myContainer = document.getElementById('myProducePosts');
    if (!container || !currentUser) return;
    const myDist = userLocation ? Number(document.getElementById('requestDistance')?.value || 10) : null;
    // Nearby posts (only if location available)
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
							Quantity: ${post.quantity ? post.quantity : '0'} kg<br>
                            <button onclick="showContact('${post.contact}', ${post.lat}, ${post.lng})">Accept & Get Contact</button>`;
                        container.appendChild(div);
                    }
                } else {
                    // If no location, show all except own
                    if (post.user !== currentUser.phone) {
                        const div = document.createElement('div');
                        div.className = 'listing';
                        div.innerHTML = `<strong>${post.name}</strong> by ${post.userName || 'Unknown'}<br>
                            <img src="${post.image}" style="max-width:100px;max-height:100px;"><br>
                            Price: ₹${post.price}<br>
                            Quantity: ${(typeof post.quantity !== 'undefined' && post.quantity !== null && post.quantity !== '') ? post.quantity : '0'} kg<br>
                            <button onclick="showContact('${post.contact}', ${post.lat}, ${post.lng})">Accept & Get Contact</button>`;
                        container.appendChild(div);
                    }
                }
            });
        });
    // My posts (always show, even if no location)
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
					Quantity: ${post.quantity ? post.quantity : '0'} kg<br>
                    <button class="remove-btn" style="background:#c00;color:#fff;padding:4px 12px;border:none;border-radius:4px;font-weight:500;margin-top:6px;cursor:pointer;" data-remove-id="${doc.id}">Remove</button>`;
                myContainer.appendChild(div);
            });
            // Add event listeners for remove buttons
            myContainer.querySelectorAll('.remove-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const postId = btn.getAttribute('data-remove-id');
                    if (confirm('Are you sure you want to remove this post?')) {
                        db.collection('farmerPosts').doc(postId).delete().then(() => {
                            // Remove the post element instantly
                            btn.closest('.listing').remove();
                        });
                    }
                });
            });
        });
}

function listenStoreRequests() {
    const container = document.getElementById('storeRequests');
    const myContainer = document.getElementById('myRequests');
    if (!container || !userLocation || !currentUser) return;
    const myDist = Number(document.getElementById('produceDistance')?.value || 10);
    // Nearby requests
    if (storeRequestsUnsub) storeRequestsUnsub();
    storeRequestsUnsub = db.collection('storeRequests')
        .onSnapshot(snapshot => {
            container.innerHTML = '';
            snapshot.forEach(doc => {
                const req = doc.data();
                if (getDistance(userLocation.lat, userLocation.lng, req.lat, req.lng) <= myDist && req.user !== currentUser.phone) {
                    const div = document.createElement('div');
                    div.className = 'listing';
                    div.innerHTML = `<strong>${req.name}</strong> by ${req.userName || 'Unknown'}<br>
						Quantity: ${req.quantity ? req.quantity : '0'} kg<br>
                        <button onclick="showContact('${req.contact}', ${req.lat}, ${req.lng})">Accept & Get Contact</button>`;
                    container.appendChild(div);
                }
            });
        });
    // My requests
    if (myRequestsUnsub) myRequestsUnsub();
    myRequestsUnsub = db.collection('storeRequests').where('user', '==', currentUser.phone)
        .onSnapshot(snapshot => {
            myContainer.innerHTML = '';
            snapshot.forEach(doc => {
                const req = doc.data();
                const div = document.createElement('div');
                div.className = 'listing';
                div.innerHTML = `<strong>${req.name}</strong> by ${currentUser.name}<br>
					Quantity: ${req.quantity ? req.quantity : '0'} kg<br>
                    <button class="remove-btn" style="background:#c00;color:#fff;padding:4px 12px;border:none;border-radius:4px;font-weight:500;margin-top:6px;cursor:pointer;" data-remove-id="${doc.id}">Remove</button>`;
                myContainer.appendChild(div);
            });
            // Add event listeners for remove buttons
            myContainer.querySelectorAll('.remove-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const reqId = btn.getAttribute('data-remove-id');
                    if (confirm('Are you sure you want to remove this request?')) {
                        db.collection('storeRequests').doc(reqId).delete().then(() => {
                            // Remove the request element instantly
                            btn.closest('.listing').remove();
                        });
                    }
                });
            });
        });
}

// Permanent robust dropdown toggle
function setupProfileDropdown() {
    const profileBtn = document.getElementById('profileBtn');
    const profileDropdown = document.getElementById('profileDropdown');
    if (profileBtn && profileDropdown) {
        function closeDropdown() {
            profileDropdown.style.display = 'none';
            profileBtn.setAttribute('aria-expanded', 'false');
            profileBtn.parentElement.classList.remove('open');
        }
        function openDropdown() {
            profileDropdown.style.display = 'flex';
            profileBtn.setAttribute('aria-expanded', 'true');
            profileBtn.parentElement.classList.add('open');
        }
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (profileDropdown.style.display === 'flex') {
                closeDropdown();
            } else {
                openDropdown();
            }
        });
        document.addEventListener('click', function(e) {
            if (!profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
                closeDropdown();
            }
        });
        profileDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        profileBtn.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (profileDropdown.style.display === 'flex') {
                    closeDropdown();
                } else {
                    openDropdown();
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', function() {
    setupProfileDropdown();
    // ...existing code...
});

// --- Show Contact Modal ---
window.showContact = function(contact) {
	// Accepts contact, lat, lng
	let args = arguments;
	let contactText = contact;
	let phone = contact.replace(/\D/g, '');
	if (args.length === 3 && userLocation) {
		const lat = args[1], lng = args[2];
		const dist = getDistance(userLocation.lat, userLocation.lng, lat, lng).toFixed(2);
		contactText += `\nDistance: ${dist} km`;
	}
	document.getElementById('contactInfo').textContent = contactText;
	// Set WhatsApp button link
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

// --- Account Deletion Option ---
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
					// If Firestore delete fails, still clear localStorage and reload
					localStorage.clear();
					alert('Account deleted locally. You must register again to use the website.');
					window.location.reload();
				});
			} else {
				// If user is not loaded, just clear localStorage and reload
				localStorage.clear();
				alert('Account deleted locally. You must register again to use the website.');
				window.location.reload();
			}
		}
	};
}

// --- Re-render on location or distance change ---
function rerenderAll() {
	if (userRole === 'farmer') listenStoreRequests();
	if (userRole === 'kirana') listenFarmerPosts();
}

document.getElementById('produceDistance')?.addEventListener('input', rerenderAll);
document.getElementById('requestDistance')?.addEventListener('input', rerenderAll);

// --- DOM references and global state ---
const roleModal = document.getElementById('roleModal');
const farmerBtn = document.getElementById('farmerBtn');
const kiranaBtn = document.getElementById('kiranaBtn');
const farmerSection = document.getElementById('farmerSection');
const kiranaSection = document.getElementById('kiranaSection');
let userRole = null;
let userLocation = null;
let map;

// --- After map init, render listings ---
function initMap() {
	if (!userLocation || !userLocation.lat || !userLocation.lng) return;
	// Remove old map instance if exists
	if (window._leafletMap) {
		window._leafletMap.remove();
		window._leafletMap = null;
	}
	map = L.map('map').setView([userLocation.lat, userLocation.lng], 13);
	window._leafletMap = map;
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '© OpenStreetMap contributors'
	}).addTo(map);
	// Show current user location
	L.marker([userLocation.lat, userLocation.lng]).addTo(map)
		.bindPopup('You are here').openPopup();

	// Show opposite party markers with hover popups and only pending items
	// Also populate sidebar list and link to markers
	const requestList = document.getElementById('requestList');
	let markers = [];
	let items = [];
	// Helper to clear old markers
	function clearMarkers() {
		markers.forEach(m => map.removeLayer(m));
		markers = [];
		if (requestList) requestList.innerHTML = '';
		items = [];
	}
	// Show a message if no requests are found
	function showNoRequestsMsg() {
		if (requestList) {
			requestList.innerHTML = '<li style="color:#888;padding:10px 0;text-align:center;">No requests found.</li>';
		}
	}
	if (userRole === 'farmer') {
		db.collection('storeRequests').onSnapshot(snapshot => {
			clearMarkers();
			let found = false;
			snapshot.forEach(doc => {
				const req = doc.data();
				if (!req.lat || !req.lng) return;
				found = true;
				const marker = L.marker([req.lat, req.lng], {
					icon: L.icon({iconUrl: 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png', iconSize: [32,32]})
				}).addTo(map);
				marker.bindPopup(
					`<b>🛒 Kirana Request</b><br>` +
					`<b>Product:</b> ${req.name}<br>` +
					`<b>Quantity:</b> ${req.quantity} kg<br>` +
					`<b>By:</b> ${req.userName || req.user}<br>` +
					`<b>Contact:</b> ${req.contact}`
				);
				marker.on('mouseover', function(e) { marker.openPopup(); });
				marker.on('mouseout', function(e) { marker.closePopup(); });
				markers.push(marker);
				// Add to sidebar list
				if (requestList) {
					const li = document.createElement('li');
					li.style.padding = '10px 8px';
					li.style.borderBottom = '1px solid #e5e7eb';
					li.style.cursor = 'pointer';
					li.style.borderRadius = '6px';
					li.style.marginBottom = '2px';
					li.onmouseover = () => li.style.background = '#e0e7ff';
					li.onmouseout = () => li.style.background = '';
					li.innerHTML = `<b>${req.name}</b> <span style='color:#888;font-size:0.95em;'>(${req.quantity} kg)</span><br><span style='font-size:0.93em;color:#2563eb;'>${req.userName || req.user}</span>`;
					li.addEventListener('click', function() {
						map.setView([req.lat, req.lng], 15, {animate:true});
						marker.openPopup();
					});
					requestList.appendChild(li);
					items.push(li);
				}
			});
			if (!found) showNoRequestsMsg();
		});
	} else if (userRole === 'kirana') {
		db.collection('farmerPosts').onSnapshot(snapshot => {
			clearMarkers();
			let found = false;
			snapshot.forEach(doc => {
				const post = doc.data();
				if (!post.lat || !post.lng) return;
				found = true;
				const marker = L.marker([post.lat, post.lng], {
					icon: L.icon({iconUrl: 'https://cdn-icons-png.flaticon.com/512/2909/2909763.png', iconSize: [32,32]})
				}).addTo(map);
				marker.bindPopup(
					`<b>🌾 Farmer Produce</b><br>` +
					`<b>Product:</b> ${post.name}<br>` +
					`<b>Price:</b> ₹${post.price} per kg<br>` +
					`<b>Quantity:</b> ${post.quantity} kg<br>` +
					`<b>By:</b> ${post.userName || post.user}<br>` +
					`<b>Contact:</b> ${post.contact}`
				);
				marker.on('mouseover', function(e) { marker.openPopup(); });
				marker.on('mouseout', function(e) { marker.closePopup(); });
				markers.push(marker);
				// Add to sidebar list
				if (requestList) {
					const li = document.createElement('li');
					li.style.padding = '10px 8px';
					li.style.borderBottom = '1px solid #e5e7eb';
					li.style.cursor = 'pointer';
					li.style.borderRadius = '6px';
					li.style.marginBottom = '2px';
					li.onmouseover = () => li.style.background = '#e0e7ff';
					li.onmouseout = () => li.style.background = '';
					li.innerHTML = `<b>${post.name}</b> <span style='color:#888;font-size:0.95em;'>(${post.quantity} kg)</span><br><span style='font-size:0.93em;color:#2563eb;'>${post.userName || post.user}</span>`;
					li.addEventListener('click', function() {
						map.setView([post.lat, post.lng], 15, {animate:true});
						marker.openPopup();
					});
					requestList.appendChild(li);
					items.push(li);
				}
			});
			if (!found) showNoRequestsMsg();
		});
	}
}

// Always re-initialize map after login, role switch, or page load
document.addEventListener('DOMContentLoaded', function() {
	// Attach role switch handlers
	if (farmerBtn) farmerBtn.onclick = () => { setUserRole('farmer'); if (userLocation && userLocation.lat && userLocation.lng) initMap(); };
	if (kiranaBtn) kiranaBtn.onclick = () => { setUserRole('kirana'); if (userLocation && userLocation.lat && userLocation.lng) initMap(); };
	// Try to initialize map if location is available
	if (userLocation && userLocation.lat && userLocation.lng) initMap();
});

// --- Role Selection ---
// --- Language Switch ---
// Translation logic is now handled in index.html for full coverage and market-ready features.
const switchRoleBtn = document.createElement('button');
switchRoleBtn.textContent = 'Switch Role';
switchRoleBtn.style.margin = '1rem 0';

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
	// Save role to Firestore for this user
	if (currentUser) {
		db.collection('users').doc(currentUser.phone).set({ role }, { merge: true });
		localStorage.setItem('lastRole', role);
	}
	addSwitchRoleBtn();
}

function addSwitchRoleBtn() {
	if (userRole === 'farmer') {
		farmerSection.classList.remove('hidden');
		kiranaSection.classList.add('hidden');
		getLocation();
		listenStoreRequests();
		listenFarmerPosts();
	} else if (userRole === 'kirana') {
		kiranaSection.classList.remove('hidden');
		farmerSection.classList.add('hidden');
		getLocation();
		listenFarmerPosts();
		listenStoreRequests();
	}
	if (navigator.geolocation) {
		navigator.geolocation.getCurrentPosition(pos => {
			userLocation = {
				lat: pos.coords.latitude,
				lng: pos.coords.longitude
			};
			initMap();
		}, () => {
			alert('Location access is required for distance filtering.');
		});
	} else {
		alert('Geolocation is not supported.');
	}
}

// --- Map Setup ---
// (initMap is already defined above, do not redeclare map or initMap)
// ...existing code...

function switchLanguage(lang) {
	document.querySelectorAll('[data-i18n]').forEach(el => {
		const key = el.getAttribute('data-i18n');
		el.textContent = translations[lang][key] || key;
	});
}

if (languageDropdown) {
	languageDropdown.addEventListener('change', function() {
		switchLanguage(this.value);
	});
}

const APPS_SCRIPT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzgtiMZlXHvBUxPF8ADyl0z4X2ZY2TCOzEQQPKRquCDd9wH-BvMpXj8T_zrtomN8qAI/exec";

const firebaseConfig = {
  apiKey: "AIzaSyDkTqTxMxoqYjh5g43d1R_a1RQ4J1XztlY",
  authDomain: "photocup.firebaseapp.com",
  projectId: "photocup",
  storageBucket: "photocup.firebasestorage.app",
  messagingSenderId: "414488698018",
  appId: "1:414488698018:web:a82a1f764f9753dc3a8bfb"
};

// Initialisation Firebase
let auth = null;
try {
  if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
  }
  auth = firebase.auth();
} catch (e) {
  console.error("Erreur initialisation Firebase:", e);
}

let currentUser = null;
let photosData = [];
let userChoices = { first: null, second: null, third: null };

const authSection = document.getElementById('auth-section');
const votingSection = document.getElementById('voting-section');
const userInfo = document.getElementById('user-info');
const userEmailSpan = document.getElementById('user-email');
const authError = document.getElementById('auth-error');
const voteMessage = document.getElementById('vote-message');
const submitVoteBtn = document.getElementById('submit-vote-btn');

if (auth) {
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      userEmailSpan.textContent = user.email;
      userInfo.style.display = 'flex';
      authSection.style.display = 'none';
      votingSection.style.display = 'block';
      loadPhotos();
    } else {
      currentUser = null;
      userInfo.style.display = 'none';
      authSection.style.display = 'block';
      votingSection.style.display = 'none';
    }
  });
}

document.getElementById('login-form').addEventListener('submit', e => {
  e.preventDefault();
  authError.style.display = 'none';
  const email = document.getElementById('email').value.trim();
  const pass = document.getElementById('password').value;
  
  if (!auth) {
    showError("Erreur d'initialisation de Firebase. Vérifiez la console.");
    return;
  }

  auth.signInWithEmailAndPassword(email, pass).catch(err => {
    formatFirebaseError(err);
  });
});

document.getElementById('signup-btn').addEventListener('click', () => {
  authError.style.display = 'none';
  const email = document.getElementById('email').value.trim();
  const pass = document.getElementById('password').value;

  if (!email || !pass) {
    showError("Veuillez remplir les champs email et mot de passe.");
    return;
  }

  auth.createUserWithEmailAndPassword(email, pass).then(() => {
    alert("Compte créé avec succès ! Vous êtes maintenant connecté.");
  }).catch(err => {
    formatFirebaseError(err);
  });
});

document.getElementById('logout-btn').addEventListener('click', () => {
  if (auth) auth.signOut();
});

function formatFirebaseError(err) {
  console.error("Firebase Auth Error:", err);
  if (err.code === 'auth/api-key-not-valid' || err.message.includes('api-key-not-valid')) {
    showError("Clef API Firebase non valide ou domaine non autorisé. Activez le fournisseur Email/Mot de passe dans Firebase Console > Authentication.");
  } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
    showError("Email ou mot de passe incorrect.");
  } else if (err.code === 'auth/email-already-in-use') {
    showError("Cette adresse email est déjà enregistrée. Veuillez vous connecter.");
  } else if (err.code === 'auth/weak-password') {
    showError("Le mot de passe doit contenir au moins 6 caractères.");
  } else {
    showError(err.message || "Erreur d'authentification.");
  }
}

function showError(msg) {
  authError.textContent = msg;
  authError.style.display = 'block';
}

async function loadPhotos() {
  try {
    const res = await fetch('photos.json');
    photosData = await res.json();
    renderPhotosGrid();
  } catch (err) {
    console.error("Erreur chargement photos.json", err);
  }
}

function renderPhotosGrid() {
  const grid = document.getElementById('photos-grid');
  grid.innerHTML = '';

  photosData.forEach((photo, index) => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `
      <img src="${photo.imageUrl}" alt="${photo.title}" class="photo-img">
      <div class="photo-body">
        <div>
          <span class="photo-badge">Photo #${index + 1}</span>
          <div class="photo-title">${photo.title}</div>
        </div>
        <div class="vote-actions">
          <button class="btn-choice ${userChoices.first === photo.id ? 'active' : ''}" onclick="selectChoice('first', '${photo.id}')">1er (3pt)</button>
          <button class="btn-choice ${userChoices.second === photo.id ? 'active' : ''}" onclick="selectChoice('second', '${photo.id}')">2e (2pt)</button>
          <button class="btn-choice ${userChoices.third === photo.id ? 'active' : ''}" onclick="selectChoice('third', '${photo.id}')">3e (1pt)</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  updatePodiumUI();
}

window.selectChoice = function(rank, photoId) {
  if (userChoices.first === photoId) userChoices.first = null;
  if (userChoices.second === photoId) userChoices.second = null;
  if (userChoices.third === photoId) userChoices.third = null;

  userChoices[rank] = photoId;
  renderPhotosGrid();
};

function updatePodiumUI() {
  const getTitle = id => {
    const p = photosData.find(item => item.id === id);
    return p ? p.title : 'Aucune sélectionnée';
  };

  document.getElementById('select-1-title').textContent = getTitle(userChoices.first);
  document.getElementById('select-2-title').textContent = getTitle(userChoices.second);
  document.getElementById('select-3-title').textContent = getTitle(userChoices.third);

  const isValid = userChoices.first && userChoices.second && userChoices.third &&
                  userChoices.first !== userChoices.second &&
                  userChoices.first !== userChoices.third &&
                  userChoices.second !== userChoices.third;

  submitVoteBtn.disabled = !isValid;
}

submitVoteBtn.addEventListener('click', async () => {
  if (!currentUser) return;

  submitVoteBtn.disabled = true;
  submitVoteBtn.textContent = "Transmission du vote...";

  const payload = {
    action: "submitVote",
    voterEmail: currentUser.email,
    voterId: currentUser.uid,
    firstChoice: userChoices.first,
    secondChoice: userChoices.second,
    thirdChoice: userChoices.third
  };

  try {
    const res = await fetch(APPS_SCRIPT_WEBHOOK_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    voteMessage.style.display = 'block';
    if (result.status === "success") {
      voteMessage.className = 'alert alert-success';
      voteMessage.textContent = result.message;
      document.querySelector('.voting-header').style.display = 'none';
      document.getElementById('photos-grid').style.display = 'none';
    } else {
      voteMessage.className = 'alert alert-error';
      voteMessage.textContent = result.message;
      submitVoteBtn.disabled = false;
      submitVoteBtn.textContent = "Confirmer et Envoyer mon Vote";
    }
  } catch (err) {
    voteMessage.style.display = 'block';
    voteMessage.className = 'alert alert-error';
    voteMessage.textContent = "Erreur de connexion au serveur de vote.";
    submitVoteBtn.disabled = false;
    submitVoteBtn.textContent = "Confirmer et Envoyer mon Vote";
  }
});

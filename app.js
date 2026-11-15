const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyNQlTnCSNjvIyGeLICrToQ1m0C8ozhHgR4CczT9ainHCq2AwPgS9oeP5rdgofQ1Cg4/exec";

let currentUser = null;
let photosData = [];
let contestStatus = { status: "OPEN", isOpen: true };
let existingVotes = [];
let userChoices = { first: null, second: null, third: null };

async function loadPhotosAndStatus() {
    try {
        const resPhotos = await fetch('photos.json');
        photosData = await resPhotos.json();

        const resStatus = await fetch(`${APPS_SCRIPT_URL}?action=getAll`);
        const data = await resStatus.json();
        if (data.contestStatus) contestStatus = data.contestStatus;
        if (data.status) contestStatus.status = data.status;
        if (data.isOpen !== undefined) {
            contestStatus.isOpen = data.isOpen;
            if (!contestStatus.status) contestStatus.status = data.isOpen ? "OPEN" : "CLOSED";
        }
        if (data.votes) existingVotes = data.votes;

        renderApp();
    } catch (err) {
        console.error("Erreur de chargement:", err);
        renderApp();
    }
}

async function handleLoginOrRegister() {
    const email = document.getElementById("inputEmail").value.trim();
    const password = document.getElementById("inputPassword").value.trim();
    const firstName = document.getElementById("inputFirstName").value.trim();
    const errorDiv = document.getElementById("auth-error");
    if (errorDiv) errorDiv.style.display = 'none';

    if (!email || !password) {
        if (errorDiv) {
            errorDiv.textContent = "Veuillez remplir l'email et le mot de passe.";
            errorDiv.style.display = 'block';
        } else {
            alert("Veuillez remplir l'email et le mot de passe.");
        }
        return;
    }

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: "register", email, password, firstName })
        });
        const res = await response.json();
        currentUser = { email, firstName: res.firstName || firstName || email.split('@')[0] };
    } catch (e) {
        currentUser = { email, firstName: firstName || email.split('@')[0] };
    }

    document.getElementById("headerUserEmail").innerText = `${currentUser.firstName} (${currentUser.email})`;
    document.getElementById("userHeaderBadge").style.display = 'flex';
    document.getElementById("authSection").style.display = 'none';
    document.getElementById("contestSection").style.display = 'block';

    loadPhotosAndStatus();
    setInterval(loadPhotosAndStatus, 15000);
}

function renderApp() {
    if (!currentUser) return;

    const statusState = contestStatus.status || (contestStatus.isOpen ? "OPEN" : "CLOSED");
    const hasVoted = existingVotes.some(v => v.voterEmail === currentUser.email || v.voterId === currentUser.email);

    const notStartedMsg = document.getElementById("notStartedMessage");
    const closedMsg = document.getElementById("closedContestMessage");
    const votedMsg = document.getElementById("votedConfirmationMessage");
    const activeArea = document.getElementById("votingActiveArea");

    if (notStartedMsg) notStartedMsg.style.display = 'none';
    if (closedMsg) closedMsg.style.display = 'none';
    if (votedMsg) votedMsg.style.display = 'none';
    if (activeArea) activeArea.style.display = 'none';

    if (statusState === "NOT_STARTED") {
        if (notStartedMsg) notStartedMsg.style.display = 'block';
        return;
    }

    if (statusState === "CLOSED" || statusState === "RESULTS") {
        if (closedMsg) closedMsg.style.display = 'block';

        const scores = {};
        existingVotes.forEach(v => {
            if (v.firstChoicePhotoId) { scores[v.firstChoicePhotoId] = (scores[v.firstChoicePhotoId] || 0) + 3; }
            if (v.secondChoicePhotoId) { scores[v.secondChoicePhotoId] = (scores[v.secondChoicePhotoId] || 0) + 2; }
            if (v.thirdChoicePhotoId) { scores[v.thirdChoicePhotoId] = (scores[v.thirdChoicePhotoId] || 0) + 1; }
        });

        const ranked = [...photosData].map(p => ({
            ...p,
            totalPoints: scores[p.id] || 0
        })).sort((a, b) => b.totalPoints - a.totalPoints);

        const podiumContainer = document.getElementById("podiumContainer");
        if (podiumContainer) {
            podiumContainer.innerHTML = "";
            const top3 = ranked.slice(0, 3);
            const badges = [
                { rank: "1er", color: "var(--gold)", icon: "fa-trophy", label: "🥇 Vainqueur" },
                { rank: "2e", color: "var(--silver)", icon: "fa-medal", label: "🥈 2ème Place" },
                { rank: "3e", color: "var(--bronze)", icon: "fa-award", label: "🥉 3ème Place" }
            ];

            top3.forEach((photo, idx) => {
                const b = badges[idx];
                const card = document.createElement("div");
                card.className = "photo-card";
                card.style.borderColor = b.color;
                card.innerHTML = `
                    <img src="${photo.imageUrl}" alt="${photo.title}" class="photo-img" onclick="openPhotoModal('${photo.imageUrl}')" style="cursor: pointer;">
                    <div class="photo-body" style="text-align: center;">
                        <div>
                            <span class="photo-badge" style="background: ${b.color}; color: #0b0f17; font-weight: bold; font-size: 0.9rem; padding: 0.3rem 0.7rem;"><i class="fa-solid ${b.icon}"></i> ${b.label}</span>
                            <div class="photo-title" style="margin-top: 0.75rem;">${photo.title}</div>
                            <div style="font-size: 0.9rem; color: var(--text-main); font-weight: 600; margin-bottom: 0.5rem;">Par ${photo.author}</div>
                        </div>
                        <div style="font-size: 1.2rem; font-weight: bold; color: ${b.color}; margin-top: 0.5rem;">
                            ${photo.totalPoints} Points
                        </div>
                    </div>
                `;
                podiumContainer.appendChild(card);
            });
        }
        return;
    }

    // OPEN state
    if (hasVoted) {
        if (votedMsg) votedMsg.style.display = 'block';
        return;
    }

    if (activeArea) activeArea.style.display = 'block';
    const grid = document.getElementById("photosContainer");
    if (!grid) return;
    grid.innerHTML = "";

    // Vote anonyme : pas de nom d'auteur affiché pendant le vote
    photosData.forEach((photo, index) => {
        const card = document.createElement("div");
        card.className = "photo-card";
        card.innerHTML = `
            <img src="${photo.imageUrl}" alt="${photo.title}" class="photo-img" onclick="openPhotoModal('${photo.imageUrl}')" style="cursor: pointer;" title="Cliquez pour agrandir">
            <div class="photo-body">
                <div>
                    <span class="photo-badge">Photo #${index + 1}</span>
                    <div class="photo-title">${photo.title}</div>
                </div>
                <div class="vote-actions" style="margin-top: 1rem;">
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
    renderApp();
};

function updatePodiumUI() {
    const getTitle = id => {
        const p = photosData.find(item => item.id === id);
        return p ? p.title : 'Aucune sélectionnée';
    };

    const s1 = document.getElementById('select-1-title');
    const s2 = document.getElementById('select-2-title');
    const s3 = document.getElementById('select-3-title');
    if (s1) s1.textContent = getTitle(userChoices.first);
    if (s2) s2.textContent = getTitle(userChoices.second);
    if (s3) s3.textContent = getTitle(userChoices.third);

    const isValid = userChoices.first && userChoices.second && userChoices.third &&
                    userChoices.first !== userChoices.second &&
                    userChoices.first !== userChoices.third &&
                    userChoices.second !== userChoices.third;

    const submitBtn = document.getElementById('submitVoteBtn');
    if (submitBtn) submitBtn.disabled = !isValid;
}

// Lightbox functions
function openPhotoModal(url) {
    const modal = document.getElementById("photoModal");
    const img = document.getElementById("modalImg");
    if (modal && img) {
        img.src = url;
        modal.style.display = 'flex';
    }
}

function closePhotoModal() {
    const modal = document.getElementById("photoModal");
    if (modal) modal.style.display = 'none';
}

async function submitVotes() {
    if (!currentUser) return;
    const btn = document.getElementById('submitVoteBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Transmission du vote...";
    }

    const payload = {
        action: "submitVote",
        voterEmail: currentUser.email,
        voterId: currentUser.email,
        firstChoice: userChoices.first,
        secondChoice: userChoices.second,
        thirdChoice: userChoices.third
    };

    try {
        const res = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        if (result.status === "success" || result.success) {
            document.getElementById("votedConfirmationMessage").style.display = 'block';
            document.getElementById("votingActiveArea").style.display = 'none';
            loadPhotosAndStatus();
        } else {
            alert(result.message || "Erreur lors de l'enregistrement du vote.");
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Confirmer et Envoyer mon Vote";
            }
        }
    } catch (err) {
        console.error("Erreur:", err);
        alert("Erreur de connexion au serveur de vote.");
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Confirmer et Envoyer mon Vote";
        }
    }
}

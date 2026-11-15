const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyqFxRp_1_51CGNmJC5mrYan7BXkx_W1QBs0SWgZxB0ys_XMF7dSaKmwXW-QOMNWxoR/exec";
let currentUser = null;
let contestData = null;
let selectedVotes = { first: null, second: null, third: null };

async function loadData() {
    try {
        const response = await fetch(`${APPS_SCRIPT_URL}?action=getAll`);
        contestData = await response.json();
        renderApp();
    } catch (err) {
        console.error("Erreur de chargement:", err);
        contestData = {
            isOpen: true,
            photos: [
                { id: "photo_1", title: "Photo 1", author: "Auteur 1", imageUrl: "photos/photo1.png" },
                { id: "photo_2", title: "Photo 2", author: "Auteur 2", imageUrl: "photos/photo2.png" }
            ],
            votes: []
        };
        renderApp();
    }
}

async function handleLoginOrRegister() {
    const email = document.getElementById("inputEmail").value.trim();
    const password = document.getElementById("inputPassword").value.trim();
    const firstName = document.getElementById("inputFirstName").value.trim();
    if (!email || !password) { alert("Veuillez remplir l'email et le mot de passe."); return; }

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
    document.getElementById("userHeaderBadge").classList.remove("hidden");
    document.getElementById("authSection").classList.add("hidden");
    document.getElementById("contestSection").classList.remove("hidden");

    loadData();
    setInterval(loadData, 10000);
}

function renderApp() {
    if (!contestData) return;
    const isOpen = contestData.contestStatus ? contestData.contestStatus.isOpen : contestData.isOpen;
    let photos = contestData.photos || [];
    if (photos.length === 0) {
        photos = [
            { id: "photo_1", title: "Photo 1", author: "Auteur 1", imageUrl: "photos/photo1.png" },
            { id: "photo_2", title: "Photo 2", author: "Auteur 2", imageUrl: "photos/photo2.png" }
        ];
    }
    const votes = contestData.votes || [];
    const hasVoted = votes.some(v => v.voterEmail === currentUser?.email || v.voterId === currentUser?.email);

    if (isOpen === false) {
        document.getElementById("closedContestMessage").classList.remove("hidden");
        document.getElementById("votingActiveArea").classList.add("hidden");
        const sorted = [...photos].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
        const winner = sorted[0];
        if (winner) {
            document.getElementById("winnerAnnouncement").innerHTML = `Le grand gagnant est <strong>${winner.title}</strong> par ${winner.author} avec ${winner.totalPoints || 0} points !`;
        }
        return;
    }

    if (hasVoted) {
        document.getElementById("votedConfirmationMessage").classList.remove("hidden");
        document.getElementById("votingActiveArea").classList.add("hidden");
        return;
    }

    const container = document.getElementById("photosContainer");
    container.innerHTML = "";
    photos.forEach(photo => {
        const card = document.createElement("div");
        card.className = "photo-card";
        if (selectedVotes.first === photo.id || selectedVotes.second === photo.id || selectedVotes.third === photo.id) {
            card.classList.add("selected");
        }
        let badge = "";
        if (selectedVotes.first === photo.id) badge = '<div class="badge-rank">1er choix (3 pts)</div>';
        else if (selectedVotes.second === photo.id) badge = '<div class="badge-rank">2ème choix (2 pts)</div>';
        else if (selectedVotes.third === photo.id) badge = '<div class="badge-rank">3ème choix (1 pt)</div>';

        card.innerHTML = `
            <img src="${photo.imageUrl}" alt="${photo.title}" onerror="this.src='photos/photo1.png'">
            <div class="photo-info">
                <div class="photo-title">${photo.title}</div>
                <div class="photo-author">Par ${photo.author}</div>
                ${badge}
            </div>
        `;
        card.onclick = () => selectPhotoChoice(photo.id);
        container.appendChild(card);
    });

    if (selectedVotes.first && selectedVotes.second && selectedVotes.third) {
        document.getElementById("submitVoteBtn").classList.remove("hidden");
    } else {
        document.getElementById("submitVoteBtn").classList.add("hidden");
    }
}

function selectPhotoChoice(id) {
    if (selectedVotes.first === id) { selectedVotes.first = selectedVotes.second; selectedVotes.second = selectedVotes.third; selectedVotes.third = null; }
    else if (selectedVotes.second === id) { selectedVotes.second = selectedVotes.third; selectedVotes.third = null; }
    else if (selectedVotes.third === id) { selectedVotes.third = null; }
    else {
        if (!selectedVotes.first) selectedVotes.first = id;
        else if (!selectedVotes.second) selectedVotes.second = id;
        else if (!selectedVotes.third) selectedVotes.third = id;
        else { selectedVotes.first = selectedVotes.second; selectedVotes.second = selectedVotes.third; selectedVotes.third = id; }
    }
    renderApp();
}

async function submitVotes() {
    if (!selectedVotes.first || !selectedVotes.second || !selectedVotes.third) { alert("Sélectionnez 3 choix."); return; }
    try {
        const res = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({
                action: "submitVote",
                voterId: currentUser.email,
                voterEmail: currentUser.email,
                firstChoice: selectedVotes.first,
                secondChoice: selectedVotes.second,
                thirdChoice: selectedVotes.third
            })
        });
        const result = await res.json();
        if (result.status === "success" || result.success) {
            alert("Vote enregistré avec succès !");
            loadData();
        } else {
            alert(result.message || "Erreur.");
        }
    } catch (e) { alert("Erreur de connexion."); }
}

// SaviOrientation — interface du chat
// La clé API n'est JAMAIS dans ce fichier : le navigateur parle au backend Python (app.py),
// et c'est le backend qui interroge Claude (Anthropic) avec la clé stockée en variable d'environnement.

// URL du backend. Sur le site statique (GitHub Pages), on appelle le backend hébergé à part.
// En local, le site tourne sur localhost:8000 et l'API sur localhost:5000.
const BACKEND_URL = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://localhost:5000"
  : "https://saviorientation.onrender.com"; // ← à remplacer par l'URL réelle du backend Render
const API_URL = BACKEND_URL + "/api/chat";

// Le backend gratuit de Render s'endort après 15 min d'inactivité : on le réveille dès l'ouverture
// de la page, pour qu'il soit prêt quand l'élève envoie son premier message.
fetch(BACKEND_URL + "/health", { mode: "no-cors" }).catch(() => {});

const SPECS = ["Maths", "Physique-Chimie", "SVT", "NSI", "SES", "HLP", "HGGSP", "LLCE", "AMC"];

let userName = "";
let userSpecs = [];
let history = [];

const $ = id => document.getElementById(id);

// ---------- Onboarding ----------
const grid = $("spec-grid");
SPECS.forEach(s => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "spec-chip";
  b.textContent = s;
  b.setAttribute("aria-pressed", "false");
  b.addEventListener("click", () => toggleSpec(b, s));
  grid.appendChild(b);
});

function toggleSpec(btn, s) {
  if (userSpecs.includes(s)) {
    userSpecs = userSpecs.filter(x => x !== s);
    btn.setAttribute("aria-pressed", "false");
  } else if (userSpecs.length < 3) {
    userSpecs.push(s);
    btn.setAttribute("aria-pressed", "true");
  }
  const n = userSpecs.length;
  grid.querySelectorAll(".spec-chip").forEach(c => {
    c.disabled = n === 3 && c.getAttribute("aria-pressed") === "false";
  });
  $("spec-hint").textContent =
    n === 3 ? "✓ Parfait !" :
    n === 0 ? "Sélectionne exactement 3 spécialités" :
    `Encore ${3 - n} spécialité${3 - n > 1 ? "s" : ""}`;
  checkReady();
}

function checkReady() {
  $("btn-start").disabled = !($("prenom-input").value.trim() && userSpecs.length === 3);
}
$("prenom-input").addEventListener("input", checkReady);

$("ob-form").addEventListener("submit", e => {
  e.preventDefault();
  if ($("btn-start").disabled) return;
  userName = $("prenom-input").value.trim();
  $("onboarding").style.display = "none";
  $("chat-screen").style.display = "flex";

  const profile = $("profile");
  profile.innerHTML = "";
  userSpecs.forEach(s => {
    const span = document.createElement("span");
    span.textContent = s;
    profile.appendChild(span);
  });
  profile.style.display = "flex";

  const greeting =
    `Salut ${userName} ! 👋 Je vois que tu suis ${userSpecs[0]}, ${userSpecs[1]} et ${userSpecs[2]}.\n\n` +
    `Avant de te donner des pistes, j'aimerais mieux te connaître. ` +
    `Qu'est-ce qui t'attire le plus dans tes études en ce moment, en cours ou en dehors ?`;
  history.push({ role: "assistant", content: greeting });
  addMessage("bot", greeting);
  $("user-input").focus();
});

// ---------- Messages ----------
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Mise en forme légère : **gras**, paragraphes et retours à la ligne
function format(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .split(/\n{2,}/)
    .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function addMessage(role, text, extraClass = "") {
  const row = document.createElement("div");
  row.className = `row ${role}`;

  const av = document.createElement("div");
  av.className = `avatar ${role}`;
  if (role === "bot") av.innerHTML = '<img src="assets/boussole.webp" alt="">';
  else av.textContent = userName.charAt(0).toUpperCase();

  const bubble = document.createElement("div");
  bubble.className = `bubble ${role} ${extraClass}`;
  if (text === null) bubble.innerHTML = '<div class="dots"><span></span><span></span><span></span></div>';
  else bubble.innerHTML = format(text);

  row.append(av, bubble);
  $("messages").appendChild(row);
  $("messages").scrollTop = $("messages").scrollHeight;
  return row;
}

async function sendMessage() {
  const input = $("user-input");
  const text = input.value.trim();
  if (!text || $("send-btn").disabled) return;

  input.value = "";
  input.style.height = "auto";
  $("send-btn").disabled = true;

  const userRow = addMessage("user", text);
  history.push({ role: "user", content: text });
  const typing = addMessage("bot", null);

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: userName, specs: userSpecs, messages: history }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.reply) throw new Error(data.error || `HTTP ${res.status}`);

    history.push({ role: "assistant", content: data.reply });
    typing.remove();
    addMessage("bot", data.reply);
  } catch (err) {
    console.error(err);
    history.pop(); // le message n'a pas été traité : on le retire de l'historique
    typing.remove();
    userRow.remove();
    addMessage("bot", "Oups, je n'arrive pas à répondre pour le moment. Réessaie dans un instant 🙏", "error");
    input.value = text;
  }

  $("send-btn").disabled = false;
  input.focus();
}

$("chat-form").addEventListener("submit", e => { e.preventDefault(); sendMessage(); });

$("user-input").addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    sendMessage();
  }
});

$("user-input").addEventListener("input", function () {
  this.style.height = "auto";
  this.style.height = Math.min(this.scrollHeight, 140) + "px";
});

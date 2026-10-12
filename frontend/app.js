const playersElement = document.querySelector("#players");
const updatedElement = document.querySelector("#updated");
const form = document.querySelector("#points-form");
const formMessage = document.querySelector("#form-message");
const submitButton = form.querySelector("button[type='submit']");

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

async function readResponse(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[char]);
}

function renderUsers(users) {
  if (users.length === 0) {
    playersElement.innerHTML = '<li class="empty-state"><div><div class="empty-icon">✦</div><strong>No scores yet</strong><br />Add points to a player to start the leaderboard.</div></li>';
    return;
  }

  playersElement.innerHTML = users.map((user) => {
    const name = escapeHtml(user.userId);
    const initial = escapeHtml(user.userId.trim().charAt(0) || "?");
    const score = Number(user.score).toLocaleString();
    return `<li class="player-row"><span class="rank ${user.rank <= 3 ? "top" : ""}">#${user.rank}</span><span class="player"><span class="avatar">${initial}</span><span class="player-name">${name}</span></span><span class="score">${score}</span></li>`;
  }).join("");
}

async function refreshLeaderboard() {
  try {
    const response = await fetch("/leaderboard", { headers: { Accept: "application/json" } });
    const data = await readResponse(response);
    renderUsers(data.users || []);
    updatedElement.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  } catch (error) {
    updatedElement.textContent = error.message === "Failed to fetch"
      ? "Can't reach the server. Make sure it is running."
      : error.message;
    playersElement.innerHTML = '<li class="empty-state"><div><div class="empty-icon">↻</div><strong>Leaderboard unavailable</strong><br />Check the server connection and try again.</div></li>';
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const userId = form.elements.userId.value.trim();
  const points = Number(form.elements.points.value);
  setMessage(formMessage, "");

  if (!userId || !Number.isSafeInteger(points) || points <= 0) {
    formMessage.textContent = "Enter a player name and a positive whole number of points.";
    formMessage.classList.add("error");
    return;
  }

  submitButton.disabled = true;
  submitButton.querySelector("span").textContent = "Adding…";
  try {
    const response = await fetch(`/users/${encodeURIComponent(userId)}/points`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ points }),
    });
    const data = await readResponse(response);
    setMessage(formMessage, `${userId} now has ${Number(data.score).toLocaleString()} points.`);
    await refreshLeaderboard();
  } catch (error) {
    setMessage(formMessage, error.message === "Failed to fetch" ? "Can't reach the server. Try again." : error.message, true);
  } finally {
    submitButton.disabled = false;
    submitButton.querySelector("span").textContent = "Add points";
  }
});

const viewsForm = document.querySelector("#views-form");
const viewsMessage = document.querySelector("#views-message");
viewsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const postId = viewsForm.elements.postId.value.trim();
  const button = viewsForm.querySelector("button[type='submit']");
  button.disabled = true;
  button.querySelector("span").textContent = "Recording…";
  try {
    const response = await fetch(`/posts/${encodeURIComponent(postId)}/views`, { method: "POST", headers: { Accept: "application/json" } });
    const data = await readResponse(response);
    setMessage(viewsMessage, `${postId} now has ${Number(data.views).toLocaleString()} views.`);
  } catch (error) {
    setMessage(viewsMessage, error.message === "Failed to fetch" ? "Can't reach the server. Try again." : error.message, true);
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "Record view";
  }
});

const rankForm = document.querySelector("#rank-form");
const rankMessage = document.querySelector("#rank-message");
rankForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const userId = rankForm.elements.userId.value.trim();
  const button = rankForm.querySelector("button[type='submit']");
  button.disabled = true;
  button.querySelector("span").textContent = "Looking up…";
  try {
    const response = await fetch(`/leaderboard/${encodeURIComponent(userId)}/rank`, { headers: { Accept: "application/json" } });
    const data = await readResponse(response);
    setMessage(rankMessage, `${userId} is #${data.rank} with ${Number(data.score).toLocaleString()} points.`);
  } catch (error) {
    setMessage(rankMessage, error.message === "Failed to fetch" ? "Can't reach the server. Try again." : error.message, true);
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "Check rank";
  }
});

document.querySelector("#refresh").addEventListener("click", refreshLeaderboard);
refreshLeaderboard();
setInterval(refreshLeaderboard, 5000);

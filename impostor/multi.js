const SUPABASE_URL = "https://keklkfvtbdejwqtmjzzo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_PHOgHUCIXq8B89-tk2edVg_5enIgQaq";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (id) => document.getElementById(id);

const screens = {
  setup: $("setupScreen"),
  lobby: $("lobbyScreen"),
  reveal: $("revealScreen"),
  waiting: $("waitingScreen"),
  discussion: $("discussionScreen"),
  voting: $("votingScreen"),
  voteWaiting: $("voteWaitingScreen"),
  result: $("resultScreen"),
  final: $("finalScreen")
};

const playerNameInput = $("playerName");
const roomCodeInput = $("roomCodeInput");
const createRoomBtn = $("createRoomBtn");
const joinRoomBtn = $("joinRoomBtn");
const setupMessage = $("setupMessage");
const connectionBadge = $("connectionBadge");
const connectionText = $("connectionText");

const roomCodeDisplay = $("roomCodeDisplay");
const copyCodeBtn = $("copyCodeBtn");
const playerCount = $("playerCount");
const playersList = $("playersList");
const hostBadge = $("hostBadge");
const hostControls = $("hostControls");
const categorySelect = $("categorySelect");
const minusImpostorBtn = $("minusImpostorBtn");
const plusImpostorBtn = $("plusImpostorBtn");
const impostorCountDisplay = $("impostorCountDisplay");
const impostorHelp = $("impostorHelp");
const startGameBtn = $("startGameBtn");
const leaveRoomBtn = $("leaveRoomBtn");
const lobbyMessage = $("lobbyMessage");
const lobbyScoreboard = $("lobbyScoreboard");
const refreshScoreBtn = $("refreshScoreBtn");

const roleCard = $("roleCard");
const roleName = $("roleName");
const roleCategory = $("roleCategory");
const secretLabel = $("secretLabel");
const secretValue = $("secretValue");
const roleDescription = $("roleDescription");
const seenBtn = $("seenBtn");
const revealMessage = $("revealMessage");
const seenProgress = $("seenProgress");

const discussionRoomCode = $("discussionRoomCode");
const startVotingBtn = $("startVotingBtn");
const discussionHint = $("discussionHint");
const discussionMessage = $("discussionMessage");

const voteOptions = $("voteOptions");
const submitVoteBtn = $("submitVoteBtn");
const voteMessage = $("voteMessage");
const voteProgress = $("voteProgress");

const winnerTitle = $("winnerTitle");
const eliminationCard = $("eliminationCard");
const resultSmallLabel = $("resultSmallLabel");
const eliminatedName = $("eliminatedName");
const eliminatedDetail = $("eliminatedDetail");
const resultSecretWord = $("resultSecretWord");
const resultCategory = $("resultCategory");
const resultImpostors = $("resultImpostors");
const resultRound = $("resultRound");
const voteTotals = $("voteTotals");
const resultScoreboard = $("resultScoreboard");
const historyList = $("historyList");
const continueGameBtn = $("continueGameBtn");
const playAgainBtn = $("playAgainBtn");
const finishMatchBtn = $("finishMatchBtn");
const finalPodium = $("finalPodium");
const finalHistory = $("finalHistory");
const resultHostHint = $("resultHostHint");
const resultMessage = $("resultMessage");

let currentRoomCode = null;
let currentPlayerId = null;
let currentPlayerToken = null;
let currentPlayerName = null;
let currentIsHost = false;
let impostorCount = 1;
let selectedVoteId = null;
let roomChannel = null;
let playerChannel = null;

const STORAGE_KEY = "gameAlpiImpostorV8";

function hideScreens() {
  Object.values(screens).forEach(el => el.classList.add("hidden"));
}

function setConnection(ok, text) {
  connectionBadge.classList.remove("connected", "error");
  connectionBadge.classList.add(ok ? "connected" : "error");
  connectionText.textContent = text;
}

function normalizeName(v) {
  return v.trim().replace(/\s+/g, " ").slice(0, 20);
}

function normalizeCode(v) {
  return v.replace(/\D/g, "").slice(0, 6);
}

function escapeHtml(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function saveSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    roomCode: currentRoomCode,
    playerId: currentPlayerId,
    playerToken: currentPlayerToken,
    playerName: currentPlayerName,
    isHost: currentIsHost
  }));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function maxImpostors(playerTotal) {
  if (playerTotal < 3) return 1;
  return 1 + Math.floor((playerTotal - 3) / 3);
}

function updateImpostorControls(totalPlayers) {
  const max = maxImpostors(totalPlayers);
  impostorCount = Math.max(1, Math.min(impostorCount, max));
  impostorCountDisplay.textContent = impostorCount;
  impostorHelp.textContent = `${impostorCount} impostor dari ${totalPlayers} pemain`;
  minusImpostorBtn.disabled = impostorCount <= 1;
  plusImpostorBtn.disabled = impostorCount >= max;
  startGameBtn.disabled = totalPlayers < 3;
}

function renderScoreboard(target, rows) {
  if (!rows?.length) {
    target.innerHTML = '<div class="you">Belum ada skor.</div>';
    return;
  }

  target.innerHTML = rows.map((row, index) => `
    <div class="score-row">
      <div class="score-left">
        <span class="rank">${index + 1}</span>
        <span class="score-name">${escapeHtml(row.player_name)}</span>
      </div>
      <span class="score-points">${row.score} poin</span>
    </div>
  `).join("");
}

async function loadScoreboard(target = lobbyScoreboard) {
  if (!currentPlayerId || !currentPlayerToken) return;

  const { data, error } = await db.rpc("impostor_get_scoreboard", {
    p_player_id: currentPlayerId,
    p_player_token: currentPlayerToken
  });

  if (!error) renderScoreboard(target, data || []);
}

async function loadPlayers() {
  if (!currentRoomCode) return [];

  const { data, error } = await db
    .from("players")
    .select("id,player_name,is_host,role_seen,vote_submitted,score,is_alive,created_at")
    .eq("room_code", currentRoomCode)
    .order("created_at", { ascending: true });

  if (error) return [];

  playerCount.textContent = `${data.length} pemain`;

  playersList.innerHTML = data.map(p => `
    <div class="player-row">
      <div class="player-left">
        <div class="avatar">${escapeHtml((p.player_name || "?")[0].toUpperCase())}</div>
        <div>
          <div class="player-name">${escapeHtml(p.player_name)}${p.is_alive === false ? " ☠️" : ""}</div>
          <div class="you">${String(p.id) === String(currentPlayerId) ? "Kamu • " : ""}${p.score || 0} poin</div>
        </div>
      </div>
      ${p.is_host ? '<span class="crown">👑 HOST</span>' : ""}
    </div>
  `).join("");

  const alive = data.filter(p => p.is_alive !== false);
  const seen = alive.filter(p => p.role_seen).length;
  seenProgress.textContent = `${seen} / ${alive.length} siap`;

  const voted = alive.filter(p => p.vote_submitted).length;
  voteProgress.textContent = `${voted} / ${alive.length} sudah vote`;

  if (currentIsHost) updateImpostorControls(alive.length);
  return data;
}

async function loadRoom() {
  if (!currentRoomCode) return null;

  const { data } = await db
    .from("rooms")
    .select("room_code,game_phase,impostor_count,round_no,selected_category")
    .eq("room_code", currentRoomCode)
    .maybeSingle();

  return data;
}

async function showLobby() {
  hideScreens();
  screens.lobby.classList.remove("hidden");
  roomCodeDisplay.textContent = currentRoomCode;

  currentIsHost ? hostBadge.classList.remove("hidden") : hostBadge.classList.add("hidden");
  currentIsHost ? hostControls.classList.remove("hidden") : hostControls.classList.add("hidden");

  await loadPlayers();
  await loadScoreboard(lobbyScoreboard);
}

async function showRevealOrWaiting() {
  const players = await loadPlayers();
  const me = players.find(p => String(p.id) === String(currentPlayerId));

  if (me?.role_seen) {
    hideScreens();
    screens.waiting.classList.remove("hidden");
    return;
  }

  await loadMyRole();
  hideScreens();
  screens.reveal.classList.remove("hidden");
}

async function showDiscussion() {
  hideScreens();
  screens.discussion.classList.remove("hidden");
  discussionRoomCode.textContent = currentRoomCode;

  if (currentIsHost) {
    startVotingBtn.classList.remove("hidden");
    discussionHint.classList.add("hidden");
  } else {
    startVotingBtn.classList.add("hidden");
    discussionHint.classList.remove("hidden");
  }
}

async function showVotingOrWaiting() {
  const players = await loadPlayers();
  const me = players.find(p => String(p.id) === String(currentPlayerId));

  if (me?.is_alive === false || me?.vote_submitted) {
    hideScreens();
    screens.voteWaiting.classList.remove("hidden");
    if (me?.is_alive === false) voteProgress.textContent = "Kamu sudah tereliminasi • menonton ronde";
    return;
  }

  selectedVoteId = null;
  submitVoteBtn.disabled = true;
  voteMessage.textContent = "";

  const choices = players.filter(p => p.is_alive !== false && String(p.id) !== String(currentPlayerId));

  voteOptions.innerHTML = choices.map(p => `
    <button class="vote-option" data-player-id="${p.id}">
      <span class="vote-radio"></span>
      <span class="vote-avatar">${escapeHtml((p.player_name || "?")[0].toUpperCase())}</span>
      <span class="vote-player-name">${escapeHtml(p.player_name)}</span>
    </button>
  `).join("");

  voteOptions.querySelectorAll(".vote-option").forEach(btn => {
    btn.addEventListener("click", () => {
      voteOptions.querySelectorAll(".vote-option").forEach(x => x.classList.remove("selected"));
      btn.classList.add("selected");
      selectedVoteId = Number(btn.dataset.playerId);
      submitVoteBtn.disabled = false;
    });
  });

  hideScreens();
  screens.voting.classList.remove("hidden");
}

async function showResult() {
  hideScreens();
  screens.result.classList.remove("hidden");
  await loadResult();
}

async function showPhase(phase) {
  if (phase === "lobby") return showLobby();
  if (phase === "reveal") return showRevealOrWaiting();
  if (phase === "discussion") return showDiscussion();
  if (phase === "voting") return showVotingOrWaiting();
  if (phase === "result") return showResult();
  if (phase === "finished") return showFinal();
}

async function loadMyRole() {
  revealMessage.textContent = "";

  const { data, error } = await db.rpc("impostor_get_my_role", {
    p_player_id: currentPlayerId,
    p_player_token: currentPlayerToken
  });

  if (error || !data?.length) {
    revealMessage.textContent = error?.message || "Role belum tersedia.";
    return;
  }

  const role = data[0];
  roleCard.classList.toggle("impostor", role.role === "impostor");
  roleCategory.textContent = role.category || "-";

  if (role.role === "impostor") {
    roleName.textContent = "IMPOSTOR";
    secretLabel.textContent = "CLUE";
    secretValue.textContent = (role.clues || []).join(" • ");
    roleDescription.textContent = "Kamu adalah Impostor. Kamu tidak tahu kata rahasianya. Gunakan kategori dan clue ini untuk menyamar.";
  } else {
    roleName.textContent = "WARGA";
    secretLabel.textContent = "KATA RAHASIA";
    secretValue.textContent = role.secret_word;
    roleDescription.textContent = "Berikan petunjuk yang berkaitan dengan kata ini, tetapi jangan menyebut katanya secara langsung.";
  }
}

async function loadHistory() {
  const { data, error } = await db.rpc("impostor_get_history", {
    p_player_id: currentPlayerId,
    p_player_token: currentPlayerToken
  });

  if (error || !data?.length) {
    historyList.innerHTML = '<div class="you">Belum ada riwayat.</div>';
    return;
  }

  historyList.innerHTML = data.map(row => `
    <div class="history-card">
      <div class="history-card-head">
        <span class="history-round">Ronde ${row.round_no}</span>
        <span class="history-winner">${row.winner === "civilian" ? "WARGA" : row.winner === "impostor" ? "IMPOSTOR" : "LANJUT"}</span>
      </div>
      <div class="history-meta">
        <div>Terpilih: <strong>${escapeHtml(row.eliminated_player_name || "Seri")}</strong></div>
        <div>Status: <strong>${row.eliminated_role === "impostor" ? "Impostor tertangkap" : row.eliminated_role === "tie" ? "Voting seri" : "Warga tereliminasi"}</strong></div>
      </div>
    </div>
  `).join("");
}

async function loadResult() {
  resultMessage.textContent = "";
  const { data, error } = await db.rpc("impostor_get_result", {
    p_player_id: currentPlayerId,
    p_player_token: currentPlayerToken
  });
  if (error || !data) { resultMessage.textContent = error?.message || "Hasil belum tersedia."; return; }

  winnerTitle.textContent = data.match_over
    ? (data.winner === "civilian" ? "Warga Menang Pertandingan!" : "Impostor Menang Pertandingan!")
    : "Ronde Selesai";

  eliminationCard.classList.remove("win-civilian", "win-impostor");
  if (data.match_over) eliminationCard.classList.add(data.winner === "civilian" ? "win-civilian" : "win-impostor");

  if (data.tie) {
    resultSmallLabel.textContent = "VOTING SERI";
    eliminatedName.textContent = "Tidak Ada Eliminasi";
  } else {
    resultSmallLabel.textContent = "PEMAIN TERPILIH";
    eliminatedName.textContent = data.eliminated_player_name || "-";
  }
  eliminatedDetail.textContent = data.message || "";
  resultSecretWord.textContent = data.match_over ? (data.secret_word || "-") : "Tetap rahasia";
  resultCategory.textContent = data.category || "-";
  resultImpostors.textContent = data.match_over
    ? ((data.remaining_impostors || []).join(", ") || "Tidak ada")
    : `${data.remaining_impostor_count ?? "?"} pemain`;
  resultRound.textContent = data.round_no || "-";
  voteTotals.innerHTML = (data.vote_totals || []).map(row => `<div class="vote-total-row"><strong>${escapeHtml(row.player_name)}</strong><span>${row.votes} suara</span></div>`).join("");
  await loadScoreboard(resultScoreboard);
  await loadHistory();

  continueGameBtn.classList.add("hidden");
  playAgainBtn.classList.add("hidden");
  finishMatchBtn.classList.add("hidden");
  if (currentIsHost) {
    resultHostHint.classList.add("hidden");
    if (data.match_over) playAgainBtn.classList.remove("hidden");
    else continueGameBtn.classList.remove("hidden");
    finishMatchBtn.classList.remove("hidden");
  } else {
    resultHostHint.classList.remove("hidden");
  }
}

async function showFinal() {
  hideScreens();
  screens.final.classList.remove("hidden");
  const { data } = await db.rpc("impostor_get_scoreboard", { p_player_id: currentPlayerId, p_player_token: currentPlayerToken });
  finalPodium.innerHTML = (data || []).map((r,i) => `<div class="podium-row"><span class="podium-name">${i===0?"🏆 ":""}${i+1}. ${escapeHtml(r.player_name)}</span><span class="podium-score">${r.score} poin</span></div>`).join("");
  const { data: history } = await db.rpc("impostor_get_history", { p_player_id: currentPlayerId, p_player_token: currentPlayerToken });
  finalHistory.innerHTML = (history || []).map(row => `<div class="history-card"><div class="history-card-head"><span class="history-round">Ronde ${row.round_no}</span><span class="history-winner">${row.winner === "civilian" ? "WARGA" : row.winner === "impostor" ? "IMPOSTOR" : "LANJUT"}</span></div><div class="history-meta"><div>Kata: <strong>${escapeHtml(row.secret_word || "-")}</strong></div><div>Kategori: <strong>${escapeHtml(row.category || "-")}</strong></div><div>Terpilih: <strong>${escapeHtml(row.eliminated_player_name || "Seri")}</strong></div></div></div>`).join("");
}

async function unsubscribeRealtime() {
  if (roomChannel) {
    await db.removeChannel(roomChannel);
    roomChannel = null;
  }
  if (playerChannel) {
    await db.removeChannel(playerChannel);
    playerChannel = null;
  }
}

async function subscribeRealtime() {
  await unsubscribeRealtime();

  roomChannel = db
    .channel(`imp-room-${currentRoomCode}-${Date.now()}`)
    .on("postgres_changes", {
      event: "UPDATE",
      schema: "public",
      table: "rooms",
      filter: `room_code=eq.${currentRoomCode}`
    }, async payload => {
      await showPhase(payload.new.game_phase);
    })
    .on("postgres_changes", {
      event: "DELETE",
      schema: "public",
      table: "rooms",
      filter: `room_code=eq.${currentRoomCode}`
    }, async () => {
      await unsubscribeRealtime();
      clearSession();
      currentRoomCode = null;
      hideScreens();
      screens.setup.classList.remove("hidden");
      setupMessage.textContent = "Room ditutup oleh host.";
    })
    .subscribe(status => {
      if (status === "SUBSCRIBED") setConnection(true, "Supabase Realtime terhubung");
    });

  playerChannel = db
    .channel(`imp-players-${currentRoomCode}-${Date.now()}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "players",
      filter: `room_code=eq.${currentRoomCode}`
    }, async () => {
      await loadPlayers();
      if (!screens.lobby.classList.contains("hidden")) {
        await loadScoreboard(lobbyScoreboard);
      }
    })
    .subscribe();
}

async function enterRoom() {
  saveSession();
  const room = await loadRoom();

  if (!room) {
    clearSession();
    hideScreens();
    screens.setup.classList.remove("hidden");
    setupMessage.textContent = "Room sudah tidak tersedia.";
    return;
  }

  if (currentIsHost && room.selected_category) {
    categorySelect.value = room.selected_category;
  }

  await showPhase(room.game_phase || "lobby");
  await subscribeRealtime();
}

async function createRoom() {
  const name = normalizeName(playerNameInput.value);
  if (!name) {
    setupMessage.textContent = "Isi nama pemain.";
    return;
  }

  createRoomBtn.disabled = true;
  setupMessage.textContent = "";

  const { data, error } = await db.rpc("impostor_create_room", {
    p_player_name: name
  });

  createRoomBtn.disabled = false;

  if (error || !data?.length) {
    setupMessage.textContent = error?.message || "Gagal membuat room.";
    return;
  }

  const row = data[0];
  currentRoomCode = row.room_code;
  currentPlayerId = row.player_id;
  currentPlayerToken = row.player_token;
  currentPlayerName = name;
  currentIsHost = true;

  await enterRoom();
}

async function joinRoom() {
  const name = normalizeName(playerNameInput.value);
  const code = normalizeCode(roomCodeInput.value);

  if (!name || code.length !== 6) {
    setupMessage.textContent = "Isi nama dan kode room 6 digit.";
    return;
  }

  joinRoomBtn.disabled = true;
  setupMessage.textContent = "";

  const { data, error } = await db.rpc("impostor_join_room", {
    p_room_code: code,
    p_player_name: name
  });

  joinRoomBtn.disabled = false;

  if (error || !data?.length) {
    setupMessage.textContent = error?.message || "Gagal gabung room.";
    return;
  }

  const row = data[0];
  currentRoomCode = row.room_code;
  currentPlayerId = row.player_id;
  currentPlayerToken = row.player_token;
  currentPlayerName = name;
  currentIsHost = false;

  await enterRoom();
}

async function startGame() {
  startGameBtn.disabled = true;
  lobbyMessage.textContent = "";

  const { error } = await db.rpc("impostor_start_game", {
    p_room_code: currentRoomCode,
    p_player_id: currentPlayerId,
    p_player_token: currentPlayerToken,
    p_impostor_count: impostorCount,
    p_category: categorySelect.value
  });

  if (error) {
    lobbyMessage.textContent = error.message;
    startGameBtn.disabled = false;
  }
}

async function markSeen() {
  seenBtn.disabled = true;
  revealMessage.textContent = "";

  const { data, error } = await db.rpc("impostor_mark_seen", {
    p_player_id: currentPlayerId,
    p_player_token: currentPlayerToken
  });

  if (error) {
    revealMessage.textContent = error.message;
    seenBtn.disabled = false;
    return;
  }

  if (data === "discussion") {
    await showDiscussion();
  } else {
    hideScreens();
    screens.waiting.classList.remove("hidden");
    await loadPlayers();
  }
}

async function startVoting() {
  startVotingBtn.disabled = true;
  discussionMessage.textContent = "";

  const { error } = await db.rpc("impostor_start_voting", {
    p_room_code: currentRoomCode,
    p_player_id: currentPlayerId,
    p_player_token: currentPlayerToken
  });

  if (error) {
    discussionMessage.textContent = error.message;
    startVotingBtn.disabled = false;
  }
}

async function submitVote() {
  if (!selectedVoteId) return;

  submitVoteBtn.disabled = true;
  voteMessage.textContent = "";

  const { data, error } = await db.rpc("impostor_cast_vote", {
    p_player_id: currentPlayerId,
    p_player_token: currentPlayerToken,
    p_voted_player_id: selectedVoteId
  });

  if (error) {
    voteMessage.textContent = error.message;
    submitVoteBtn.disabled = false;
    return;
  }

  if (data === "result") {
    await showResult();
  } else {
    hideScreens();
    screens.voteWaiting.classList.remove("hidden");
    await loadPlayers();
  }
}

async function playAgain() {
  playAgainBtn.disabled = true;
  resultMessage.textContent = "";

  const { error } = await db.rpc("impostor_reset_lobby", {
    p_room_code: currentRoomCode,
    p_player_id: currentPlayerId,
    p_player_token: currentPlayerToken
  });

  if (error) {
    resultMessage.textContent = error.message;
    playAgainBtn.disabled = false;
  }
}

async function continueGame() {
  const { error } = await db.rpc("impostor_continue_match", { p_room_code: currentRoomCode, p_player_id: currentPlayerId, p_player_token: currentPlayerToken });
  if (error) resultMessage.textContent = error.message;
}

async function finishMatch() {
  const { error } = await db.rpc("impostor_finish_match", { p_room_code: currentRoomCode, p_player_id: currentPlayerId, p_player_token: currentPlayerToken });
  if (error) resultMessage.textContent = error.message;
}

async function leaveRoom() {
  if (currentPlayerId && currentPlayerToken) {
    await db.rpc("impostor_leave_room", {
      p_player_id: currentPlayerId,
      p_player_token: currentPlayerToken
    });
  }

  await unsubscribeRealtime();
  clearSession();

  currentRoomCode = null;
  currentPlayerId = null;
  currentPlayerToken = null;
  currentPlayerName = null;
  currentIsHost = false;

  hideScreens();
  screens.setup.classList.remove("hidden");
}

async function restoreSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const s = JSON.parse(raw);
    currentRoomCode = s.roomCode;
    currentPlayerId = s.playerId;
    currentPlayerToken = s.playerToken;
    currentPlayerName = s.playerName;
    currentIsHost = s.isHost;

    if (currentRoomCode && currentPlayerId && currentPlayerToken) {
      await enterRoom();
    }
  } catch {
    clearSession();
  }
}

async function boot() {
  await db.rpc("impostor_cleanup_rooms");
  const { error } = await db
    .from("rooms")
    .select("room_code,game_phase,selected_category")
    .limit(1);

  if (error) {
    setConnection(false, "Database belum siap");
    setupMessage.textContent = "Pastikan SQL V5, V6, dan V7 sudah dijalankan.";
    return;
  }

  setConnection(true, "Supabase terhubung");
  await restoreSession();
}

minusImpostorBtn.addEventListener("click", async () => {
  if (impostorCount > 1) impostorCount--;
  const players = await loadPlayers();
  updateImpostorControls(players.length);
});

plusImpostorBtn.addEventListener("click", async () => {
  impostorCount++;
  const players = await loadPlayers();
  updateImpostorControls(players.length);
});

refreshScoreBtn.addEventListener("click", () => loadScoreboard(lobbyScoreboard));

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = normalizeCode(roomCodeInput.value);
});

createRoomBtn.addEventListener("click", createRoom);
joinRoomBtn.addEventListener("click", joinRoom);
startGameBtn.addEventListener("click", startGame);
seenBtn.addEventListener("click", markSeen);
startVotingBtn.addEventListener("click", startVoting);
submitVoteBtn.addEventListener("click", submitVote);
continueGameBtn.addEventListener("click", continueGame);
playAgainBtn.addEventListener("click", playAgain);
finishMatchBtn.addEventListener("click", finishMatch);
leaveRoomBtn.addEventListener("click", leaveRoom);

copyCodeBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentRoomCode);
    copyCodeBtn.textContent = "Tersalin ✓";
    setTimeout(() => copyCodeBtn.textContent = "Salin Kode", 1200);
  } catch {}
});

boot();

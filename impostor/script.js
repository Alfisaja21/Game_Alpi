const SUPABASE_URL = "https://keklkfvtbdejwqtmjzzo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_PHOgHUCIXq8B89-tk2edVg_5enIgQaq";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const $ = (id) => document.getElementById(id);

const setupScreen = $("setupScreen");
const lobbyScreen = $("lobbyScreen");
const revealScreen = $("revealScreen");
const waitingScreen = $("waitingScreen");
const discussionScreen = $("discussionScreen");

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
const minusImpostorBtn = $("minusImpostorBtn");
const plusImpostorBtn = $("plusImpostorBtn");
const impostorCountDisplay = $("impostorCountDisplay");
const impostorHelp = $("impostorHelp");
const startGameBtn = $("startGameBtn");
const leaveRoomBtn = $("leaveRoomBtn");
const lobbyMessage = $("lobbyMessage");

const roleCard = $("roleCard");
const roleName = $("roleName");
const secretLabel = $("secretLabel");
const secretValue = $("secretValue");
const roleDescription = $("roleDescription");
const seenBtn = $("seenBtn");
const revealMessage = $("revealMessage");
const seenProgress = $("seenProgress");
const discussionRoomCode = $("discussionRoomCode");
const resetLobbyBtn = $("resetLobbyBtn");

let currentRoomCode = null;
let currentPlayerId = null;
let currentPlayerToken = null;
let currentPlayerName = null;
let currentIsHost = false;
let impostorCount = 1;
let roomChannel = null;
let playerChannel = null;

const STORAGE_KEY = "gameAlpiImpostorV5";

function hideScreens() {
  [setupScreen,lobbyScreen,revealScreen,waitingScreen,discussionScreen].forEach(el => el.classList.add("hidden"));
}

function setConnection(ok, text) {
  connectionBadge.classList.remove("connected","error");
  connectionBadge.classList.add(ok ? "connected" : "error");
  connectionText.textContent = text;
}

function normalizeName(v) {
  return v.trim().replace(/\s+/g," ").slice(0,20);
}

function normalizeCode(v) {
  return v.replace(/\D/g,"").slice(0,6);
}

function escapeHtml(v) {
  return String(v)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
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
  impostorCount = Math.min(impostorCount, max);
  impostorCount = Math.max(1, impostorCount);
  impostorCountDisplay.textContent = impostorCount;
  impostorHelp.textContent = `${impostorCount} impostor dari ${totalPlayers} pemain`;
  minusImpostorBtn.disabled = impostorCount <= 1;
  plusImpostorBtn.disabled = impostorCount >= max;
  startGameBtn.disabled = totalPlayers < 3;
}

async function loadPlayers() {
  if (!currentRoomCode) return [];

  const { data, error } = await db
    .from("players")
    .select("id,player_name,is_host,role_seen,created_at")
    .eq("room_code", currentRoomCode)
    .order("created_at", {ascending:true});

  if (error) return [];

  playerCount.textContent = `${data.length} pemain`;
  playersList.innerHTML = data.map(p => `
    <div class="player-row">
      <div class="player-left">
        <div class="avatar">${escapeHtml((p.player_name||"?")[0].toUpperCase())}</div>
        <div>
          <div class="player-name">${escapeHtml(p.player_name)}</div>
          ${String(p.id)===String(currentPlayerId) ? '<div class="you">Kamu</div>' : ''}
        </div>
      </div>
      ${p.is_host ? '<span class="crown">👑 HOST</span>' : ''}
    </div>
  `).join("");

  const seen = data.filter(p => p.role_seen).length;
  seenProgress.textContent = `${seen} / ${data.length} siap`;

  if (currentIsHost) updateImpostorControls(data.length);
  return data;
}

async function loadRoom() {
  if (!currentRoomCode) return null;
  const { data } = await db
    .from("rooms")
    .select("room_code,game_phase,impostor_count")
    .eq("room_code", currentRoomCode)
    .maybeSingle();
  return data;
}

async function showPhase(phase) {
  hideScreens();

  if (phase === "lobby") {
    lobbyScreen.classList.remove("hidden");
    roomCodeDisplay.textContent = currentRoomCode;
    currentIsHost ? hostBadge.classList.remove("hidden") : hostBadge.classList.add("hidden");
    currentIsHost ? hostControls.classList.remove("hidden") : hostControls.classList.add("hidden");
    await loadPlayers();
    return;
  }

  if (phase === "reveal") {
    await loadMyRole();
    revealScreen.classList.remove("hidden");
    return;
  }

  if (phase === "waiting") {
    waitingScreen.classList.remove("hidden");
    await loadPlayers();
    return;
  }

  if (phase === "discussion") {
    discussionScreen.classList.remove("hidden");
    discussionRoomCode.textContent = currentRoomCode;
    currentIsHost ? resetLobbyBtn.classList.remove("hidden") : resetLobbyBtn.classList.add("hidden");
  }
}

async function loadMyRole() {
  const { data, error } = await db.rpc("impostor_get_my_role", {
    p_player_id: currentPlayerId,
    p_player_token: currentPlayerToken
  });

  if (error || !data || !data.length) {
    revealMessage.textContent = "Role belum tersedia.";
    return;
  }

  const role = data[0];
  roleCard.classList.toggle("impostor", role.role === "impostor");

  if (role.role === "impostor") {
    roleName.textContent = "IMPOSTOR";
    secretLabel.textContent = "KISI-KISI";
    secretValue.textContent = role.hint;
    roleDescription.textContent = "Kamu tidak mengetahui kata rahasia. Gunakan petunjuk pemain lain untuk menebaknya.";
  } else {
    roleName.textContent = "WARGA";
    secretLabel.textContent = "KATA RAHASIA";
    secretValue.textContent = role.secret_word;
    roleDescription.textContent = `Kategori: ${role.hint}. Berikan petunjuk tanpa menyebut kata ini secara langsung.`;
  }
}

async function unsubscribeRealtime() {
  if (roomChannel) { await db.removeChannel(roomChannel); roomChannel = null; }
  if (playerChannel) { await db.removeChannel(playerChannel); playerChannel = null; }
}

async function subscribeRealtime() {
  await unsubscribeRealtime();

  roomChannel = db
    .channel(`imp-room-${currentRoomCode}-${Date.now()}`)
    .on("postgres_changes", {
      event:"UPDATE", schema:"public", table:"rooms",
      filter:`room_code=eq.${currentRoomCode}`
    }, async payload => {
      const phase = payload.new.game_phase;
      await showPhase(phase);
    })
    .subscribe(status => {
      if (status === "SUBSCRIBED") setConnection(true,"Supabase Realtime terhubung");
    });

  playerChannel = db
    .channel(`imp-players-${currentRoomCode}-${Date.now()}`)
    .on("postgres_changes", {
      event:"*", schema:"public", table:"players",
      filter:`room_code=eq.${currentRoomCode}`
    }, async () => {
      await loadPlayers();
    })
    .subscribe();
}

async function enterRoom() {
  saveSession();
  const room = await loadRoom();
  await showPhase(room?.game_phase || "lobby");
  await subscribeRealtime();
}

async function createRoom() {
  const name = normalizeName(playerNameInput.value);
  if (!name) { setupMessage.textContent = "Isi nama pemain."; return; }

  createRoomBtn.disabled = true;
  const { data, error } = await db.rpc("impostor_create_room", { p_player_name: name });
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
  if (!name || code.length !== 6) { setupMessage.textContent = "Isi nama dan kode room 6 digit."; return; }

  joinRoomBtn.disabled = true;
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
    p_impostor_count: impostorCount
  });

  if (error) {
    lobbyMessage.textContent = error.message;
    startGameBtn.disabled = false;
  }
}

async function markSeen() {
  seenBtn.disabled = true;
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
    await showPhase("discussion");
  } else {
    await showPhase("waiting");
  }
}

async function resetLobby() {
  resetLobbyBtn.disabled = true;
  const { error } = await db.rpc("impostor_reset_lobby", {
    p_room_code: currentRoomCode,
    p_player_id: currentPlayerId,
    p_player_token: currentPlayerToken
  });
  if (error) resetLobbyBtn.disabled = false;
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
  setupScreen.classList.remove("hidden");
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
    if (currentRoomCode && currentPlayerId && currentPlayerToken) await enterRoom();
  } catch { clearSession(); }
}

async function boot() {
  const { error } = await db.from("rooms").select("room_code,game_phase").limit(1);
  if (error) {
    setConnection(false,"Database V5 belum siap");
    setupMessage.textContent = "Jalankan SQL V5 terlebih dahulu di Supabase SQL Editor.";
    return;
  }
  setConnection(true,"Supabase terhubung");
  await restoreSession();
}

minusImpostorBtn.addEventListener("click", () => {
  if (impostorCount > 1) impostorCount--;
  loadPlayers();
});
plusImpostorBtn.addEventListener("click", () => {
  impostorCount++;
  loadPlayers();
});
roomCodeInput.addEventListener("input", () => roomCodeInput.value = normalizeCode(roomCodeInput.value));
createRoomBtn.addEventListener("click", createRoom);
joinRoomBtn.addEventListener("click", joinRoom);
startGameBtn.addEventListener("click", startGame);
seenBtn.addEventListener("click", markSeen);
resetLobbyBtn.addEventListener("click", resetLobby);
leaveRoomBtn.addEventListener("click", leaveRoom);
copyCodeBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentRoomCode);
    copyCodeBtn.textContent = "Tersalin ✓";
    setTimeout(() => copyCodeBtn.textContent = "Salin Kode",1200);
  } catch {}
});

boot();

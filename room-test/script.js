const SUPABASE_URL = "https://keklkfvtbdejwqtmjzzo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_PHOgHUCIXq8B89-tk2edVg_5enIgQaq";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const setupScreen = document.getElementById("setupScreen");
const lobbyScreen = document.getElementById("lobbyScreen");
const gameScreen = document.getElementById("gameScreen");

const playerNameInput = document.getElementById("playerName");
const roomCodeInput = document.getElementById("roomCodeInput");
const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const setupMessage = document.getElementById("setupMessage");

const connectionBadge = document.getElementById("connectionBadge");
const connectionText = document.getElementById("connectionText");

const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const copyCodeBtn = document.getElementById("copyCodeBtn");
const playersList = document.getElementById("playersList");
const playerCount = document.getElementById("playerCount");
const hostBadge = document.getElementById("hostBadge");
const startGameBtn = document.getElementById("startGameBtn");
const hostHint = document.getElementById("hostHint");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const lobbyMessage = document.getElementById("lobbyMessage");

const gameRoomCode = document.getElementById("gameRoomCode");
const backLobbyBtn = document.getElementById("backLobbyBtn");
const gameMessage = document.getElementById("gameMessage");

let currentRoomCode = null;
let currentPlayerId = null;
let currentPlayerName = null;
let currentIsHost = false;
let playerChannel = null;
let roomChannel = null;

const STORAGE_KEY = "gameAlpiRoomTestSessionV4";

function setConnection(status, text) {
  connectionBadge.classList.remove("connected", "error");
  if (status === "connected") connectionBadge.classList.add("connected");
  if (status === "error") connectionBadge.classList.add("error");
  connectionText.textContent = text;
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ").slice(0, 20);
}

function normalizeRoomCode(value) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function generateRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function saveSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    roomCode: currentRoomCode,
    playerId: currentPlayerId,
    playerName: currentPlayerName,
    isHost: currentIsHost
  }));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function hideAllScreens() {
  setupScreen.classList.add("hidden");
  lobbyScreen.classList.add("hidden");
  gameScreen.classList.add("hidden");
}

function showSetup() {
  hideAllScreens();
  setupScreen.classList.remove("hidden");
}

function showLobby() {
  hideAllScreens();
  lobbyScreen.classList.remove("hidden");
  roomCodeDisplay.textContent = currentRoomCode;

  if (currentIsHost) {
    hostBadge.classList.remove("hidden");
    startGameBtn.classList.remove("hidden");
    hostHint.classList.add("hidden");
  } else {
    hostBadge.classList.add("hidden");
    startGameBtn.classList.add("hidden");
    hostHint.classList.remove("hidden");
  }
}

function showGame() {
  hideAllScreens();
  gameScreen.classList.remove("hidden");
  gameRoomCode.textContent = currentRoomCode;

  if (currentIsHost) {
    backLobbyBtn.classList.remove("hidden");
  } else {
    backLobbyBtn.classList.add("hidden");
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderPlayers(players) {
  playerCount.textContent = `${players.length} pemain`;

  playersList.innerHTML = players.map((player) => {
    const isYou = String(player.id) === String(currentPlayerId);
    const initial = (player.player_name || "?").charAt(0).toUpperCase();

    return `
      <div class="player-row">
        <div class="player-left">
          <div class="avatar">${escapeHtml(initial)}</div>
          <div>
            <div class="player-name">${escapeHtml(player.player_name)}</div>
            ${isYou ? '<div class="you">Kamu</div>' : ""}
          </div>
        </div>
        ${player.is_host ? '<span class="crown">👑 HOST</span>' : ""}
      </div>
    `;
  }).join("");
}

async function loadPlayers() {
  if (!currentRoomCode) return;

  const { data, error } = await db
    .from("players")
    .select("id, player_name, is_host, created_at")
    .eq("room_code", currentRoomCode)
    .order("created_at", { ascending: true });

  if (error) {
    lobbyMessage.textContent = error.message;
    return;
  }

  renderPlayers(data || []);
}

async function loadRoomStatus() {
  if (!currentRoomCode) return;

  const { data, error } = await db
    .from("rooms")
    .select("room_code, game_status")
    .eq("room_code", currentRoomCode)
    .maybeSingle();

  if (error || !data) return;

  if (data.game_status === "playing") {
    showGame();
  } else {
    showLobby();
  }
}

async function unsubscribeRealtime() {
  if (playerChannel) {
    await db.removeChannel(playerChannel);
    playerChannel = null;
  }

  if (roomChannel) {
    await db.removeChannel(roomChannel);
    roomChannel = null;
  }
}

async function subscribeRealtime() {
  await unsubscribeRealtime();

  playerChannel = db
    .channel(`players-${currentRoomCode}-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "players",
        filter: `room_code=eq.${currentRoomCode}`
      },
      () => loadPlayers()
    )
    .subscribe();

  roomChannel = db
    .channel(`room-status-${currentRoomCode}-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "rooms",
        filter: `room_code=eq.${currentRoomCode}`
      },
      (payload) => {
        const status = payload.new.game_status;

        if (status === "playing") showGame();
        if (status === "waiting") showLobby();
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setConnection("connected", "Supabase Realtime terhubung");
      }
    });
}

async function enterRoom() {
  saveSession();
  await loadPlayers();
  await loadRoomStatus();
  await subscribeRealtime();
}

async function createRoom() {
  const name = normalizeName(playerNameInput.value);

  if (!name) {
    setupMessage.textContent = "Isi nama pemain terlebih dahulu.";
    return;
  }

  createRoomBtn.disabled = true;
  setupMessage.textContent = "";

  try {
    let createdRoom = null;

    for (let i = 0; i < 8; i++) {
      const code = generateRoomCode();

      const { data, error } = await db
        .from("rooms")
        .insert({
          room_code: code,
          host_name: name,
          game_status: "waiting"
        })
        .select("room_code")
        .single();

      if (!error) {
        createdRoom = data;
        break;
      }

      if (error.code !== "23505") throw error;
    }

    if (!createdRoom) throw new Error("Gagal membuat kode room.");

    const { data: player, error: playerError } = await db
      .from("players")
      .insert({
        room_code: createdRoom.room_code,
        player_name: name,
        is_host: true
      })
      .select("id, player_name, is_host")
      .single();

    if (playerError) throw playerError;

    currentRoomCode = createdRoom.room_code;
    currentPlayerId = player.id;
    currentPlayerName = player.player_name;
    currentIsHost = true;

    await enterRoom();
  } catch (error) {
    setupMessage.textContent = "Gagal membuat room: " + error.message;
  } finally {
    createRoomBtn.disabled = false;
  }
}

async function joinRoom() {
  const name = normalizeName(playerNameInput.value);
  const code = normalizeRoomCode(roomCodeInput.value);

  if (!name || code.length !== 6) {
    setupMessage.textContent = "Isi nama dan kode room 6 digit.";
    return;
  }

  joinRoomBtn.disabled = true;
  setupMessage.textContent = "";

  try {
    const { data: room, error: roomError } = await db
      .from("rooms")
      .select("room_code, game_status")
      .eq("room_code", code)
      .maybeSingle();

    if (roomError) throw roomError;
    if (!room) {
      setupMessage.textContent = "Room tidak ditemukan.";
      return;
    }

    const { data: existing } = await db
      .from("players")
      .select("player_name")
      .eq("room_code", code);

    if ((existing || []).some(p => p.player_name.toLowerCase() === name.toLowerCase())) {
      setupMessage.textContent = "Nama sudah dipakai di room ini.";
      return;
    }

    const { data: player, error: playerError } = await db
      .from("players")
      .insert({
        room_code: code,
        player_name: name,
        is_host: false
      })
      .select("id, player_name, is_host")
      .single();

    if (playerError) throw playerError;

    currentRoomCode = code;
    currentPlayerId = player.id;
    currentPlayerName = player.player_name;
    currentIsHost = false;

    await enterRoom();
  } catch (error) {
    setupMessage.textContent = "Gagal masuk room: " + error.message;
  } finally {
    joinRoomBtn.disabled = false;
  }
}

async function startGame() {
  if (!currentIsHost) return;

  startGameBtn.disabled = true;
  lobbyMessage.textContent = "";

  const { error } = await db
    .from("rooms")
    .update({
      game_status: "playing",
      started_at: new Date().toISOString()
    })
    .eq("room_code", currentRoomCode);

  if (error) {
    lobbyMessage.textContent = "Gagal memulai game: " + error.message;
    startGameBtn.disabled = false;
    return;
  }

  showGame();
}

async function backToLobby() {
  if (!currentIsHost) return;

  backLobbyBtn.disabled = true;

  const { error } = await db
    .from("rooms")
    .update({ game_status: "waiting" })
    .eq("room_code", currentRoomCode);

  if (error) {
    gameMessage.textContent = "Gagal kembali ke lobby: " + error.message;
    backLobbyBtn.disabled = false;
    return;
  }

  showLobby();
  backLobbyBtn.disabled = false;
}

async function leaveRoom() {
  leaveRoomBtn.disabled = true;

  if (currentPlayerId) {
    await db.from("players").delete().eq("id", currentPlayerId);
  }

  await unsubscribeRealtime();

  currentRoomCode = null;
  currentPlayerId = null;
  currentPlayerName = null;
  currentIsHost = false;

  clearSession();
  playerNameInput.value = "";
  roomCodeInput.value = "";

  showSetup();
  leaveRoomBtn.disabled = false;
}

async function restoreSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const session = JSON.parse(raw);

    const { data: player } = await db
      .from("players")
      .select("id, room_code, player_name, is_host")
      .eq("id", session.playerId)
      .eq("room_code", session.roomCode)
      .maybeSingle();

    if (!player) {
      clearSession();
      return;
    }

    currentRoomCode = player.room_code;
    currentPlayerId = player.id;
    currentPlayerName = player.player_name;
    currentIsHost = player.is_host;

    await enterRoom();
  } catch {
    clearSession();
  }
}

async function testConnection() {
  try {
    const { error } = await db.from("rooms").select("room_code, game_status").limit(1);
    if (error) throw error;

    setConnection("connected", "Supabase terhubung");
    await restoreSession();
  } catch (error) {
    setConnection("error", "Supabase gagal terhubung");
    setupMessage.textContent =
      "Database belum siap untuk V4. Jalankan SQL migration V4 terlebih dahulu.";
  }
}

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = normalizeRoomCode(roomCodeInput.value);
});

createRoomBtn.addEventListener("click", createRoom);
joinRoomBtn.addEventListener("click", joinRoom);
startGameBtn.addEventListener("click", startGame);
backLobbyBtn.addEventListener("click", backToLobby);
leaveRoomBtn.addEventListener("click", leaveRoom);

copyCodeBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentRoomCode);
    copyCodeBtn.textContent = "Tersalin ✓";
    setTimeout(() => copyCodeBtn.textContent = "Salin Kode", 1200);
  } catch {}
});

testConnection();

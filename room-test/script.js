const SUPABASE_URL = "https://keklkfvtbdejwqtmjzzo.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_PHOgHUCIXq8B89-tk2edVg_5enIgQaq";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const setupScreen = document.getElementById("setupScreen");
const lobbyScreen = document.getElementById("lobbyScreen");
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
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const lobbyMessage = document.getElementById("lobbyMessage");

let currentRoomCode = null;
let currentPlayerId = null;
let currentPlayerName = null;
let currentIsHost = false;
let realtimeChannel = null;
const STORAGE_KEY = "gameAlpiRoomTestSession";

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

function setBusy(busy) {
  createRoomBtn.disabled = busy;
  joinRoomBtn.disabled = busy;
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

function showSetup() {
  setupScreen.classList.remove("hidden");
  lobbyScreen.classList.add("hidden");
  hostBadge.classList.add("hidden");
  lobbyMessage.textContent = "";
}

function showLobby() {
  setupScreen.classList.add("hidden");
  lobbyScreen.classList.remove("hidden");
  roomCodeDisplay.textContent = currentRoomCode;
  currentIsHost ? hostBadge.classList.remove("hidden") : hostBadge.classList.add("hidden");
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

  if (!players.length) {
    playersList.innerHTML = '<div class="player-row"><span class="you">Belum ada pemain.</span></div>';
    return;
  }

  playersList.innerHTML = players.map((player) => {
    const isYou = String(player.id) === String(currentPlayerId);
    const initial = (player.player_name || "?").trim().charAt(0).toUpperCase();

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
    lobbyMessage.textContent = "Gagal membaca daftar pemain: " + error.message;
    return;
  }

  renderPlayers(data || []);
}

async function unsubscribeRoom() {
  if (realtimeChannel) {
    await db.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
}

async function subscribeToRoom() {
  await unsubscribeRoom();

  realtimeChannel = db
    .channel(`room-${currentRoomCode}-${Date.now()}`)
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
    .subscribe((status) => {
      if (status === "SUBSCRIBED") setConnection("connected", "Supabase Realtime terhubung");
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setConnection("error", "Realtime gagal terhubung");
    });
}

async function enterLobby() {
  showLobby();
  saveSession();
  await loadPlayers();
  await subscribeToRoom();
}

async function createRoom() {
  const name = normalizeName(playerNameInput.value);

  if (!name) {
    setupMessage.textContent = "Isi nama pemain terlebih dahulu.";
    playerNameInput.focus();
    return;
  }

  setupMessage.textContent = "";
  setBusy(true);

  try {
    let createdRoom = null;

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateRoomCode();

      const { data, error } = await db
        .from("rooms")
        .insert({ room_code: code, host_name: name })
        .select("room_code")
        .single();

      if (!error) {
        createdRoom = data;
        break;
      }

      if (error.code !== "23505") throw error;
    }

    if (!createdRoom) throw new Error("Gagal membuat kode room unik. Coba lagi.");

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

    await enterLobby();
  } catch (error) {
    setupMessage.textContent = "Gagal membuat room: " + (error.message || "Unknown error");
  } finally {
    setBusy(false);
  }
}

async function joinRoom() {
  const name = normalizeName(playerNameInput.value);
  const code = normalizeRoomCode(roomCodeInput.value);

  if (!name) {
    setupMessage.textContent = "Isi nama pemain terlebih dahulu.";
    playerNameInput.focus();
    return;
  }

  if (code.length !== 6) {
    setupMessage.textContent = "Kode room harus terdiri dari 6 angka.";
    roomCodeInput.focus();
    return;
  }

  setupMessage.textContent = "";
  setBusy(true);

  try {
    const { data: room, error: roomError } = await db
      .from("rooms")
      .select("room_code")
      .eq("room_code", code)
      .maybeSingle();

    if (roomError) throw roomError;

    if (!room) {
      setupMessage.textContent = "Room tidak ditemukan. Periksa kembali kodenya.";
      return;
    }

    const { data: names, error: nameError } = await db
      .from("players")
      .select("player_name")
      .eq("room_code", code);

    if (nameError) throw nameError;

    const duplicate = (names || []).some(
      (p) => p.player_name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      setupMessage.textContent = "Nama tersebut sudah dipakai di room ini. Gunakan nama lain.";
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

    await enterLobby();
  } catch (error) {
    setupMessage.textContent = "Gagal masuk room: " + (error.message || "Unknown error");
  } finally {
    setBusy(false);
  }
}

async function leaveRoom() {
  leaveRoomBtn.disabled = true;
  lobbyMessage.textContent = "";

  try {
    if (currentPlayerId) {
      const { error } = await db.from("players").delete().eq("id", currentPlayerId);
      if (error) throw error;
    }
  } catch (error) {
    lobbyMessage.textContent = "Gagal menghapus pemain: " + error.message;
    leaveRoomBtn.disabled = false;
    return;
  }

  await unsubscribeRoom();
  currentRoomCode = null;
  currentPlayerId = null;
  currentPlayerName = null;
  currentIsHost = false;
  clearSession();

  playerNameInput.value = "";
  roomCodeInput.value = "";
  playersList.innerHTML = "";
  leaveRoomBtn.disabled = false;
  showSetup();
  setConnection("connected", "Supabase terhubung");
}

async function restoreSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const session = JSON.parse(raw);

    const { data: player, error } = await db
      .from("players")
      .select("id, room_code, player_name, is_host")
      .eq("id", session.playerId)
      .eq("room_code", session.roomCode)
      .maybeSingle();

    if (error || !player) {
      clearSession();
      return;
    }

    currentRoomCode = player.room_code;
    currentPlayerId = player.id;
    currentPlayerName = player.player_name;
    currentIsHost = player.is_host;

    await enterLobby();
  } catch {
    clearSession();
  }
}

async function testConnection() {
  try {
    const { error } = await db.from("rooms").select("room_code").limit(1);
    if (error) throw error;

    setConnection("connected", "Supabase terhubung");
    await restoreSession();
  } catch (error) {
    setConnection("error", "Supabase gagal terhubung");
    setupMessage.textContent =
      "Koneksi database gagal. Pastikan tabel dan policy Supabase sudah dibuat. " +
      (error.message || "");
  }
}

roomCodeInput.addEventListener("input", () => {
  roomCodeInput.value = normalizeRoomCode(roomCodeInput.value);
});

roomCodeInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") joinRoom();
});

createRoomBtn.addEventListener("click", createRoom);
joinRoomBtn.addEventListener("click", joinRoom);
leaveRoomBtn.addEventListener("click", leaveRoom);

copyCodeBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentRoomCode);
    const oldText = copyCodeBtn.textContent;
    copyCodeBtn.textContent = "Tersalin ✓";
    setTimeout(() => { copyCodeBtn.textContent = oldText; }, 1200);
  } catch {
    lobbyMessage.textContent = "Tidak bisa menyalin otomatis. Catat kode: " + currentRoomCode;
  }
});

testConnection();

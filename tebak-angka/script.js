const attemptsEl = document.getElementById("attempts");
const winsEl = document.getElementById("wins");
const bestEl = document.getElementById("best");
const input = document.getElementById("guessInput");
const guessBtn = document.getElementById("guessBtn");
const newGameBtn = document.getElementById("newGameBtn");
const messageEl = document.getElementById("message");
const iconEl = document.getElementById("icon");
const historyEl = document.getElementById("history");
const rangeFill = document.getElementById("rangeFill");

const MAX_ATTEMPTS = 7;

let secretNumber = 0;
let attemptsLeft = MAX_ATTEMPTS;
let guesses = [];
let gameOver = false;

let wins = Number(localStorage.getItem("tebakAngkaWins") || 0);
let best = Number(localStorage.getItem("tebakAngkaBest") || 0);

function randomNumber() {
  return Math.floor(Math.random() * 100) + 1;
}

function updateStats() {
  attemptsEl.textContent = attemptsLeft;
  winsEl.textContent = wins;
  bestEl.textContent = best > 0 ? best + "x" : "-";
}

function renderHistory() {
  if (guesses.length === 0) {
    historyEl.innerHTML = '<span class="empty-history">Belum ada</span>';
    return;
  }

  historyEl.innerHTML = guesses
    .map((number) => `<span class="guess-chip">${number}</span>`)
    .join("");
}

function startNewGame() {
  secretNumber = randomNumber();
  attemptsLeft = MAX_ATTEMPTS;
  guesses = [];
  gameOver = false;

  input.disabled = false;
  guessBtn.disabled = false;
  input.value = "";
  input.focus();

  messageEl.textContent = "Masukkan tebakan pertamamu.";
  iconEl.textContent = "🤔";
  rangeFill.style.width = "0%";

  renderHistory();
  updateStats();
}

function finishGame(won) {
  gameOver = true;
  input.disabled = true;
  guessBtn.disabled = true;

  if (won) {
    const used = MAX_ATTEMPTS - attemptsLeft;

    wins += 1;
    localStorage.setItem("tebakAngkaWins", String(wins));

    if (best === 0 || used < best) {
      best = used;
      localStorage.setItem("tebakAngkaBest", String(best));
    }

    iconEl.textContent = "🎉";
    messageEl.textContent = `Benar! Angkanya ${secretNumber}. Kamu berhasil dalam ${used} tebakan.`;
    rangeFill.style.width = "100%";
  } else {
    iconEl.textContent = "😵";
    messageEl.textContent = `Kesempatan habis. Angka rahasianya adalah ${secretNumber}.`;
    rangeFill.style.width = "100%";
  }

  updateStats();
}

function checkGuess() {
  if (gameOver) return;

  const guess = Number(input.value);

  if (!Number.isInteger(guess) || guess < 1 || guess > 100) {
    iconEl.textContent = "⚠️";
    messageEl.textContent = "Masukkan angka bulat dari 1 sampai 100.";
    input.focus();
    return;
  }

  if (guesses.includes(guess)) {
    iconEl.textContent = "🔁";
    messageEl.textContent = `Angka ${guess} sudah pernah kamu coba.`;
    input.select();
    return;
  }

  guesses.push(guess);
  attemptsLeft -= 1;
  rangeFill.style.width = `${(guesses.length / MAX_ATTEMPTS) * 100}%`;

  renderHistory();
  updateStats();

  if (guess === secretNumber) {
    finishGame(true);
    return;
  }

  if (attemptsLeft === 0) {
    finishGame(false);
    return;
  }

  if (guess < secretNumber) {
    iconEl.textContent = "⬆️";
    messageEl.textContent = `${guess} terlalu kecil. Coba angka yang lebih besar!`;
  } else {
    iconEl.textContent = "⬇️";
    messageEl.textContent = `${guess} terlalu besar. Coba angka yang lebih kecil!`;
  }

  input.value = "";
  input.focus();
}

guessBtn.addEventListener("click", checkGuess);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    checkGuess();
  }
});

newGameBtn.addEventListener("click", startNewGame);

startNewGame();

const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const bestScoreEl = document.getElementById('bestScore');
const gameArea = document.getElementById('gameArea');
const target = document.getElementById('target');
const startBtn = document.getElementById('startBtn');
const startMessage = document.getElementById('startMessage');
const result = document.getElementById('result');

let score = 0;
let timeLeft = 20;
let timer = null;
let isPlaying = false;

const savedBest = Number(localStorage.getItem('tapTargetBest')) || 0;
bestScoreEl.textContent = savedBest;

function moveTarget() {
  const areaRect = gameArea.getBoundingClientRect();
  const targetSize = target.offsetWidth || 68;
  const padding = 8;

  const maxX = Math.max(0, areaRect.width - targetSize - padding * 2);
  const maxY = Math.max(0, areaRect.height - targetSize - padding * 2);

  const x = padding + Math.random() * maxX;
  const y = padding + Math.random() * maxY;

  target.style.left = `${x}px`;
  target.style.top = `${y}px`;
}

function startGame() {
  if (isPlaying) return;

  score = 0;
  timeLeft = 20;
  isPlaying = true;

  scoreEl.textContent = score;
  timeEl.textContent = timeLeft;
  result.textContent = '';
  startMessage.style.display = 'none';
  target.style.display = 'block';
  startBtn.disabled = true;
  startBtn.textContent = 'Game Berjalan...';

  requestAnimationFrame(moveTarget);

  timer = setInterval(() => {
    timeLeft -= 1;
    timeEl.textContent = timeLeft;

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

function endGame() {
  clearInterval(timer);
  isPlaying = false;
  target.style.display = 'none';
  startBtn.disabled = false;
  startBtn.textContent = 'Main Lagi';

  const oldBest = Number(localStorage.getItem('tapTargetBest')) || 0;
  if (score > oldBest) {
    localStorage.setItem('tapTargetBest', score);
    bestScoreEl.textContent = score;
    result.textContent = `🎉 Rekor baru! Skor kamu: ${score}`;
  } else {
    result.textContent = `Game selesai. Skor kamu: ${score}`;
  }
}

target.addEventListener('click', () => {
  if (!isPlaying) return;
  score += 1;
  scoreEl.textContent = score;
  moveTarget();
});

startBtn.addEventListener('click', startGame);

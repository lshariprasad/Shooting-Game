// 3script5.js — final combined script (copy to file)
(() => {
  // DOM
  const startScreen = document.getElementById("startScreen");
  const startBtn = document.getElementById("startBtn");
  const playerNameInput = document.getElementById("playerNameInput");
  const playerEmailInput = document.getElementById("playerEmailInput");
  const levelSelect = document.getElementById("levelSelect");
  const playerNameDisplay = document.getElementById("playerNameDisplay");
  const gameUI = document.getElementById("gameUI");
  const scoreDisplay = document.getElementById("scoreDisplay");
  const levelDisplay = document.getElementById("levelDisplay");
  const endScreen = document.getElementById("endScreen");
  const finalText = document.getElementById("finalText");
  const feedbackText = document.getElementById("feedbackText");
  const submitFeedbackBtn = document.getElementById("submitFeedbackBtn");
  const restartBtn = document.getElementById("restartBtn");
  const saveBtn = document.getElementById("saveBtn");
  const downloadFeedbackBtn = document.getElementById("downloadFeedback");
  const slider = document.getElementById("slider");
  const showGameSpeed = document.getElementById("showGameSpeed");
  const nextUpgradeBtn = document.getElementById("nextUpgrade");

  // canvases
  const layerCanvas = document.getElementById("layerCanvas");
  const layerCtx = layerCanvas.getContext("2d");
  const canvas = document.getElementById("canvas1");
  const ctx = canvas.getContext("2d");
  const collisionCanvas = document.getElementById("collisioncanvas");
  const collisionCtx = collisionCanvas.getContext("2d");

  // mobile controls
  const btnLeft = document.getElementById("left");
  const btnRight = document.getElementById("right");
  const btnFire = document.getElementById("fire");

  // audio placeholders
  const sndGun = document.getElementById("snd-gun");
  const sndHit = document.getElementById("snd-hit");
  const sndBoss = document.getElementById("snd-boss");

  // responsive resize
  function resizeAll() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    layerCanvas.width = w;
    layerCanvas.height = h;
    canvas.width = w;
    canvas.height = h;
    collisionCanvas.width = w;
    collisionCanvas.height = h;
  }
  window.addEventListener("resize", resizeAll);
  resizeAll();

  // settings
  let playerName = "Player";
  let playerEmail = "";
  let score = 0;
  let level = 1;
  let lastTime = 0;
  let timeToNextRaven = 0;
  let ravenInterval = 700;
  let ravens = [];
  let particles = [];
  let explosions = [];
  let running = false;
  let playerX = window.innerWidth / 2;
  let moveLeft = false,
    moveRight = false;
  let gameSpeed = 2;
  slider.value = gameSpeed;
  showGameSpeed.innerText = gameSpeed;

  slider.addEventListener("input", (e) => {
    gameSpeed = Number(e.target.value);
    showGameSpeed.innerText = gameSpeed;
    // update parallax layers speed inside their update method (they read global gameSpeed)
  });

  // quick "Next Upgrade" debug button
  nextUpgradeBtn.addEventListener("click", () => {
    alert("Next Upgrade: coming soon!");
  });

  // audio small synths (fallback) — use only for quick feedback
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();
  function playGun() {
    try {
      if (audioCtx.state === "suspended") audioCtx.resume();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "square";
      o.frequency.value = 700;
      g.gain.value = 0.03;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.frequency.exponentialRampToValueAtTime(
        1200,
        audioCtx.currentTime + 0.05
      );
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
      o.stop(audioCtx.currentTime + 0.13);
    } catch (e) {}
  }
  function playHit() {
    try {
      if (audioCtx.state === "suspended") audioCtx.resume();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = "sawtooth";
      o.frequency.value = 300;
      g.gain.value = 0.07;
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start();
      o.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
      o.stop(audioCtx.currentTime + 0.32);
    } catch (e) {}
  }
  function playBossRoar() {
    try {
      if (audioCtx.state === "suspended") audioCtx.resume();
      const size = Math.floor(audioCtx.sampleRate * 0.25);
      const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < size; i++)
        data[i] = (Math.random() * 2 - 1) * (1 - i / size);
      const src = audioCtx.createBufferSource();
      const g = audioCtx.createGain();
      g.gain.value = 0.18;
      src.buffer = buffer;
      src.connect(g);
      g.connect(audioCtx.destination);
      src.start();
    } catch (e) {}
  }

  // load assets
  const ravenImg = new Image();
  ravenImg.src = "raven.png";
  const boomImg = new Image();
  boomImg.src = "boom.png";
  const layerImages = [];
  ["layer-1.png", "layer-2.png", "layer-3.png", "layer-4.png"].forEach(
    (src) => {
      const im = new Image();
      im.src = src;
      layerImages.push(im);
    }
  );

  // ---------------- Parallax Layer system ----------------
  class Layer {
    constructor(img, speedModifier) {
      this.img = img;
      this.speedModifier = speedModifier;
      this.width = Math.max(1200, img.width || 2400); // fallback
      this.height = layerCanvas.height;
      this.x = 0;
      this.x2 = this.width;
    }
    update() {
      const speed = gameSpeed * this.speedModifier;
      this.x -= speed;
      this.x2 -= speed;
      if (this.x <= -this.width) this.x = this.x2 + this.width - speed;
      if (this.x2 <= -this.width) this.x2 = this.x + this.width - speed;
    }
    draw() {
      // draw stretched to canvas height (keeps aspect roughly)
      try {
        layerCtx.drawImage(this.img, this.x, 0, this.width, layerCanvas.height);
        layerCtx.drawImage(
          this.img,
          this.x2,
          0,
          this.width,
          layerCanvas.height
        );
      } catch (e) {}
    }
  }
  const layers = [
    new Layer(layerImages[0], 0.25),
    new Layer(layerImages[1], 0.45),
    new Layer(layerImages[2], 0.7),
    new Layer(layerImages[3], 1.0),
  ];

  function drawParallax() {
    layerCtx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
    layers.forEach((L) => {
      L.update();
      L.draw();
    });
  }

  // ---------------- Utility ----------------
  const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;

  // ---------------- Raven class & particles ----------------
  class Raven {
    constructor(isBoss = false, chosenLevel = 1) {
      this.spriteW = 271;
      this.spriteH = 194;
      this.sizeModifier = isBoss ? 1.8 : Math.random() * 0.5 + 0.6;
      this.width = this.spriteW * this.sizeModifier * 0.45;
      this.height = this.spriteH * this.sizeModifier * 0.45;
      this.x = canvas.width + randInt(10, 200);
      this.y = Math.random() * (canvas.height - this.height - 120);
      const speedBase = 3 + chosenLevel * 0.8;
      this.speedX = (Math.random() * 2 + speedBase) * (isBoss ? 0.9 : 1.2);
      this.speedY = Math.random() * 2 - 1;
      this.frame = 0;
      this.maxFrame = 4;
      this.timer = 0;
      this.flapInterval = randInt(50, 120);
      this.isBoss = isBoss;
      this.hp = isBoss ? 6 : chosenLevel >= 4 ? 2 : 1;
      this.collisionColor = [randInt(1, 254), randInt(1, 254), randInt(1, 254)];
    }
    update(delta) {
      if (this.y < 0 || this.y > canvas.height - this.height - 120)
        this.speedY *= -1;
      this.x -= this.speedX;
      this.y += this.speedY;
      this.timer += delta;
      if (this.timer > this.flapInterval) {
        this.frame = (this.frame + 1) % (this.maxFrame + 1);
        this.timer = 0;
      }
      if (this.x + this.width < -50) this.marked = true;
      if (Math.random() < 0.03)
        particles.push(
          new Smoke(this.x + this.width - 14, this.y + this.height / 2)
        );
    }
    draw() {
      // draw collision rect to hidden collision canvas
      collisionCtx.fillStyle = `rgb(${this.collisionColor[0]},${this.collisionColor[1]},${this.collisionColor[2]})`;
      collisionCtx.fillRect(
        this.x | 0,
        this.y | 0,
        this.width | 0,
        this.height | 0
      );
      // visible sprite
      try {
        ctx.drawImage(
          ravenImg,
          this.frame * this.spriteW,
          0,
          this.spriteW,
          this.spriteH,
          this.x,
          this.y,
          this.width,
          this.height
        );
      } catch (e) {}
      // HP if boss
      if (this.isBoss) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(this.x, this.y - 12, this.width, 8);
        ctx.fillStyle = "red";
        ctx.fillRect(this.x, this.y - 12, this.width * (this.hp / 6), 8);
      }
    }
  }

  class Smoke {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.size = randInt(8, 18);
      this.vx = -(Math.random() * 0.8 + 0.3);
      this.vy = (Math.random() - 0.5) * 0.4;
      this.life = 50;
      this.color = `rgba(${randInt(180, 255)},${randInt(80, 160)},${randInt(
        30,
        120
      )},0.9)`;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      this.size *= 0.99;
      this.life--;
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life / 50);
      ctx.beginPath();
      ctx.fillStyle = this.color;
      ctx.ellipse(
        this.x,
        this.y,
        this.size,
        this.size * 0.6,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    }
  }

  class Blood {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 5;
      this.vy = (Math.random() - 0.9) * 6;
      this.life = 50;
      this.size = randInt(3, 7);
    }
    update() {
      this.vy += 0.18;
      this.x += this.vx;
      this.y += this.vy;
      this.life--;
    }
    draw() {
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.life / 50);
      ctx.beginPath();
      ctx.fillStyle = "rgba(200,20,20,1)";
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  class Explosion {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.frame = 0;
      this.timer = 0;
      this.maxFrame = 7;
      this.done = false;
      this.size = 140;
    }
    update(delta) {
      this.timer += delta;
      if (this.timer > 60) {
        this.frame++;
        this.timer = 0;
      }
      if (this.frame > this.maxFrame) this.done = true;
    }
    draw() {
      try {
        const fw = 256,
          fh = 128; // assumed frame size
        ctx.drawImage(
          boomImg,
          this.frame * fw,
          0,
          fw,
          fh,
          this.x - this.size / 2,
          this.y - this.size / 2,
          this.size,
          this.size
        );
      } catch (e) {
        ctx.beginPath();
        ctx.fillStyle = "orange";
        ctx.arc(this.x, this.y, 24 + this.frame * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // input: click to shoot
  function shootAtXY(x, y) {
    if (!running) return;
    try {
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) {}
    playGun();
    // check collision pixel on collision canvas
    const p = collisionCtx.getImageData(x | 0, y | 0, 1, 1).data;
    for (let i = 0; i < ravens.length; i++) {
      const r = ravens[i];
      if (
        !r.marked &&
        p[0] === r.collisionColor[0] &&
        p[1] === r.collisionColor[1] &&
        p[2] === r.collisionColor[2]
      ) {
        r.hp--;
        playHit();
        for (let n = 0; n < 12; n++)
          particles.push(new Blood(r.x + r.width / 2, r.y + r.height / 2));
        explosions.push(new Explosion(r.x + r.width / 2, r.y + r.height / 2));
        if (r.hp <= 0) {
          r.marked = true;
          score++;
          scoreDisplay.innerText = "Score: " + score;
          updateLevel();
        }
        break;
      }
    }
  }

  // handle click/touch on main canvas
  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left,
      y = e.clientY - rect.top;
    shootAtXY(x, y);
  });

  // keyboard + prevent space scrolling
  let spaceDown = false;
  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.key === "ArrowLeft") moveLeft = true;
    if (e.code === "ArrowRight" || e.key === "ArrowRight") moveRight = true;
    if (e.code === "Space" || e.key === " ") {
      if (!spaceDown) {
        spaceDown = true;
        // shoot from player location (straight up)
        const rect = canvas.getBoundingClientRect();
        const x = playerX - rect.left;
        const y = canvas.height - 200;
        shootAtXY(x, y);
      }
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.key === "ArrowLeft") moveLeft = false;
    if (e.code === "ArrowRight" || e.key === "ArrowRight") moveRight = false;
    if (e.code === "Space" || e.key === " ") {
      spaceDown = false;
      e.preventDefault();
    }
  });

  // mobile controls
  btnLeft.addEventListener("touchstart", () => (moveLeft = true));
  btnLeft.addEventListener("touchend", () => (moveLeft = false));
  btnRight.addEventListener("touchstart", () => (moveRight = true));
  btnRight.addEventListener("touchend", () => (moveRight = false));
  btnFire.addEventListener("touchstart", (ev) => {
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = playerX - rect.left;
    const y = canvas.height - 200;
    shootAtXY(x, y);
  });

  // start button
  startBtn.addEventListener("click", () => {
    playerName = playerNameInput.value.trim() || "Player";
    playerEmail = playerEmailInput.value.trim() || "";
    level =
      levelSelect.value === "boss" ? "boss" : Number(levelSelect.value || 1);
    playerNameDisplay.textContent = "Player: " + playerName;
    levelDisplay.textContent = "Level: " + (level === "boss" ? "Boss" : level);
    startScreen.classList.add("hidden");
    gameUI.classList.remove("hidden");
    running = true;
    lastTime = performance.now();
    score = 0;
    scoreDisplay.innerText = "Score: 0";
    ravens = [];
    particles = [];
    explosions = [];
    ravenInterval =
      level === "boss"
        ? 1500
        : level === 1
        ? 900
        : level === 2
        ? 650
        : level === 3
        ? 500
        : 420;
    if (level === "boss") spawnBossSoon();
    try {
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) {}
  });

  function spawnBossSoon() {
    setTimeout(() => {
      ravens.push(new Raven(true, 4));
      playBossRoar();
    }, 800);
  }

  // saves/feedback
  saveBtn.addEventListener("click", () => {
    const entry = {
      name: playerName,
      email: playerEmail,
      score,
      level,
      date: new Date().toISOString(),
    };
    const arr = JSON.parse(localStorage.getItem("devgames_saves") || "[]");
    arr.push(entry);
    localStorage.setItem("devgames_saves", JSON.stringify(arr));
    alert("Game saved locally.");
  });

  submitFeedbackBtn.addEventListener("click", () => {
    const fb = feedbackText.value.trim() || "—";
    const rec = {
      name: playerName,
      email: playerEmail,
      score,
      level,
      feedback: fb,
      date: new Date().toISOString(),
    };
    const arr = JSON.parse(localStorage.getItem("devgames_feedback") || "[]");
    arr.push(rec);
    localStorage.setItem("devgames_feedback", JSON.stringify(arr));
    alert("Thanks — feedback saved locally.");
    endScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
    gameUI.classList.add("hidden");
    running = false;
  });

  restartBtn.addEventListener("click", () => {
    endScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
    gameUI.classList.add("hidden");
    running = false;
  });

  downloadFeedbackBtn.addEventListener("click", () => {
    const arr = JSON.parse(localStorage.getItem("devgames_feedback") || "[]");
    if (!arr.length) return alert("No feedback saved yet");
    const rows = [["name", "email", "score", "level", "feedback", "date"]];
    arr.forEach((r) =>
      rows.push([r.name, r.email, r.score, r.level, r.feedback, r.date])
    );
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "devgames_feedback.csv";
    a.click();
    URL.revokeObjectURL(url);
  });

  // level progression
  function updateLevel() {
    if (score < 20) level = 1;
    else if (score < 40) level = 2;
    else if (score < 60) level = 3;
    else level = 4;
    levelDisplay.innerText = "Level: " + (level === 4 ? "4 (Full)" : level);
    showLevelAnnouncement(level);
    ravenInterval =
      level === 1 ? 900 : level === 2 ? 650 : level === 3 ? 500 : 420;
  }
  function showLevelAnnouncement(lvl) {
    const t = document.createElement("div");
    t.className = "level-glow";
    t.innerText = `Level ${lvl} reached — moving to next stage`;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1600);
  }

  // ---------------- Explosion input helper (boom sprite) ----------------
  // optional: allow click anywhere to create explosion for testing (comment out if undesired)
  // canvas.addEventListener('dblclick', (e)=>{ const rect = canvas.getBoundingClientRect(); explosions.push(new Explosion(e.clientX-rect.left, e.clientY-rect.top)); });

  // main animate loop
  function animate(ts) {
    const delta = ts - lastTime;
    lastTime = ts;
    // clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    collisionCtx.clearRect(0, 0, collisionCanvas.width, collisionCanvas.height);
    // draw background parallax (layerCanvas draws into itself)
    drawParallax();
    ctx.drawImage(layerCanvas, 0, 0, canvas.width, canvas.height);

    if (running) {
      // player movement
      if (moveLeft) playerX -= 6;
      if (moveRight) playerX += 6;
      playerX = Math.max(40, Math.min(canvas.width - 40, playerX));

      // spawn ravens
      timeToNextRaven += delta;
      if (timeToNextRaven > ravenInterval) {
        if (level === 4 && Math.random() < 0.07) {
          ravens.push(new Raven(true, 4));
          playBossRoar();
        } else ravens.push(new Raven(false, level === "boss" ? 4 : level));
        timeToNextRaven = 0;
      }

      // update objects
      ravens.forEach((r) => r.update(delta));
      particles.forEach((p) => p.update());
      explosions.forEach((ex) => ex.update(delta));

      // draw ravens (collision map is painted inside Raven.draw)
      ravens.forEach((r) => r.draw());
      particles.forEach((p) => p.draw());
      explosions.forEach((ex) => ex.draw());

      // draw player
      drawPlayer();

      // cleanup
      ravens = ravens.filter((r) => !r.marked);
      particles = particles.filter((p) => p.life > 0);
      explosions = explosions.filter((e) => !e.done);
    }

    requestAnimationFrame(animate);
  }

  function drawPlayer() {
    const px = playerX;
    const py = canvas.height - 90;
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(px - 30, py - 10, 60, 20);
    ctx.beginPath();
    ctx.fillStyle = "#fff";
    ctx.arc(px, py - 30, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // kick things off
  requestAnimationFrame((t) => {
    lastTime = t;
    requestAnimationFrame(animate);
  });

  // expose debug helpers
  window._DEVGAMES = {
    getSaves: () => JSON.parse(localStorage.getItem("devgames_saves") || "[]"),
    getFeedback: () =>
      JSON.parse(localStorage.getItem("devgames_feedback") || "[]"),
    downloadFeedbackCSV: () => downloadFeedbackBtn.click(),
  };

  // make canvases resize immediately to paint correct initial size
  resizeAll();
})();

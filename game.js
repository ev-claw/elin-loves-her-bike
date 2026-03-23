// ─── Elin's Bike Game ───────────────────────────────────────────────
// A side-scrolling London bike adventure
// ─────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ─── Canvas Setup ──────────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  // Internal game resolution (we scale to fit)
  const W = 800;
  const H = 450;
  const GROUND_Y = H - 70; // ground line

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;
    const scaleX = canvas.width / W;
    const scaleY = canvas.height / H;
    scale = Math.min(scaleX, scaleY);
    offsetX = (canvas.width - W * scale) / 2;
    offsetY = (canvas.height - H * scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  // ─── DOM refs ──────────────────────────────────────────────────────
  const startScreen = document.getElementById('startScreen');
  const startBtn = document.getElementById('startBtn');
  const hud = document.getElementById('hud');
  const mobileControls = document.getElementById('mobileControls');
  const gameOverScreen = document.getElementById('gameOver');
  const restartBtn = document.getElementById('restartBtn');
  const coinCountEl = document.getElementById('coinCount');
  const distCountEl = document.getElementById('distCount');
  const livesCountEl = document.getElementById('livesCount');
  const finalScoreEl = document.getElementById('finalScore');
  const finalDistEl = document.getElementById('finalDist');
  const btnJump = document.getElementById('btnJump');
  const btnDuck = document.getElementById('btnDuck');

  // ─── Audio (Web Audio API) ─────────────────────────────────────────
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playTone(freq, dur, type, vol) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.value = vol || 0.08;
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  }

  function playCoinSound() {
    playTone(880, 0.08, 'square', 0.07);
    setTimeout(() => playTone(1320, 0.1, 'square', 0.06), 60);
  }

  function playJumpSound() {
    playTone(260, 0.12, 'triangle', 0.06);
  }

  function playHitSound() {
    playTone(120, 0.25, 'sawtooth', 0.1);
    setTimeout(() => playTone(80, 0.3, 'sawtooth', 0.08), 100);
  }

  function playBabble() {
    if (!audioCtx) return;
    const syllables = [
      [320, 0.08], [480, 0.06], [400, 0.07], [520, 0.05],
      [360, 0.09], [440, 0.06], [280, 0.08], [600, 0.04],
    ];
    let t = 0;
    const count = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const s = syllables[Math.floor(Math.random() * syllables.length)];
      setTimeout(() => {
        playTone(s[0] + Math.random() * 80, s[1] + 0.03, 'triangle', 0.06);
      }, t);
      t += 80 + Math.random() * 60;
    }
  }

  // Background music - simple looping melody
  let musicInterval = null;
  const melody = [
    523, 587, 659, 523, 659, 698, 784, 784,
    698, 659, 587, 523, 587, 523, 440, 440,
    523, 587, 659, 523, 784, 880, 784, 698,
    659, 587, 523, 659, 587, 440, 523, 523,
  ];
  let melodyIdx = 0;

  function startMusic() {
    if (musicInterval) return;
    melodyIdx = 0;
    musicInterval = setInterval(() => {
      if (!audioCtx) return;
      playTone(melody[melodyIdx % melody.length], 0.12, 'triangle', 0.03);
      // Bass
      playTone(melody[melodyIdx % melody.length] / 2, 0.15, 'sine', 0.02);
      melodyIdx++;
    }, 220);
  }

  function stopMusic() {
    clearInterval(musicInterval);
    musicInterval = null;
  }

  // ─── Game State ────────────────────────────────────────────────────
  let state = 'menu'; // menu | playing | gameover
  let coins = 0;
  let distance = 0;
  let lives = 3;
  let speed = 3.5;
  let frameCount = 0;
  let invincibleTimer = 0;
  let lastBabbleTime = 0;
  let difficultyTimer = 0;

  // Elin (player)
  const elin = {
    x: 120,
    y: GROUND_Y,
    w: 48,
    h: 56,
    vy: 0,
    jumping: false,
    ducking: false,
    duckH: 32,
    pedalAngle: 0,
  };

  const GRAVITY = 0.55;
  const JUMP_FORCE = -11;

  // World objects
  let obstacles = [];
  let coinItems = [];
  let decorations = [];
  let clouds = [];
  let buildings = [];
  let animals = []; // cats and dogs

  // ─── Drawing Helpers ───────────────────────────────────────────────

  function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function drawCircle(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEllipse(x, y, rx, ry, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ─── Draw London Scenery ──────────────────────────────────────────

  function initScenery() {
    clouds = [];
    buildings = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({
        x: Math.random() * W,
        y: 30 + Math.random() * 80,
        w: 40 + Math.random() * 60,
        speed: 0.2 + Math.random() * 0.3,
      });
    }
    for (let i = 0; i < 8; i++) {
      const bh = 60 + Math.random() * 120;
      buildings.push({
        x: i * 120 + Math.random() * 40,
        w: 50 + Math.random() * 60,
        h: bh,
        color: ['#2d3436', '#636e72', '#b2bec3', '#dfe6e9', '#74b9ff'][Math.floor(Math.random() * 5)],
        windows: Math.random() > 0.3,
        isBigBen: i === 4, // one special building
      });
    }
  }

  function drawSky() {
    // Gradient sky
    const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, '#74b9ff');
    grad.addColorStop(0.7, '#a8d8ea');
    grad.addColorStop(1, '#dfe6e9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, GROUND_Y);
  }

  function drawClouds() {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const c of clouds) {
      drawEllipse(c.x, c.y, c.w / 2, 14, 'rgba(255,255,255,0.85)');
      drawEllipse(c.x - c.w * 0.25, c.y + 5, c.w * 0.3, 10, 'rgba(255,255,255,0.8)');
      drawEllipse(c.x + c.w * 0.25, c.y + 3, c.w * 0.28, 11, 'rgba(255,255,255,0.8)');
    }
  }

  function drawBuildings() {
    for (const b of buildings) {
      const bx = ((b.x - distance * 0.3) % (W + 200) + W + 200) % (W + 200) - 100;
      const by = GROUND_Y - b.h;

      if (b.isBigBen) {
        // Big Ben - tower shape
        drawRect(bx, by - 40, b.w * 0.4, b.h + 40, '#8B7355');
        drawRect(bx - 5, by - 40, b.w * 0.4 + 10, 12, '#A0855B');
        // Clock face
        drawCircle(bx + b.w * 0.2, by - 20, 8, '#ffeaa7');
        drawRect(bx + b.w * 0.2 - 1, by - 26, 2, 6, '#2d3436');
        // Spire
        ctx.fillStyle = '#8B7355';
        ctx.beginPath();
        ctx.moveTo(bx + b.w * 0.2 - 8, by - 40);
        ctx.lineTo(bx + b.w * 0.2, by - 65);
        ctx.lineTo(bx + b.w * 0.2 + 8, by - 40);
        ctx.fill();
      }

      drawRect(bx, by, b.w, b.h, b.color);

      // Windows
      if (b.windows) {
        const wRows = Math.floor(b.h / 20);
        const wCols = Math.floor(b.w / 18);
        for (let r = 0; r < wRows; r++) {
          for (let c = 0; c < wCols; c++) {
            const lit = Math.random() > 0.4;
            drawRect(
              bx + 6 + c * 18, by + 8 + r * 20,
              10, 12,
              lit ? '#ffeaa7' : '#636e72'
            );
          }
        }
      }
    }
  }

  function drawGround() {
    // Road
    drawRect(0, GROUND_Y, W, H - GROUND_Y, '#555');
    // Pavement line
    drawRect(0, GROUND_Y, W, 4, '#888');
    // Road markings
    const markOffset = (distance * speed * 2) % 40;
    ctx.fillStyle = '#eee';
    for (let x = -markOffset; x < W; x += 40) {
      ctx.fillRect(x, GROUND_Y + 30, 20, 3);
    }
    // Grass edge
    drawRect(0, GROUND_Y - 2, W, 4, '#55a630');
  }

  // Phone box decoration
  function drawPhoneBox(x) {
    const bx = ((x - distance * 0.5) % (W + 300) + W + 300) % (W + 300) - 100;
    drawRect(bx, GROUND_Y - 45, 18, 45, '#d63031');
    drawRect(bx + 2, GROUND_Y - 40, 14, 25, '#fab1a0');
    drawRect(bx + 1, GROUND_Y - 45, 16, 4, '#c0392b');
  }

  // ─── Draw Elin on Bike ────────────────────────────────────────────

  function drawElin() {
    const px = elin.x;
    const py = elin.y;
    const h = elin.ducking ? elin.duckH : elin.h;
    const flash = invincibleTimer > 0 && Math.floor(frameCount / 4) % 2 === 0;
    if (flash) {
      ctx.globalAlpha = 0.4;
    }

    // Bike wheels (small like Brompton!)
    const wheelR = 7;
    const wheelY = py;
    const rearWheelX = px - 8;
    const frontWheelX = px + 22;

    elin.pedalAngle += speed * 0.15;

    // Wheel spokes
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    for (let w = 0; w < 2; w++) {
      const wx = w === 0 ? rearWheelX : frontWheelX;
      drawCircle(wx, wheelY, wheelR, '#333');
      drawCircle(wx, wheelY, wheelR - 2, '#666');
      // Spokes
      for (let a = 0; a < 4; a++) {
        const angle = elin.pedalAngle + a * Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(wx, wheelY);
        ctx.lineTo(wx + Math.cos(angle) * (wheelR - 1), wheelY + Math.sin(angle) * (wheelR - 1));
        ctx.stroke();
      }
      // Tire
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, wheelY, wheelR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Bike frame
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(rearWheelX, wheelY); // rear hub
    ctx.lineTo(px + 5, wheelY - 16); // seat tube top
    ctx.lineTo(frontWheelX, wheelY); // front hub
    ctx.moveTo(px + 5, wheelY - 16);
    ctx.lineTo(px + 16, wheelY - 22); // handlebars
    ctx.lineTo(frontWheelX, wheelY);
    ctx.stroke();

    // Seat
    drawRect(px + 1, wheelY - 19, 10, 3, '#2d3436');

    // Handlebars
    drawRect(px + 14, wheelY - 26, 6, 4, '#2d3436');

    // Pedals (animated)
    const pedalX = px + 5;
    const pedalY = wheelY - 4;
    const pr = 5;
    drawCircle(
      pedalX + Math.cos(elin.pedalAngle) * pr,
      pedalY + Math.sin(elin.pedalAngle) * pr,
      2, '#666'
    );

    // Elin's body
    const bodyBaseY = wheelY - 19;

    if (elin.ducking) {
      // Ducking pose - leaning forward
      // Torso (horizontal)
      drawRect(px - 4, bodyBaseY - 6, 22, 8, '#e17055'); // jacket
      // Head
      drawCircle(px + 20, bodyBaseY - 5, 7, '#ffeaa7'); // face
      // Hair
      drawCircle(px + 20, bodyBaseY - 10, 6, '#d35400'); // hair
      drawRect(px + 16, bodyBaseY - 12, 10, 4, '#d35400');
      // Eye
      drawCircle(px + 23, bodyBaseY - 6, 1.5, '#2d3436');
      // Smile
      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px + 22, bodyBaseY - 3, 3, 0.1, Math.PI * 0.9);
      ctx.stroke();
    } else {
      // Normal upright pose
      // Legs on pedals
      ctx.strokeStyle = '#0984e3';
      ctx.lineWidth = 3;
      const footX = pedalX + Math.cos(elin.pedalAngle) * pr;
      const footY = pedalY + Math.sin(elin.pedalAngle) * pr;
      ctx.beginPath();
      ctx.moveTo(px + 5, bodyBaseY + 2);
      ctx.lineTo(footX, footY);
      ctx.stroke();

      // Torso
      drawRect(px + 1, bodyBaseY - 18, 12, 18, '#e17055'); // red jacket

      // Arms reaching to handlebars
      ctx.strokeStyle = '#ffeaa7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(px + 10, bodyBaseY - 12);
      ctx.lineTo(px + 17, wheelY - 24);
      ctx.stroke();

      // Head
      drawCircle(px + 7, bodyBaseY - 24, 8, '#ffeaa7'); // face

      // Hair (brownish-red)
      drawCircle(px + 7, bodyBaseY - 30, 7, '#d35400');
      drawRect(px + 1, bodyBaseY - 32, 14, 5, '#d35400');
      // Ponytail
      ctx.strokeStyle = '#d35400';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + 1, bodyBaseY - 28);
      ctx.quadraticCurveTo(px - 8, bodyBaseY - 22, px - 6, bodyBaseY - 14);
      ctx.stroke();

      // Eye
      drawCircle(px + 10, bodyBaseY - 25, 1.5, '#2d3436');

      // Smile
      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px + 9, bodyBaseY - 21, 3, 0.1, Math.PI * 0.8);
      ctx.stroke();

      // Rosy cheeks
      drawCircle(px + 13, bodyBaseY - 22, 2.5, 'rgba(255,120,120,0.4)');

      // Helmet
      ctx.fillStyle = '#fd79a8';
      ctx.beginPath();
      ctx.ellipse(px + 7, bodyBaseY - 30, 9, 5, -0.1, Math.PI, 0);
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;
  }

  // ─── Obstacle Drawing ─────────────────────────────────────────────

  function drawHedgehog(x, y) {
    // Body
    drawEllipse(x, y - 6, 12, 7, '#8B6914');
    // Spines
    ctx.fillStyle = '#5D4E37';
    for (let i = -4; i <= 4; i++) {
      const angle = -Math.PI / 2 + i * 0.25;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * 8, y - 6 + Math.sin(angle) * 5);
      ctx.lineTo(x + Math.cos(angle) * 14, y - 6 + Math.sin(angle) * 10);
      ctx.lineTo(x + Math.cos(angle + 0.15) * 8, y - 6 + Math.sin(angle + 0.15) * 5);
      ctx.fill();
    }
    // Face
    drawCircle(x + 9, y - 5, 4, '#D4A574');
    // Nose
    drawCircle(x + 12, y - 5, 1.5, '#2d3436');
    // Eye
    drawCircle(x + 10, y - 7, 1, '#2d3436');
    // Tiny legs
    drawRect(x - 5, y - 1, 3, 3, '#8B6914');
    drawRect(x + 3, y - 1, 3, 3, '#8B6914');
  }

  function drawOldPerson(x, y) {
    // This is a small granny with a walking stick
    // Legs
    drawRect(x - 3, y - 10, 4, 10, '#636e72');
    drawRect(x + 3, y - 10, 4, 10, '#636e72');
    // Body
    drawRect(x - 5, y - 28, 14, 20, '#b2bec3');
    // Cardigan
    drawRect(x - 6, y - 26, 16, 16, '#dfe6e9');
    // Head
    drawCircle(x + 2, y - 33, 6, '#ffeaa7');
    // Hair (white/grey bun)
    drawCircle(x + 2, y - 37, 5, '#ccc');
    drawCircle(x, y - 38, 3, '#ccc');
    // Glasses
    ctx.strokeStyle = '#636e72';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + 4, y - 33, 2.5, 0, Math.PI * 2);
    ctx.arc(x, y - 33, 2.5, 0, Math.PI * 2);
    ctx.moveTo(x + 1.5, y - 33);
    ctx.lineTo(x + 2.5, y - 33);
    ctx.stroke();
    // Walking stick
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 22);
    ctx.lineTo(x + 14, y);
    ctx.stroke();
    // Curved handle
    ctx.beginPath();
    ctx.arc(x + 8, y - 22, 3, -Math.PI * 0.5, Math.PI * 0.3);
    ctx.stroke();
  }

  function drawRat(x, y) {
    // Body
    drawEllipse(x, y - 4, 10, 5, '#636e72');
    // Head
    drawEllipse(x + 9, y - 5, 5, 4, '#636e72');
    // Ears
    drawCircle(x + 10, y - 9, 3, '#b2bec3');
    drawCircle(x + 13, y - 8, 2.5, '#b2bec3');
    // Eye
    drawCircle(x + 12, y - 5, 1, '#e17055');
    // Nose
    drawCircle(x + 14, y - 4, 1, '#2d3436');
    // Tail
    ctx.strokeStyle = '#b2bec3';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 4);
    ctx.quadraticCurveTo(x - 16, y - 12, x - 20, y - 6);
    ctx.stroke();
    // Legs
    drawRect(x - 4, y - 1, 2, 3, '#636e72');
    drawRect(x + 4, y - 1, 2, 3, '#636e72');
  }

  function drawCat(x, y) {
    // Body
    drawEllipse(x, y - 7, 10, 7, '#ff9f43');
    // Head
    drawCircle(x + 10, y - 12, 6, '#ff9f43');
    // Ears
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.moveTo(x + 7, y - 17);
    ctx.lineTo(x + 5, y - 24);
    ctx.lineTo(x + 11, y - 18);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 12, y - 17);
    ctx.lineTo(x + 15, y - 24);
    ctx.lineTo(x + 16, y - 17);
    ctx.fill();
    // Inner ears
    ctx.fillStyle = '#fab1a0';
    ctx.beginPath();
    ctx.moveTo(x + 8, y - 17);
    ctx.lineTo(x + 7, y - 22);
    ctx.lineTo(x + 10, y - 18);
    ctx.fill();
    // Eyes
    drawCircle(x + 8, y - 12, 1.5, '#2d3436');
    drawCircle(x + 13, y - 12, 1.5, '#2d3436');
    // Nose
    ctx.fillStyle = '#e17055';
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 10);
    ctx.lineTo(x + 9, y - 9);
    ctx.lineTo(x + 11, y - 9);
    ctx.fill();
    // Tail
    ctx.strokeStyle = '#ff9f43';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 7);
    ctx.quadraticCurveTo(x - 16, y - 20, x - 12, y - 24);
    ctx.stroke();
    // Legs
    drawRect(x - 5, y - 2, 3, 4, '#e17055');
    drawRect(x + 4, y - 2, 3, 4, '#e17055');
  }

  function drawDog(x, y) {
    // Body
    drawEllipse(x, y - 8, 13, 8, '#dfe6e9');
    // Spots
    drawCircle(x - 3, y - 6, 3, '#636e72');
    drawCircle(x + 4, y - 10, 2.5, '#636e72');
    // Head
    drawCircle(x + 13, y - 12, 7, '#dfe6e9');
    // Ear (floppy)
    drawEllipse(x + 18, y - 10, 4, 6, '#b2bec3');
    // Eye
    drawCircle(x + 12, y - 13, 1.5, '#2d3436');
    // Nose
    drawCircle(x + 18, y - 12, 2, '#2d3436');
    // Tongue
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.ellipse(x + 17, y - 8, 2, 3, 0.2, 0, Math.PI);
    ctx.fill();
    // Tail (wagging)
    const wag = Math.sin(frameCount * 0.2) * 0.4;
    ctx.strokeStyle = '#dfe6e9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 8);
    ctx.quadraticCurveTo(x - 18, y - 20 + wag * 10, x - 14, y - 25);
    ctx.stroke();
    // Legs
    drawRect(x - 7, y - 2, 3, 5, '#b2bec3');
    drawRect(x + 6, y - 2, 3, 5, '#b2bec3');
  }

  function drawCoin(x, y, bobOffset) {
    const cy = y + Math.sin(frameCount * 0.08 + bobOffset) * 4;
    // Outer
    drawCircle(x, cy, 9, '#ffd700');
    // Inner
    drawCircle(x, cy, 6, '#f0c000');
    // Shine
    drawCircle(x - 2, cy - 2, 2, '#fff3a0');
    // Pound symbol
    ctx.fillStyle = '#b8860b';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('£', x + 0.5, cy + 1);
  }

  // ─── Obstacle / Coin Types ────────────────────────────────────────

  const OBSTACLE_TYPES = [
    { type: 'hedgehog', w: 24, h: 14, ground: true },
    { type: 'oldperson', w: 20, h: 38, ground: true },
    { type: 'rat', w: 24, h: 10, ground: true },
  ];

  function spawnObstacle() {
    const def = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    obstacles.push({
      x: W + 20,
      y: GROUND_Y,
      w: def.w,
      h: def.h,
      type: def.type,
    });
  }

  function spawnCoin() {
    const high = Math.random() > 0.5;
    coinItems.push({
      x: W + 20,
      y: high ? GROUND_Y - 60 - Math.random() * 30 : GROUND_Y - 20,
      bobOffset: Math.random() * 6,
      collected: false,
    });
  }

  function spawnAnimal() {
    const isCat = Math.random() > 0.5;
    animals.push({
      x: W + 20,
      y: GROUND_Y,
      type: isCat ? 'cat' : 'dog',
      w: isCat ? 20 : 26,
      h: isCat ? 24 : 16,
    });
  }

  // ─── Collision ─────────────────────────────────────────────────────

  function boxCollision(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by && ay + ah > by - bh;
  }

  // ─── Game Init / Reset ────────────────────────────────────────────

  function resetGame() {
    coins = 0;
    distance = 0;
    lives = 3;
    speed = 3.5;
    frameCount = 0;
    invincibleTimer = 0;
    difficultyTimer = 0;
    elin.y = GROUND_Y;
    elin.vy = 0;
    elin.jumping = false;
    elin.ducking = false;
    obstacles = [];
    coinItems = [];
    animals = [];
    initScenery();
  }

  // ─── Input Handling ────────────────────────────────────────────────

  const keys = {};
  let jumpPressed = false;
  let duckPressed = false;

  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      jumpPressed = true;
    }
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      duckPressed = true;
    }
  });

  document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (e.code === 'ArrowDown') {
      duckPressed = false;
    }
  });

  // Mobile touch controls
  function addTouchEvents(btn, onDown, onUp) {
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); onUp(); });
    btn.addEventListener('touchcancel', (e) => { e.preventDefault(); onUp(); });
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); onDown(); });
    btn.addEventListener('mouseup', (e) => { e.preventDefault(); onUp(); });
  }

  addTouchEvents(btnJump,
    () => { jumpPressed = true; btnJump.classList.add('pressed'); },
    () => { btnJump.classList.remove('pressed'); }
  );
  addTouchEvents(btnDuck,
    () => { duckPressed = true; btnDuck.classList.add('pressed'); },
    () => { duckPressed = false; btnDuck.classList.remove('pressed'); }
  );

  // ─── UI State ──────────────────────────────────────────────────────

  function showPlaying() {
    startScreen.classList.add('hidden');
    hud.classList.add('active');
    mobileControls.classList.add('active');
    gameOverScreen.classList.remove('active');
  }

  function showGameOver() {
    hud.classList.remove('active');
    mobileControls.classList.remove('active');
    finalScoreEl.textContent = `Coins: ${coins}`;
    finalDistEl.textContent = `Distance: ${Math.floor(distance)}m`;
    gameOverScreen.classList.add('active');
    stopMusic();
  }

  function updateHUD() {
    coinCountEl.innerHTML = `&#x1FA99; ${coins}`;
    distCountEl.textContent = `${Math.floor(distance)}m`;
    livesCountEl.innerHTML = '&#10084;'.repeat(lives);
  }

  // ─── Game Loop ─────────────────────────────────────────────────────

  function update() {
    if (state !== 'playing') return;

    frameCount++;
    distance += speed * 0.05;
    difficultyTimer++;

    // Gradually increase speed
    if (difficultyTimer % 600 === 0 && speed < 8) {
      speed += 0.2;
    }

    // ─ Elin physics ─
    if (jumpPressed && !elin.jumping) {
      elin.vy = JUMP_FORCE;
      elin.jumping = true;
      jumpPressed = false;
      playJumpSound();
    }
    jumpPressed = false; // reset each frame for keyboard

    elin.ducking = duckPressed && !elin.jumping;

    elin.vy += GRAVITY;
    elin.y += elin.vy;
    if (elin.y >= GROUND_Y) {
      elin.y = GROUND_Y;
      elin.vy = 0;
      elin.jumping = false;
    }

    // ─ Invincibility ─
    if (invincibleTimer > 0) invincibleTimer--;

    // ─ Clouds ─
    for (const c of clouds) {
      c.x -= c.speed;
      if (c.x + c.w < -20) c.x = W + 40;
    }

    // ─ Spawn obstacles ─
    const spawnRate = Math.max(60, 140 - difficultyTimer * 0.01);
    if (frameCount % Math.floor(spawnRate) === 0) {
      spawnObstacle();
    }

    // ─ Spawn coins ─
    if (frameCount % 45 === 0) {
      spawnCoin();
    }

    // ─ Spawn animals occasionally ─
    if (frameCount % 300 === 0) {
      spawnAnimal();
    }

    // ─ Move obstacles ─
    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= speed;
      if (obstacles[i].x < -40) {
        obstacles.splice(i, 1);
        continue;
      }

      // Collision check
      if (invincibleTimer <= 0) {
        const o = obstacles[i];
        const eH = elin.ducking ? elin.duckH : elin.h;
        const eY = elin.y - eH;
        if (boxCollision(elin.x - 8, eY, 36, eH, o.x - o.w / 2, o.y, o.w, o.h)) {
          lives--;
          invincibleTimer = 90;
          playHitSound();
          playBabble();
          if (lives <= 0) {
            state = 'gameover';
            showGameOver();
            return;
          }
        }
      }
    }

    // ─ Move coins ─
    for (let i = coinItems.length - 1; i >= 0; i--) {
      coinItems[i].x -= speed;
      if (coinItems[i].x < -20) {
        coinItems.splice(i, 1);
        continue;
      }

      if (!coinItems[i].collected) {
        const c = coinItems[i];
        const cy = c.y + Math.sin(frameCount * 0.08 + c.bobOffset) * 4;
        const eH = elin.ducking ? elin.duckH : elin.h;
        if (boxCollision(elin.x - 5, elin.y - eH, 30, eH, c.x - 9, cy + 9, 18, 18)) {
          coinItems[i].collected = true;
          coins++;
          playCoinSound();
        }
      }
    }

    // ─ Move animals ─
    for (let i = animals.length - 1; i >= 0; i--) {
      animals[i].x -= speed * 0.7;
      if (animals[i].x < -40) {
        animals.splice(i, 1);
      }
    }

    // ─ Babble occasionally ─
    if (frameCount - lastBabbleTime > 400 + Math.random() * 300) {
      playBabble();
      lastBabbleTime = frameCount;
    }

    updateHUD();
  }

  function draw() {
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Clear
    ctx.clearRect(0, 0, W, H);

    drawSky();
    drawBuildings();
    drawClouds();
    drawPhoneBox(200);
    drawPhoneBox(600);
    drawGround();

    // Animals (background decoration, non-colliding)
    for (const a of animals) {
      if (a.type === 'cat') drawCat(a.x, a.y);
      else drawDog(a.x, a.y);
    }

    // Coins
    for (const c of coinItems) {
      if (!c.collected) {
        drawCoin(c.x, c.y, c.bobOffset);
      }
    }

    // Obstacles
    for (const o of obstacles) {
      if (o.type === 'hedgehog') drawHedgehog(o.x, o.y);
      else if (o.type === 'oldperson') drawOldPerson(o.x, o.y);
      else if (o.type === 'rat') drawRat(o.x, o.y);
    }

    // Elin
    drawElin();

    ctx.restore();
  }

  function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
  }

  // ─── Start / Restart ───────────────────────────────────────────────

  startBtn.addEventListener('click', () => {
    ensureAudio();
    resetGame();
    state = 'playing';
    showPlaying();
    startMusic();
  });

  restartBtn.addEventListener('click', () => {
    ensureAudio();
    resetGame();
    state = 'playing';
    showPlaying();
    startMusic();
  });

  // ─── Init ──────────────────────────────────────────────────────────
  initScenery();
  draw(); // Draw one frame for background on menu
  gameLoop();

})();

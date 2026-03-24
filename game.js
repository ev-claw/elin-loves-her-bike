// ─── Elin's Bike Game — Upgraded Console Edition ────────────────────
// A side-scrolling London bike adventure with 2000s console flair
// ────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ─── Canvas Setup ──────────────────────────────────────────────────
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const W = 800;
  const H = 450;
  const GROUND_Y = H - 70;

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
  const comboCountEl = document.getElementById('comboCount');
  const finalScoreEl = document.getElementById('finalScore');
  const finalDistEl = document.getElementById('finalDist');
  const finalBestEl = document.getElementById('finalBest');
  const goRankEl = document.getElementById('goRank');
  const speedFillEl = document.getElementById('speedFill');
  const hiScoreDisplay = document.getElementById('hiScoreDisplay');
  const btnJump = document.getElementById('btnJump');
  const btnDuck = document.getElementById('btnDuck');

  // ─── High Score ────────────────────────────────────────────────────
  let hiScore = parseInt(localStorage.getItem('elinBikeHiScore') || '0', 10);
  function updateHiScoreDisplay() {
    if (hiScore > 0) {
      hiScoreDisplay.textContent = `Best: ${hiScore} coins`;
    }
  }
  updateHiScoreDisplay();

  // ─── Audio (Web Audio API) ─────────────────────────────────────────
  let audioCtx = null;

  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playTone(freq, dur, type, vol, detune) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    if (detune) o.detune.value = detune;
    g.gain.value = vol || 0.08;
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  }

  function playNoise(dur, vol) {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * dur;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    const g = audioCtx.createGain();
    g.gain.value = vol || 0.05;
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    source.connect(g);
    g.connect(audioCtx.destination);
    source.start();
  }

  function playCoinSound() {
    playTone(988, 0.06, 'square', 0.06);
    setTimeout(() => playTone(1319, 0.08, 'square', 0.05), 40);
    setTimeout(() => playTone(1568, 0.1, 'square', 0.04), 80);
  }

  function playJumpSound() {
    const now = audioCtx ? audioCtx.currentTime : 0;
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, now);
    o.frequency.exponentialRampToValueAtTime(600, now + 0.12);
    g.gain.value = 0.07;
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(now);
    o.stop(now + 0.15);
    playNoise(0.04, 0.03);
  }

  function playLandSound() {
    playNoise(0.06, 0.04);
    playTone(100, 0.08, 'sine', 0.04);
  }

  function playHitSound() {
    playNoise(0.15, 0.12);
    playTone(100, 0.3, 'sawtooth', 0.1);
    setTimeout(() => playTone(70, 0.25, 'sawtooth', 0.08), 80);
  }

  function playComboSound(combo) {
    const base = 523 + combo * 80;
    playTone(base, 0.08, 'square', 0.05);
    setTimeout(() => playTone(base * 1.5, 0.1, 'square', 0.04), 50);
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
        playTone(s[0] + Math.random() * 80, s[1] + 0.03, 'triangle', 0.05);
      }, t);
      t += 80 + Math.random() * 60;
    }
  }

  function playSqueakSound() {
    if (!audioCtx) return;
    // Playful high-pitched squeaky voice — two rapid squeaks
    const now = audioCtx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.15;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(1200 + Math.random() * 200, t);
      o.frequency.exponentialRampToValueAtTime(1800 + Math.random() * 300, t + 0.06);
      o.frequency.exponentialRampToValueAtTime(900 + Math.random() * 100, t + 0.1);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 0.12);
    }
    // Third chirpy squeak
    const o2 = audioCtx.createOscillator();
    const g2 = audioCtx.createGain();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(1600, now + 0.32);
    o2.frequency.exponentialRampToValueAtTime(2200, now + 0.38);
    o2.frequency.exponentialRampToValueAtTime(1000, now + 0.44);
    g2.gain.setValueAtTime(0.07, now + 0.32);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
    o2.connect(g2);
    g2.connect(audioCtx.destination);
    o2.start(now + 0.32);
    o2.stop(now + 0.46);
  }

  // ─── Character Sounds ─────────────────────────────────────────────
  // Ambient character audio cues — procedural, lightweight, and charming

  let lastCharSoundFrame = 0; // global cooldown to prevent sound overlap
  const CHAR_SOUND_COOLDOWN = 90; // minimum frames between any character sound

  function canPlayCharSound() {
    if (frameCount - lastCharSoundFrame < CHAR_SOUND_COOLDOWN) return false;
    lastCharSoundFrame = frameCount;
    return true;
  }

  function playCatSound() {
    if (!audioCtx) return;
    // Soft, cute "mew" — sine wave with pitch bend
    const now = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(700 + Math.random() * 100, now);
    o.frequency.exponentialRampToValueAtTime(900 + Math.random() * 200, now + 0.06);
    o.frequency.exponentialRampToValueAtTime(500 + Math.random() * 80, now + 0.18);
    g.gain.setValueAtTime(0.06, now);
    g.gain.linearRampToValueAtTime(0.07, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(now);
    o.stop(now + 0.22);
  }

  function playDogSound() {
    if (!audioCtx) return;
    // Short playful yap — noise burst + square wave bark
    const now = audioCtx.currentTime;
    playNoise(0.03, 0.04);
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(280 + Math.random() * 40, now);
    o.frequency.exponentialRampToValueAtTime(180 + Math.random() * 30, now + 0.08);
    g.gain.setValueAtTime(0.05, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(now);
    o.stop(now + 0.1);
    // Second yip after short pause (50% chance)
    if (Math.random() > 0.5) {
      setTimeout(() => {
        const o2 = audioCtx.createOscillator();
        const g2 = audioCtx.createGain();
        o2.type = 'square';
        o2.frequency.setValueAtTime(320 + Math.random() * 50, audioCtx.currentTime);
        o2.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.06);
        g2.gain.setValueAtTime(0.04, audioCtx.currentTime);
        g2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        o2.connect(g2);
        g2.connect(audioCtx.destination);
        o2.start();
        o2.stop(audioCtx.currentTime + 0.08);
      }, 120);
    }
  }

  function playRatSound() {
    if (!audioCtx) return;
    // Quick scurrying chirp — very high, very short
    const now = audioCtx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.07;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(2200 + Math.random() * 400, t);
      o.frequency.exponentialRampToValueAtTime(1600 + Math.random() * 200, t + 0.04);
      g.gain.setValueAtTime(0.04, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 0.05);
    }
  }

  function playHedgehogSound() {
    if (!audioCtx) return;
    // Soft snuffling — filtered noise with low rumble
    const now = audioCtx.currentTime;
    const bufSize = audioCtx.sampleRate * 0.15;
    const buffer = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 600;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.04, now);
    g.gain.linearRampToValueAtTime(0.05, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    src.connect(filt);
    filt.connect(g);
    g.connect(audioCtx.destination);
    src.start(now);
  }

  function playGrannySound() {
    if (!audioCtx) return;
    // Grumpy "tut-tut" muttering — low warbling tone
    const now = audioCtx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.12;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(220 + Math.random() * 30, t);
      o.frequency.exponentialRampToValueAtTime(180 + Math.random() * 20, t + 0.08);
      g.gain.setValueAtTime(0.04, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start(t);
      o.stop(t + 0.1);
    }
  }

  // ─── Voice Callouts ──────────────────────────────────────────────
  // Random encouraging shouts that appear as floating text with a cheerful sound

  const CALLOUT_LINES = [
    'Go Elin!',
    'Elin, go for it!',
    'Elin watch the hedgehog!',
    'You can do it Elin!',
    'Wooo Elin!',
    'Pedal power!',
    'Watch out!',
    'Nice one Elin!',
    'Keep going!',
    'Elin you legend!',
    'Faster Elin!',
    'Mind the granny!',
    'Elin for the win!',
  ];

  let activeCallouts = []; // {text, x, y, life, maxLife, color}
  let lastCalloutFrame = 0;
  const CALLOUT_COOLDOWN = 720; // minimum ~12 seconds between callouts at 60fps
  const CALLOUT_CHANCE = 0.012; // checked each frame after cooldown — roughly once per 15-20s

  // ─── Spoken Callouts (Web Speech Synthesis) ────────────────────────
  // Speaks the callout line aloud using the browser's speech synthesis.
  // Graceful fallback: if speech synthesis is unavailable, we just skip it.

  let speechReady = false;
  if ('speechSynthesis' in window) {
    // Voices load asynchronously on many browsers — mark ready once loaded
    speechReady = speechSynthesis.getVoices().length > 0;
    speechSynthesis.addEventListener('voiceschanged', () => { speechReady = true; });
  }

  function speakCallout(text) {
    if (!('speechSynthesis' in window)) return;
    // Don't queue up speech — cancel any in-progress utterance
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    // Pick a friendly voice if available
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      // Prefer an English voice; pick the first en- voice, or fallback to default
      const enVoice = voices.find(v => /^en[-_]/i.test(v.lang));
      if (enVoice) utt.voice = enVoice;
    }
    utt.rate = 1.15;    // Slightly upbeat pace
    utt.pitch = 1.3;    // Cheerful, higher pitch
    utt.volume = 0.8;   // Not too loud — complement the game audio
    speechSynthesis.speak(utt);
  }

  function playCalloutSound() {
    if (!audioCtx) return;
    // Cheerful, enthusiastic shout — rising pitched babble with emphasis
    const now = audioCtx.currentTime;
    const notes = [
      { f: 400, d: 0.07 }, { f: 520, d: 0.06 }, { f: 620, d: 0.08 },
      { f: 700, d: 0.10 },
    ];
    let t = now;
    for (const n of notes) {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(n.f + Math.random() * 60, t);
      o.frequency.linearRampToValueAtTime(n.f * 1.15, t + n.d * 0.6);
      o.frequency.linearRampToValueAtTime(n.f * 0.9, t + n.d);
      g.gain.setValueAtTime(0.06, t);
      g.gain.linearRampToValueAtTime(0.08, t + n.d * 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, t + n.d + 0.02);
      o.connect(g);
      g.connect(audioCtx.destination);
      o.start(t);
      o.stop(t + n.d + 0.02);
      t += n.d + 0.02;
    }
  }

  function triggerCallout() {
    // Pick a contextual line — prefer hedgehog/granny lines when those are on-screen
    let line;
    const hedgehogNearby = obstacles.some(o => o.type === 'hedgehog' && o.x > 100 && o.x < W);
    const grannyNearby = obstacles.some(o => o.type === 'oldperson' && o.x > 100 && o.x < W);
    if (hedgehogNearby && Math.random() < 0.5) {
      line = 'Elin watch the hedgehog!';
    } else if (grannyNearby && Math.random() < 0.4) {
      line = 'Mind the granny!';
    } else {
      line = CALLOUT_LINES[Math.floor(Math.random() * CALLOUT_LINES.length)];
    }

    const colors = ['#ff6b9d', '#ffcc00', '#6bffb8', '#ff9f43', '#a29bfe', '#fd79a8'];
    activeCallouts.push({
      text: line,
      x: 60 + Math.random() * (W - 200),
      y: 40 + Math.random() * 60,
      life: 0,
      maxLife: 120, // ~2 seconds
      color: colors[Math.floor(Math.random() * colors.length)],
    });
    lastCalloutFrame = frameCount;
    playCalloutSound();
    speakCallout(line);
  }

  function updateCallouts() {
    for (let i = activeCallouts.length - 1; i >= 0; i--) {
      activeCallouts[i].life++;
      if (activeCallouts[i].life >= activeCallouts[i].maxLife) {
        activeCallouts.splice(i, 1);
      }
    }
  }

  function drawCallouts() {
    for (const c of activeCallouts) {
      const progress = c.life / c.maxLife;
      // Float upward gently
      const drawY = c.y - progress * 30;
      // Fade in quickly, hold, then fade out
      let alpha;
      if (progress < 0.1) alpha = progress / 0.1;
      else if (progress > 0.75) alpha = (1 - progress) / 0.25;
      else alpha = 1;
      // Slight bounce-in scale
      const scaleAmt = progress < 0.1 ? 0.8 + 0.2 * (progress / 0.1) : 1;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, drawY);
      ctx.scale(scaleAmt, scaleAmt);

      // Text outline for readability
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(c.text, 0, 0);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, 0, 0);

      ctx.restore();
    }
  }

  // ─── Music — punchy chiptune with drums ────────────────────────────
  let musicInterval = null;
  let drumInterval = null;
  const melody = [
    523, 587, 659, 784, 659, 698, 784, 880,
    784, 698, 659, 587, 523, 587, 659, 523,
    440, 523, 587, 659, 784, 880, 988, 880,
    784, 698, 659, 587, 523, 440, 523, 523,
  ];
  let melodyIdx = 0;
  let beatIdx = 0;

  function startMusic() {
    if (musicInterval) return;
    melodyIdx = 0;
    beatIdx = 0;
    musicInterval = setInterval(() => {
      if (!audioCtx) return;
      const note = melody[melodyIdx % melody.length];
      playTone(note, 0.1, 'square', 0.025, Math.sin(melodyIdx * 0.3) * 10);
      playTone(note / 2, 0.13, 'triangle', 0.02);
      // Harmony on every 4th
      if (melodyIdx % 4 === 0) {
        playTone(note * 1.25, 0.08, 'sine', 0.012);
      }
      melodyIdx++;
    }, 180);
    drumInterval = setInterval(() => {
      if (!audioCtx) return;
      if (beatIdx % 4 === 0) playNoise(0.05, 0.035);
      if (beatIdx % 4 === 2) playNoise(0.03, 0.02);
      if (beatIdx % 2 === 1) playTone(60, 0.04, 'sine', 0.025);
      beatIdx++;
    }, 180);
  }

  function stopMusic() {
    clearInterval(musicInterval);
    clearInterval(drumInterval);
    musicInterval = null;
    drumInterval = null;
  }

  // ─── Particle System ───────────────────────────────────────────────
  let particles = [];

  function spawnParticles(x, y, count, color, opts) {
    const o = opts || {};
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * (o.spread || 10),
        y: y + (Math.random() - 0.5) * (o.spread || 10),
        vx: (Math.random() - 0.5) * (o.speed || 3),
        vy: -(Math.random()) * (o.speed || 3) - (o.upward || 0),
        life: (o.life || 25) + Math.random() * 10,
        maxLife: (o.life || 25) + 10,
        size: (o.size || 2) + Math.random() * 2,
        color: color,
        gravity: o.gravity !== undefined ? o.gravity : 0.08,
        type: o.type || 'circle',
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life--;
      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      if (p.type === 'star') {
        drawStar(p.x, p.y, p.size, p.color);
      } else if (p.type === 'line') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawStar(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const method = i === 0 ? 'moveTo' : 'lineTo';
      ctx[method](x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }

  // ─── Screen Shake ──────────────────────────────────────────────────
  let shakeTimer = 0;
  let shakeIntensity = 0;

  function triggerShake(intensity, duration) {
    shakeIntensity = intensity;
    shakeTimer = duration;
  }

  // ─── Game State ────────────────────────────────────────────────────
  let state = 'menu';
  let coins = 0;
  let distance = 0;
  let lives = 3;
  let speed = 3.2;
  let frameCount = 0;
  let invincibleTimer = 0;
  let lastBabbleTime = 0;
  let difficultyTimer = 0;
  let combo = 0;
  let comboTimer = 0;
  let lastCoinFrame = 0;
  let zoneType = 'city'; // city | park | bridge
  let zoneTimer = 0;
  let zoneTransition = 0;

  // Elin (player)
  const elin = {
    x: 120,
    y: GROUND_Y,
    w: 48,
    h: 58,
    vy: 0,
    jumping: false,
    ducking: false,
    duckH: 34,
    pedalAngle: 0,
    wasInAir: false,
    tilt: 0,
    hairWave: 0,
    scarfWave: 0,
  };

  const GRAVITY = 0.58;
  const JUMP_FORCE = -11.5;
  const AIR_TAP_FORCE = -6.5;     // weaker than full jump
  const MAX_AIR_TAPS = 2;         // extra taps allowed mid-air
  const AIR_TAP_COOLDOWN = 8;     // frames between air taps
  let airTapsUsed = 0;
  let airTapCooldown = 0;

  // World objects
  let obstacles = [];
  let coinItems = [];
  let decorations = [];
  let clouds = [];
  let buildings = [];
  let animals = [];
  let malis = [];
  let foregroundItems = [];
  let speedLines = [];
  let farHills = [];

  // ─── Zone Colors ───────────────────────────────────────────────────

  const ZONES = {
    city: {
      skyTop: '#4a90d9',
      skyMid: '#7eb8e0',
      skyBot: '#c8dfe8',
      groundMain: '#555',
      groundLine: '#777',
      grassColor: '#55a630',
      ambient: 1.0,
    },
    park: {
      skyTop: '#5ba3e6',
      skyMid: '#8ecae6',
      skyBot: '#d4edda',
      groundMain: '#6b8e5a',
      groundLine: '#7da06a',
      grassColor: '#2d8a3e',
      ambient: 1.05,
    },
    bridge: {
      skyTop: '#3d7ab5',
      skyMid: '#6a9ec5',
      skyBot: '#b8cfe0',
      groundMain: '#5a5a5a',
      groundLine: '#8a8a8a',
      grassColor: '#4a7a30',
      ambient: 0.95,
    },
  };

  function getZone() { return ZONES[zoneType] || ZONES.city; }

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

  function lerpColor(a, b, t) {
    const ah = parseInt(a.slice(1), 16);
    const bh = parseInt(b.slice(1), 16);
    const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
    const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
    const rr = Math.round(ar + (br - ar) * t);
    const rg = Math.round(ag + (bg - ag) * t);
    const rb = Math.round(ab + (bb - ab) * t);
    return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + rb).toString(16).slice(1);
  }

  // ─── Scenery Init ──────────────────────────────────────────────────

  function initScenery() {
    clouds = [];
    buildings = [];
    farHills = [];
    foregroundItems = [];
    for (let i = 0; i < 8; i++) {
      clouds.push({
        x: Math.random() * W,
        y: 20 + Math.random() * 70,
        w: 40 + Math.random() * 70,
        speed: 0.15 + Math.random() * 0.25,
        opacity: 0.5 + Math.random() * 0.4,
        layer: Math.random() > 0.5 ? 0 : 1,
      });
    }
    // Far hills
    for (let i = 0; i < 5; i++) {
      farHills.push({
        x: i * 200 + Math.random() * 60,
        w: 160 + Math.random() * 120,
        h: 40 + Math.random() * 50,
      });
    }
    // Buildings
    for (let i = 0; i < 10; i++) {
      const bh = 50 + Math.random() * 140;
      buildings.push({
        x: i * 100 + Math.random() * 40,
        w: 40 + Math.random() * 55,
        h: bh,
        color: ['#2c3e50', '#34495e', '#5d6d7e', '#85929e', '#aeb6bf'][Math.floor(Math.random() * 5)],
        windows: Math.random() > 0.2,
        isBigBen: i === 3,
        isLondonEye: i === 7,
        hasCrane: Math.random() > 0.8,
        roofType: Math.floor(Math.random() * 3),
        windowLit: Array.from({ length: 50 }, () => Math.random() > 0.4),
      });
    }
    // Foreground
    for (let i = 0; i < 6; i++) {
      foregroundItems.push({
        x: i * 160 + Math.random() * 80,
        type: ['lamppost', 'tree', 'bench', 'bin', 'bollard'][Math.floor(Math.random() * 5)],
      });
    }
  }

  // ─── Draw Sky & Atmosphere ─────────────────────────────────────────

  function drawSky() {
    const z = getZone();
    const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, z.skyTop);
    grad.addColorStop(0.5, z.skyMid);
    grad.addColorStop(1, z.skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // Sun/moon glow
    const sunX = 650 + Math.sin(distance * 0.001) * 50;
    const sunGrad = ctx.createRadialGradient(sunX, 50, 0, sunX, 50, 80);
    sunGrad.addColorStop(0, 'rgba(255,240,200,0.4)');
    sunGrad.addColorStop(0.5, 'rgba(255,220,150,0.1)');
    sunGrad.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(sunX - 80, 0, 160, 130);
    drawCircle(sunX, 50, 18, 'rgba(255,235,180,0.7)');
  }

  // ─── Far Hills (deep parallax layer) ──────────────────────────────

  function drawFarHills() {
    ctx.fillStyle = 'rgba(100,130,160,0.25)';
    for (const h of farHills) {
      const hx = ((h.x - distance * 0.08) % (W + 300) + W + 300) % (W + 300) - 100;
      ctx.beginPath();
      ctx.moveTo(hx - h.w / 2, GROUND_Y - 10);
      ctx.quadraticCurveTo(hx, GROUND_Y - 10 - h.h, hx + h.w / 2, GROUND_Y - 10);
      ctx.fill();
    }
  }

  // ─── Clouds ────────────────────────────────────────────────────────

  function drawClouds() {
    for (const c of clouds) {
      ctx.globalAlpha = c.opacity;
      const col = c.layer === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.9)';
      drawEllipse(c.x, c.y, c.w / 2, 12 + c.layer * 3, col);
      drawEllipse(c.x - c.w * 0.25, c.y + 4, c.w * 0.3, 9, col);
      drawEllipse(c.x + c.w * 0.25, c.y + 2, c.w * 0.28, 10, col);
    }
    ctx.globalAlpha = 1;
  }

  // ─── Buildings (mid parallax) ─────────────────────────────────────

  function drawBuildings() {
    for (const b of buildings) {
      const bx = ((b.x - distance * 0.25) % (W + 200) + W + 200) % (W + 200) - 100;
      const by = GROUND_Y - b.h;

      // Special: London Eye silhouette
      if (b.isLondonEye) {
        ctx.strokeStyle = 'rgba(100,120,140,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx + 20, GROUND_Y - 70, 55, 0, Math.PI * 2);
        ctx.stroke();
        // Spokes
        for (let s = 0; s < 8; s++) {
          const sa = s * Math.PI / 4 + distance * 0.002;
          ctx.beginPath();
          ctx.moveTo(bx + 20, GROUND_Y - 70);
          ctx.lineTo(bx + 20 + Math.cos(sa) * 55, GROUND_Y - 70 + Math.sin(sa) * 55);
          ctx.stroke();
        }
        // Support
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx + 20, GROUND_Y - 15);
        ctx.lineTo(bx + 20, GROUND_Y);
        ctx.stroke();
        continue;
      }

      // Big Ben
      if (b.isBigBen) {
        const tw = b.w * 0.35;
        ctx.fillStyle = '#7a6845';
        ctx.fillRect(bx, by - 50, tw, b.h + 50);
        // Clock tier
        ctx.fillStyle = '#8a7855';
        ctx.fillRect(bx - 3, by - 50, tw + 6, 14);
        // Clock face
        drawCircle(bx + tw / 2, by - 32, 9, '#ffeaa7');
        ctx.strokeStyle = '#2d3436';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx + tw / 2, by - 32, 9, 0, Math.PI * 2);
        ctx.stroke();
        // Hands
        const ha = frameCount * 0.01;
        ctx.beginPath();
        ctx.moveTo(bx + tw / 2, by - 32);
        ctx.lineTo(bx + tw / 2 + Math.cos(ha) * 6, by - 32 + Math.sin(ha) * 6);
        ctx.moveTo(bx + tw / 2, by - 32);
        ctx.lineTo(bx + tw / 2 + Math.cos(ha * 0.08) * 4, by - 32 + Math.sin(ha * 0.08) * 4);
        ctx.stroke();
        // Spire
        ctx.fillStyle = '#6a5835';
        ctx.beginPath();
        ctx.moveTo(bx - 2, by - 50);
        ctx.lineTo(bx + tw / 2, by - 80);
        ctx.lineTo(bx + tw + 2, by - 50);
        ctx.fill();
      }

      // Main building body
      drawRect(bx, by, b.w, b.h, b.color);

      // Roof styles
      if (b.roofType === 1) {
        ctx.fillStyle = lerpColor(b.color, '#2c3e50', 0.3);
        ctx.beginPath();
        ctx.moveTo(bx - 2, by);
        ctx.lineTo(bx + b.w / 2, by - 12);
        ctx.lineTo(bx + b.w + 2, by);
        ctx.fill();
      } else if (b.roofType === 2) {
        drawRect(bx - 2, by - 3, b.w + 4, 5, lerpColor(b.color, '#2c3e50', 0.4));
      }

      // Crane
      if (b.hasCrane) {
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 1.5;
        const cx = bx + b.w / 2;
        ctx.beginPath();
        ctx.moveTo(cx, by);
        ctx.lineTo(cx, by - 40);
        ctx.lineTo(cx + 35, by - 40);
        ctx.moveTo(cx, by - 40);
        ctx.lineTo(cx - 15, by - 40);
        ctx.stroke();
      }

      // Windows with persistent lighting
      if (b.windows) {
        const wRows = Math.floor(b.h / 18);
        const wCols = Math.floor(b.w / 15);
        for (let r = 0; r < wRows; r++) {
          for (let c = 0; c < wCols; c++) {
            const idx = r * wCols + c;
            const lit = b.windowLit[idx % b.windowLit.length];
            drawRect(
              bx + 4 + c * 15, by + 6 + r * 18,
              8, 10,
              lit ? '#ffeaa7' : 'rgba(0,0,0,0.3)'
            );
            if (lit) {
              // Window glow
              ctx.fillStyle = 'rgba(255,234,167,0.15)';
              ctx.fillRect(bx + 2 + c * 15, by + 4 + r * 18, 12, 14);
            }
          }
        }
      }
    }
  }

  // ─── Ground ────────────────────────────────────────────────────────

  function drawGround() {
    const z = getZone();
    // Main ground
    drawRect(0, GROUND_Y, W, H - GROUND_Y, z.groundMain);

    if (zoneType === 'park') {
      // Park path
      drawRect(0, GROUND_Y, W, 5, '#8a7e5a');
      // Grass texture
      for (let x = 0; x < W; x += 12) {
        const gx = (x + distance * 3) % 12;
        ctx.fillStyle = 'rgba(45,138,62,0.3)';
        ctx.fillRect(x, GROUND_Y + 8 + Math.sin(x * 0.1) * 2, 2, 5);
      }
    } else {
      // Pavement/kerb
      drawRect(0, GROUND_Y, W, 5, z.groundLine);
      // Road markings (dashed center line)
      const markOffset = (distance * speed * 2) % 50;
      ctx.fillStyle = '#eee';
      for (let x = -markOffset; x < W; x += 50) {
        ctx.fillRect(x, GROUND_Y + 32, 25, 3);
      }
      // Double yellow lines
      ctx.fillStyle = '#e6c200';
      for (let x = -markOffset * 0.8; x < W; x += 1) {
        ctx.fillRect(x, GROUND_Y + 10, 1, 2);
        ctx.fillRect(x, GROUND_Y + 14, 1, 2);
      }
    }

    // Grass edge
    const grassY = GROUND_Y - 2;
    ctx.fillStyle = z.grassColor;
    for (let x = 0; x < W; x += 6) {
      const h = 3 + Math.sin(x * 0.2 + frameCount * 0.05) * 2;
      ctx.fillRect(x, grassY - h + 3, 3, h);
    }
  }

  // ─── Foreground Decorations ────────────────────────────────────────

  function drawForegroundItems() {
    for (const f of foregroundItems) {
      const fx = ((f.x - distance * 0.6) % (W + 300) + W + 300) % (W + 300) - 100;

      if (f.type === 'lamppost') {
        // Post
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(fx, GROUND_Y - 55, 3, 55);
        // Lamp head
        ctx.fillStyle = '#2d3436';
        ctx.fillRect(fx - 5, GROUND_Y - 58, 13, 5);
        // Light glow
        const glowGrad = ctx.createRadialGradient(fx + 1, GROUND_Y - 50, 0, fx + 1, GROUND_Y - 40, 25);
        glowGrad.addColorStop(0, 'rgba(255,235,170,0.2)');
        glowGrad.addColorStop(1, 'rgba(255,235,170,0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(fx - 24, GROUND_Y - 65, 50, 35);
        // Bulb
        drawCircle(fx + 1, GROUND_Y - 54, 2, '#ffeaa7');
      } else if (f.type === 'tree') {
        // Trunk
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(fx, GROUND_Y - 40, 5, 40);
        // Canopy
        drawCircle(fx + 2, GROUND_Y - 50, 18, '#2d8a3e');
        drawCircle(fx - 6, GROUND_Y - 42, 12, '#3da04e');
        drawCircle(fx + 10, GROUND_Y - 44, 13, '#2d8a3e');
        // Highlight
        drawCircle(fx + 4, GROUND_Y - 55, 8, 'rgba(60,180,80,0.4)');
      } else if (f.type === 'bench') {
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(fx - 1, GROUND_Y - 5, 2, 7);
        ctx.fillRect(fx + 17, GROUND_Y - 5, 2, 7);
        ctx.fillStyle = '#8D6E63';
        ctx.fillRect(fx - 2, GROUND_Y - 8, 22, 3);
        ctx.fillRect(fx - 2, GROUND_Y - 15, 22, 3);
      } else if (f.type === 'bin') {
        drawRect(fx, GROUND_Y - 18, 10, 18, '#636e72');
        drawRect(fx - 1, GROUND_Y - 20, 12, 3, '#4a5568');
      } else if (f.type === 'bollard') {
        drawRect(fx, GROUND_Y - 12, 5, 12, '#2d3436');
        drawCircle(fx + 2.5, GROUND_Y - 12, 3, '#636e72');
      }
    }
  }

  // ─── Phone Box / Postbox ───────────────────────────────────────────

  function drawPhoneBox(baseX) {
    const bx = ((baseX - distance * 0.5) % (W + 300) + W + 300) % (W + 300) - 100;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(bx + 2, GROUND_Y - 2, 20, 4);
    // Main box
    drawRect(bx, GROUND_Y - 50, 20, 50, '#c0392b');
    // Glass panels
    drawRect(bx + 3, GROUND_Y - 42, 14, 28, 'rgba(180,220,255,0.4)');
    // Frame bars
    ctx.fillStyle = '#d63031';
    ctx.fillRect(bx + 9, GROUND_Y - 42, 2, 28);
    ctx.fillRect(bx + 3, GROUND_Y - 28, 14, 2);
    // Crown
    drawRect(bx + 2, GROUND_Y - 53, 16, 5, '#e74c3c');
    // TELEPHONE text (tiny)
    ctx.fillStyle = '#fff';
    ctx.font = '3px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TELEPHONE', bx + 10, GROUND_Y - 44);
  }

  function drawPostbox(baseX) {
    const bx = ((baseX - distance * 0.5) % (W + 400) + W + 400) % (W + 400) - 100;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(bx + 7, GROUND_Y, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    drawRect(bx, GROUND_Y - 30, 14, 30, '#c0392b');
    // Cap
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.ellipse(bx + 7, GROUND_Y - 30, 8, 5, 0, Math.PI, 0);
    ctx.fill();
    // Slot
    drawRect(bx + 3, GROUND_Y - 20, 8, 2, '#333');
    // Royal emblem hint
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 5px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GR', bx + 7, GROUND_Y - 13);
  }

  // ─── Double-decker Bus (occasional) ────────────────────────────────

  function drawBus(baseX) {
    const bx = ((baseX - distance * 0.35) % (W + 500) + W + 500) % (W + 500) - 200;
    // Body
    drawRect(bx, GROUND_Y - 50, 70, 50, '#c0392b');
    // Upper deck
    drawRect(bx, GROUND_Y - 50, 70, 22, '#d63031');
    // Windows upper
    for (let w = 0; w < 5; w++) {
      drawRect(bx + 5 + w * 13, GROUND_Y - 47, 9, 15, 'rgba(180,220,255,0.5)');
    }
    // Windows lower
    for (let w = 0; w < 5; w++) {
      drawRect(bx + 5 + w * 13, GROUND_Y - 25, 9, 13, 'rgba(180,220,255,0.5)');
    }
    // Wheels
    drawCircle(bx + 14, GROUND_Y, 6, '#2d3436');
    drawCircle(bx + 56, GROUND_Y, 6, '#2d3436');
    drawCircle(bx + 14, GROUND_Y, 3, '#636e72');
    drawCircle(bx + 56, GROUND_Y, 3, '#636e72');
    // Destination board
    drawRect(bx + 10, GROUND_Y - 53, 50, 6, '#2d3436');
    ctx.fillStyle = '#ffa500';
    ctx.font = 'bold 4px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('73 VICTORIA', bx + 35, GROUND_Y - 48.5);
  }

  // ─── Speed Lines Effect ────────────────────────────────────────────

  function updateSpeedLines() {
    if (speed > 5 && Math.random() < (speed - 5) * 0.15) {
      speedLines.push({
        x: W,
        y: GROUND_Y - 20 - Math.random() * (GROUND_Y - 40),
        len: 15 + Math.random() * 30 + (speed - 5) * 8,
        life: 8,
      });
    }
    for (let i = speedLines.length - 1; i >= 0; i--) {
      speedLines[i].x -= speed * 3;
      speedLines[i].life--;
      if (speedLines[i].life <= 0 || speedLines[i].x < -40) {
        speedLines.splice(i, 1);
      }
    }
  }

  function drawSpeedLines() {
    for (const l of speedLines) {
      const alpha = l.life / 8;
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x + l.len, l.y);
      ctx.stroke();
    }
  }

  // ─── Draw Elin on Bike (upgraded girl character) ──────────────────

  function drawElin() {
    const px = elin.x;
    const py = elin.y;
    const flash = invincibleTimer > 0 && Math.floor(frameCount / 3) % 2 === 0;
    if (flash) ctx.globalAlpha = 0.35;

    // Update animation values
    elin.pedalAngle += speed * 0.15;
    elin.hairWave = Math.sin(frameCount * 0.12) * 0.3;
    elin.scarfWave = Math.sin(frameCount * 0.1 + 1) * 0.4;

    // Bike tilt based on state
    const targetTilt = elin.jumping ? -0.06 : (elin.ducking ? 0.04 : 0);
    elin.tilt += (targetTilt - elin.tilt) * 0.15;

    ctx.save();
    ctx.translate(px + 7, py);
    ctx.rotate(elin.tilt);
    ctx.translate(-(px + 7), -py);

    // ── Shadow ──
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(px + 7, GROUND_Y + 1, 22, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Bike ──
    const wheelR = 8;
    const wheelY = py;
    const rearWheelX = px - 10;
    const frontWheelX = px + 24;

    // Tire tracks / motion blur
    if (speed > 5 && !elin.jumping) {
      ctx.strokeStyle = 'rgba(0,0,0,0.08)';
      ctx.lineWidth = wheelR * 2;
      ctx.beginPath();
      ctx.moveTo(rearWheelX, wheelY);
      ctx.lineTo(rearWheelX - speed * 2, wheelY);
      ctx.stroke();
    }

    // Wheels with detail
    for (let w = 0; w < 2; w++) {
      const wx = w === 0 ? rearWheelX : frontWheelX;
      // Tire
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(wx, wheelY, wheelR, 0, Math.PI * 2);
      ctx.stroke();
      // Rim
      drawCircle(wx, wheelY, wheelR - 2, '#bbb');
      drawCircle(wx, wheelY, wheelR - 3.5, '#999');
      // Hub
      drawCircle(wx, wheelY, 2, '#666');
      // Spokes
      ctx.strokeStyle = '#aaa';
      ctx.lineWidth = 0.5;
      for (let a = 0; a < 6; a++) {
        const angle = elin.pedalAngle + a * Math.PI / 3;
        ctx.beginPath();
        ctx.moveTo(wx + Math.cos(angle) * 2, wheelY + Math.sin(angle) * 2);
        ctx.lineTo(wx + Math.cos(angle) * (wheelR - 2), wheelY + Math.sin(angle) * (wheelR - 2));
        ctx.stroke();
      }
    }

    // Frame — Brompton-style folding bike
    ctx.strokeStyle = '#27ae60';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    // Main triangle
    ctx.beginPath();
    ctx.moveTo(rearWheelX, wheelY);
    ctx.lineTo(px + 5, wheelY - 18);
    ctx.lineTo(frontWheelX, wheelY);
    ctx.stroke();
    // Seat tube
    ctx.beginPath();
    ctx.moveTo(px + 5, wheelY - 18);
    ctx.lineTo(px + 3, wheelY - 22);
    ctx.stroke();
    // Head tube
    ctx.beginPath();
    ctx.moveTo(px + 5, wheelY - 18);
    ctx.lineTo(px + 18, wheelY - 24);
    ctx.lineTo(frontWheelX, wheelY);
    ctx.stroke();
    // Fork
    ctx.strokeStyle = '#2d3436';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 18, wheelY - 24);
    ctx.lineTo(frontWheelX, wheelY);
    ctx.stroke();

    // Seat
    ctx.fillStyle = '#2d3436';
    ctx.beginPath();
    ctx.ellipse(px + 3, wheelY - 22, 6, 2.5, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Handlebars
    drawRect(px + 15, wheelY - 28, 8, 3, '#2d3436');
    // Grip covers
    drawRect(px + 14, wheelY - 29, 3, 5, '#e74c3c');
    drawRect(px + 21, wheelY - 29, 3, 5, '#e74c3c');

    // Battery pack (electric bike!)
    drawRect(px - 2, wheelY - 14, 12, 4, '#2c3e50');
    drawRect(px, wheelY - 13, 2, 2, '#27ae60'); // LED

    // Pedals (animated)
    const pedalCX = px + 5;
    const pedalCY = wheelY - 6;
    const pr = 6;
    const p1x = pedalCX + Math.cos(elin.pedalAngle) * pr;
    const p1y = pedalCY + Math.sin(elin.pedalAngle) * pr;
    const p2x = pedalCX + Math.cos(elin.pedalAngle + Math.PI) * pr;
    const p2y = pedalCY + Math.sin(elin.pedalAngle + Math.PI) * pr;
    // Crank
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.stroke();
    // Pedal platforms
    drawRect(p1x - 3, p1y - 1, 6, 2, '#555');
    drawRect(p2x - 3, p2y - 1, 6, 2, '#555');

    // ── Elin's Body ──
    const bodyBaseY = wheelY - 22;

    if (elin.ducking) {
      // ── Ducking Pose ──
      // Legs tucked
      ctx.strokeStyle = '#2d6dd4';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + 3, bodyBaseY + 4);
      ctx.lineTo(p1x, p1y);
      ctx.stroke();

      // Torso horizontal
      drawRect(px - 2, bodyBaseY - 4, 22, 9, '#e74c3c');
      // Jacket details
      drawRect(px + 18, bodyBaseY - 4, 2, 9, '#c0392b');

      // Arms reaching forward
      ctx.strokeStyle = '#fad0b4';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(px + 16, bodyBaseY);
      ctx.lineTo(px + 20, wheelY - 27);
      ctx.stroke();

      // Head
      drawCircle(px + 22, bodyBaseY - 3, 7, '#fad0b4');
      // Hair flowing back
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.moveTo(px + 18, bodyBaseY - 8);
      ctx.quadraticCurveTo(px + 22, bodyBaseY - 12, px + 27, bodyBaseY - 7);
      ctx.quadraticCurveTo(px + 26, bodyBaseY - 2, px + 18, bodyBaseY - 2);
      ctx.fill();
      // Hair band
      drawRect(px + 19, bodyBaseY - 10, 6, 2, '#ff6b81');
      // Ponytail flows back
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(px + 16, bodyBaseY - 5);
      ctx.quadraticCurveTo(px + 6, bodyBaseY - 8 + elin.hairWave * 3, px + 2, bodyBaseY - 3);
      ctx.stroke();
      // Eye
      drawCircle(px + 25, bodyBaseY - 4, 1.5, '#2d3436');
      // Determined smile
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px + 24, bodyBaseY - 1, 2.5, 0.2, Math.PI * 0.7);
      ctx.stroke();
      // Helmet
      ctx.fillStyle = '#ff6b81';
      ctx.beginPath();
      ctx.ellipse(px + 22, bodyBaseY - 8, 9, 5, -0.15, Math.PI, 0);
      ctx.fill();
      // Helmet star
      drawStar(px + 22, bodyBaseY - 10, 2, '#fff');
    } else {
      // ── Normal Upright Pose ──

      // Legs on pedals
      ctx.strokeStyle = '#2d6dd4';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(px + 5, bodyBaseY + 4);
      ctx.lineTo(p1x, p1y);
      ctx.stroke();
      // Shoes
      drawRect(p1x - 2, p1y - 1, 5, 3, '#e74c3c');

      // Torso — red jacket with white stripe
      drawRect(px + 0, bodyBaseY - 18, 13, 20, '#e74c3c');
      // Jacket stripe
      drawRect(px + 0, bodyBaseY - 6, 13, 2, '#fff');
      // Jacket collar
      drawRect(px + 2, bodyBaseY - 19, 9, 3, '#c0392b');
      // Zip line
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(px + 6, bodyBaseY - 16);
      ctx.lineTo(px + 6, bodyBaseY + 1);
      ctx.stroke();

      // Arms reaching to handlebars
      ctx.strokeStyle = '#fad0b4';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(px + 10, bodyBaseY - 12);
      ctx.quadraticCurveTo(px + 14, bodyBaseY - 16, px + 18, wheelY - 26);
      ctx.stroke();
      // Gloves
      drawCircle(px + 18, wheelY - 26, 2, '#e74c3c');

      // Scarf flowing behind
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + 3, bodyBaseY - 16);
      ctx.quadraticCurveTo(
        px - 6 + elin.scarfWave * 4, bodyBaseY - 12,
        px - 10 + elin.scarfWave * 6, bodyBaseY - 8
      );
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - 10 + elin.scarfWave * 6, bodyBaseY - 8);
      ctx.quadraticCurveTo(
        px - 14 + elin.scarfWave * 5, bodyBaseY - 4,
        px - 12 + elin.scarfWave * 7, bodyBaseY
      );
      ctx.stroke();

      // Head
      drawCircle(px + 6, bodyBaseY - 24, 8.5, '#fad0b4');

      // Hair — auburn/reddish, longer & more detailed for a young girl
      ctx.fillStyle = '#c0392b';
      // Top of head hair
      ctx.beginPath();
      ctx.arc(px + 6, bodyBaseY - 26, 8, Math.PI * 0.85, Math.PI * 2.15);
      ctx.fill();
      // Side hair left
      ctx.beginPath();
      ctx.moveTo(px - 2, bodyBaseY - 24);
      ctx.quadraticCurveTo(px - 4, bodyBaseY - 16, px - 2, bodyBaseY - 10);
      ctx.lineTo(px, bodyBaseY - 12);
      ctx.lineTo(px - 1, bodyBaseY - 24);
      ctx.fill();
      // Ponytail flowing behind
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(px - 1, bodyBaseY - 26);
      ctx.quadraticCurveTo(
        px - 14, bodyBaseY - 20 + elin.hairWave * 5,
        px - 12, bodyBaseY - 12 + elin.hairWave * 4
      );
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px - 12, bodyBaseY - 12 + elin.hairWave * 4);
      ctx.quadraticCurveTo(
        px - 15, bodyBaseY - 6 + elin.hairWave * 6,
        px - 10, bodyBaseY - 4 + elin.hairWave * 5
      );
      ctx.stroke();
      // Hair band / bow
      drawCircle(px - 1, bodyBaseY - 27, 2.5, '#ff6b81');
      drawCircle(px + 1, bodyBaseY - 28, 1.5, '#ff6b81');
      drawCircle(px - 3, bodyBaseY - 27, 1.5, '#ff6b81');

      // Face details
      // Eyes — larger, expressive, girl-character style
      // Eye whites
      drawEllipse(px + 8, bodyBaseY - 25, 2.5, 2, '#fff');
      drawEllipse(px + 3, bodyBaseY - 25, 2, 1.8, '#fff');
      // Pupils
      drawCircle(px + 9, bodyBaseY - 25, 1.5, '#2d3436');
      drawCircle(px + 3.5, bodyBaseY - 25, 1.2, '#2d3436');
      // Eye shine
      drawCircle(px + 9.5, bodyBaseY - 26, 0.6, '#fff');
      drawCircle(px + 4, bodyBaseY - 26, 0.5, '#fff');
      // Eyelashes
      ctx.strokeStyle = '#2d3436';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(px + 10.5, bodyBaseY - 26);
      ctx.lineTo(px + 11.5, bodyBaseY - 27.5);
      ctx.moveTo(px + 5, bodyBaseY - 26);
      ctx.lineTo(px + 5.5, bodyBaseY - 27.5);
      ctx.stroke();

      // Rosy cheeks
      drawCircle(px + 11, bodyBaseY - 22, 2.5, 'rgba(255,130,130,0.35)');
      drawCircle(px + 1, bodyBaseY - 22, 2, 'rgba(255,130,130,0.3)');

      // Smile — happy, wide
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(px + 7, bodyBaseY - 21, 3.5, 0.15, Math.PI * 0.85);
      ctx.stroke();

      // Freckles (tiny dots)
      ctx.fillStyle = 'rgba(180,100,60,0.3)';
      drawCircle(px + 9, bodyBaseY - 23, 0.5, 'rgba(180,100,60,0.3)');
      drawCircle(px + 10.5, bodyBaseY - 23.5, 0.5, 'rgba(180,100,60,0.3)');
      drawCircle(px + 3, bodyBaseY - 23, 0.5, 'rgba(180,100,60,0.3)');

      // Helmet — pink with star
      ctx.fillStyle = '#ff6b81';
      ctx.beginPath();
      ctx.ellipse(px + 6, bodyBaseY - 30, 10, 6, -0.08, Math.PI * 0.9, Math.PI * 0.1, true);
      ctx.fill();
      // Helmet shine
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(px + 4, bodyBaseY - 33, 5, 2, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // Helmet star
      drawStar(px + 8, bodyBaseY - 33, 2.5, '#fff');
      // Helmet strap
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px + 12, bodyBaseY - 26);
      ctx.lineTo(px + 13, bodyBaseY - 22);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1.0;
  }

  // ─── Obstacle Drawing ─────────────────────────────────────────────

  function drawHedgehog(x, y) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 14, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    drawEllipse(x, y - 6, 13, 8, '#8B6914');
    // Spines
    ctx.fillStyle = '#5D4E37';
    for (let i = -5; i <= 5; i++) {
      const angle = -Math.PI / 2 + i * 0.22;
      const spineLen = 10 + Math.sin(frameCount * 0.1 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * 9, y - 6 + Math.sin(angle) * 6);
      ctx.lineTo(x + Math.cos(angle) * spineLen + Math.cos(angle + 0.1) * 4, y - 6 + Math.sin(angle) * spineLen);
      ctx.lineTo(x + Math.cos(angle + 0.18) * 9, y - 6 + Math.sin(angle + 0.18) * 6);
      ctx.fill();
    }
    // Face
    drawCircle(x + 10, y - 5, 5, '#D4A574');
    // Nose
    drawCircle(x + 14, y - 5, 2, '#2d3436');
    // Eye
    drawCircle(x + 11, y - 7, 1.3, '#2d3436');
    drawCircle(x + 11.3, y - 7.3, 0.4, '#fff');
    // Legs (animated)
    const legOff = Math.sin(frameCount * 0.2) * 2;
    drawRect(x - 6, y - 1 + legOff, 4, 3, '#8B6914');
    drawRect(x + 3, y - 1 - legOff, 4, 3, '#8B6914');
    ctx.restore();
  }

  function drawOldPerson(x, y) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(x + 2, y + 1, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Shoes
    drawRect(x - 4, y - 3, 5, 3, '#5D4037');
    drawRect(x + 3, y - 3, 5, 3, '#5D4037');
    // Legs
    drawRect(x - 3, y - 12, 4, 10, '#636e72');
    drawRect(x + 3, y - 12, 4, 10, '#636e72');
    // Body / cardigan
    drawRect(x - 6, y - 30, 16, 20, '#b2bec3');
    // Cardigan front
    drawRect(x - 5, y - 28, 14, 16, '#dfe6e9');
    // Buttons
    for (let b = 0; b < 3; b++) {
      drawCircle(x + 2, y - 25 + b * 5, 1, '#636e72');
    }
    // Head
    drawCircle(x + 2, y - 35, 7, '#fad0b4');
    // Hair bun
    drawCircle(x + 2, y - 40, 5, '#ccc');
    drawCircle(x - 1, y - 41, 3.5, '#ddd');
    // Glasses
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + 5, y - 35, 3, 0, Math.PI * 2);
    ctx.arc(x, y - 35, 3, 0, Math.PI * 2);
    ctx.moveTo(x + 2, y - 35);
    ctx.lineTo(x + 3, y - 35);
    ctx.stroke();
    // Blush
    drawCircle(x + 7, y - 33, 2, 'rgba(255,130,130,0.3)');
    // Walking stick
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 12, y - 24);
    ctx.lineTo(x + 16, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 10, y - 24, 3, -Math.PI * 0.5, Math.PI * 0.3);
    ctx.stroke();
    // Handbag
    drawRect(x - 8, y - 22, 5, 7, '#8B4513');
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x - 5.5, y - 24, 3, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawRat(x, y) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 12, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    drawEllipse(x, y - 4, 11, 6, '#636e72');
    // Head
    drawEllipse(x + 10, y - 5, 6, 5, '#6e7a80');
    // Ears
    drawCircle(x + 11, y - 10, 3.5, '#b2bec3');
    drawCircle(x + 11, y - 10, 2, '#e8b4b4');
    drawCircle(x + 14, y - 9, 2.5, '#b2bec3');
    drawCircle(x + 14, y - 9, 1.5, '#e8b4b4');
    // Eye
    drawCircle(x + 13, y - 6, 1.3, '#c0392b');
    drawCircle(x + 13.3, y - 6.3, 0.4, '#fff');
    // Nose
    drawCircle(x + 16, y - 4, 1.2, '#2d3436');
    // Whiskers
    ctx.strokeStyle = 'rgba(200,200,200,0.5)';
    ctx.lineWidth = 0.5;
    for (let w = -1; w <= 1; w++) {
      ctx.beginPath();
      ctx.moveTo(x + 15, y - 4);
      ctx.lineTo(x + 22, y - 5 + w * 2);
      ctx.stroke();
    }
    // Tail
    ctx.strokeStyle = '#b2bec3';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 4);
    ctx.quadraticCurveTo(x - 18, y - 14 + Math.sin(frameCount * 0.15) * 3, x - 22, y - 8);
    ctx.stroke();
    // Legs (animated)
    const legAnim = Math.sin(frameCount * 0.25) * 2;
    drawRect(x - 5, y - 1 + legAnim, 3, 3, '#555');
    drawRect(x + 4, y - 1 - legAnim, 3, 3, '#555');
    ctx.restore();
  }

  function drawCat(x, y) {
    ctx.save();
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 12, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    drawEllipse(x, y - 7, 11, 8, '#ff9f43');
    // Head
    drawCircle(x + 11, y - 13, 7, '#ff9f43');
    // Ears
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.moveTo(x + 7, y - 18); ctx.lineTo(x + 5, y - 26); ctx.lineTo(x + 11, y - 19);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 13, y - 18); ctx.lineTo(x + 16, y - 26); ctx.lineTo(x + 17, y - 18);
    ctx.fill();
    // Inner ears
    ctx.fillStyle = '#fab1a0';
    ctx.beginPath();
    ctx.moveTo(x + 8, y - 18); ctx.lineTo(x + 7, y - 23); ctx.lineTo(x + 10, y - 19);
    ctx.fill();
    // Eyes
    drawCircle(x + 9, y - 13, 1.5, '#2d3436');
    drawCircle(x + 14, y - 13, 1.5, '#2d3436');
    drawCircle(x + 9.3, y - 13.3, 0.4, '#fff');
    drawCircle(x + 14.3, y - 13.3, 0.4, '#fff');
    // Nose
    ctx.fillStyle = '#e17055';
    ctx.beginPath();
    ctx.moveTo(x + 11, y - 11); ctx.lineTo(x + 10, y - 10); ctx.lineTo(x + 12, y - 10);
    ctx.fill();
    // Tail
    ctx.strokeStyle = '#ff9f43';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 7);
    ctx.quadraticCurveTo(x - 18, y - 22 + Math.sin(frameCount * 0.06) * 5, x - 13, y - 26);
    ctx.stroke();
    // Legs
    drawRect(x - 6, y - 2, 3, 4, '#e17055');
    drawRect(x + 5, y - 2, 3, 4, '#e17055');
    ctx.restore();
  }

  function drawDog(x, y) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 14, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body
    drawEllipse(x, y - 8, 14, 9, '#dfe6e9');
    // Spots
    drawCircle(x - 4, y - 7, 3.5, '#636e72');
    drawCircle(x + 5, y - 11, 3, '#636e72');
    // Head
    drawCircle(x + 14, y - 13, 8, '#dfe6e9');
    // Ear patch
    drawCircle(x + 18, y - 14, 4, '#636e72');
    // Floppy ear
    drawEllipse(x + 20, y - 10, 4, 7, '#b2bec3');
    // Eye
    drawCircle(x + 13, y - 14, 2, '#2d3436');
    drawCircle(x + 13.4, y - 14.4, 0.6, '#fff');
    // Nose
    drawCircle(x + 20, y - 13, 2.5, '#2d3436');
    // Tongue
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.ellipse(x + 19, y - 8 + Math.sin(frameCount * 0.1) * 0.5, 2, 3.5, 0.2, 0, Math.PI);
    ctx.fill();
    // Tail (wagging)
    const wag = Math.sin(frameCount * 0.2) * 0.5;
    ctx.strokeStyle = '#dfe6e9';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 13, y - 8);
    ctx.quadraticCurveTo(x - 20, y - 22 + wag * 12, x - 16, y - 27);
    ctx.stroke();
    // Legs
    drawRect(x - 8, y - 2, 4, 5, '#b2bec3');
    drawRect(x + 7, y - 2, 4, 5, '#b2bec3');
    // Collar
    drawRect(x + 8, y - 12, 10, 2, '#e74c3c');
  }

  function drawMali(x, y, squeakTimer) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs
    drawRect(x - 4, y - 6, 4, 7, '#e8b88a');
    drawRect(x + 2, y - 6, 4, 7, '#e8b88a');
    // Shoes
    drawRect(x - 5, y - 2, 5, 3, '#e74c3c');
    drawRect(x + 1, y - 2, 5, 3, '#e74c3c');
    // Body — cute purple dress
    ctx.fillStyle = '#9b59b6';
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 18);
    ctx.lineTo(x + 8, y - 18);
    ctx.lineTo(x + 10, y - 6);
    ctx.lineTo(x - 10, y - 6);
    ctx.closePath();
    ctx.fill();
    // Dress pattern — white dots
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    drawCircle(x - 3, y - 14, 1, 'rgba(255,255,255,0.4)');
    drawCircle(x + 3, y - 10, 1, 'rgba(255,255,255,0.4)');
    drawCircle(x - 1, y - 8, 1, 'rgba(255,255,255,0.4)');
    // Arms
    ctx.strokeStyle = '#e8b88a';
    ctx.lineWidth = 2.5;
    const wave = Math.sin(frameCount * 0.15) * 0.3;
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 16);
    ctx.lineTo(x - 13, y - 10 + wave * 5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 7, y - 16);
    ctx.lineTo(x + 13, y - 10 - wave * 5);
    ctx.stroke();
    // Head
    drawCircle(x, y - 24, 8, '#f0c8a0');
    // Rosy cheeks
    drawCircle(x - 5, y - 22, 2, 'rgba(255,130,130,0.35)');
    drawCircle(x + 5, y - 22, 2, 'rgba(255,130,130,0.35)');
    // Eyes — big and expressive
    drawCircle(x - 3, y - 25, 2.2, '#fff');
    drawCircle(x + 3, y - 25, 2.2, '#fff');
    drawCircle(x - 3, y - 25, 1.3, '#5a3825');
    drawCircle(x + 3, y - 25, 1.3, '#5a3825');
    drawCircle(x - 2.6, y - 25.3, 0.5, '#fff');
    drawCircle(x + 3.4, y - 25.3, 0.5, '#fff');
    // Happy mouth
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y - 21, 3, 0.1, Math.PI - 0.1);
    ctx.stroke();
    // Hair — dark brown pigtails
    drawCircle(x, y - 30, 5, '#5a3825');
    drawCircle(x - 2, y - 31, 4, '#5a3825');
    drawCircle(x + 2, y - 31, 4, '#5a3825');
    // Pigtails
    ctx.strokeStyle = '#5a3825';
    ctx.lineWidth = 3;
    const pigtailWave = Math.sin(frameCount * 0.08) * 2;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 28);
    ctx.quadraticCurveTo(x - 14, y - 26 + pigtailWave, x - 12, y - 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 28);
    ctx.quadraticCurveTo(x + 14, y - 26 - pigtailWave, x + 12, y - 18);
    ctx.stroke();
    // Hair bows — pink
    drawCircle(x - 10, y - 22, 2.5, '#ff69b4');
    drawCircle(x + 10, y - 22, 2.5, '#ff69b4');

    // Speech bubble when squeaking
    if (squeakTimer > 0) {
      const alpha = Math.min(1, squeakTimer / 20);
      const bubbleX = x + 18;
      const bubbleY = y - 52;
      const bubbleW = 108;
      const bubbleH = 22;
      const bounce = Math.sin(squeakTimer * 0.3) * 1.5;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Bubble background
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#9b59b6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bubbleX - bubbleW / 2 + 6, bubbleY - bubbleH / 2 + bounce);
      ctx.lineTo(bubbleX + bubbleW / 2 - 6, bubbleY - bubbleH / 2 + bounce);
      ctx.quadraticCurveTo(bubbleX + bubbleW / 2, bubbleY - bubbleH / 2 + bounce, bubbleX + bubbleW / 2, bubbleY - bubbleH / 2 + 6 + bounce);
      ctx.lineTo(bubbleX + bubbleW / 2, bubbleY + bubbleH / 2 - 6 + bounce);
      ctx.quadraticCurveTo(bubbleX + bubbleW / 2, bubbleY + bubbleH / 2 + bounce, bubbleX + bubbleW / 2 - 6, bubbleY + bubbleH / 2 + bounce);
      ctx.lineTo(bubbleX - bubbleW / 2 + 6, bubbleY + bubbleH / 2 + bounce);
      ctx.quadraticCurveTo(bubbleX - bubbleW / 2, bubbleY + bubbleH / 2 + bounce, bubbleX - bubbleW / 2, bubbleY + bubbleH / 2 - 6 + bounce);
      ctx.lineTo(bubbleX - bubbleW / 2, bubbleY - bubbleH / 2 + 6 + bounce);
      ctx.quadraticCurveTo(bubbleX - bubbleW / 2, bubbleY - bubbleH / 2 + bounce, bubbleX - bubbleW / 2 + 6, bubbleY - bubbleH / 2 + bounce);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Tail pointing down to Mali
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(bubbleX - 12, bubbleY + bubbleH / 2 + bounce);
      ctx.lineTo(bubbleX - 6, bubbleY + bubbleH / 2 + 8 + bounce);
      ctx.lineTo(bubbleX - 2, bubbleY + bubbleH / 2 + bounce);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#9b59b6';
      ctx.beginPath();
      ctx.moveTo(bubbleX - 12, bubbleY + bubbleH / 2 + bounce);
      ctx.lineTo(bubbleX - 6, bubbleY + bubbleH / 2 + 8 + bounce);
      ctx.lineTo(bubbleX - 2, bubbleY + bubbleH / 2 + bounce);
      ctx.stroke();

      // Text
      ctx.fillStyle = '#9b59b6';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Mali Squeak Squeak', bubbleX, bubbleY + 4 + bounce);
      ctx.textAlign = 'left';

      ctx.restore();
    }
  }

  function spawnMali() {
    malis.push({
      x: W + 40,
      y: GROUND_Y,
      squeakTimer: 0,
      squeakCooldown: 60 + Math.floor(Math.random() * 80),
      hasSqueaked: false,
    });
  }

  function drawCoin(x, y, bobOffset) {
    const cy = y + Math.sin(frameCount * 0.08 + bobOffset) * 5;
    // Glow
    const glowGrad = ctx.createRadialGradient(x, cy, 0, x, cy, 16);
    glowGrad.addColorStop(0, 'rgba(255,215,0,0.2)');
    glowGrad.addColorStop(1, 'rgba(255,215,0,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(x - 16, cy - 16, 32, 32);
    // Coin squish (rotation illusion)
    const squish = 0.6 + Math.abs(Math.sin(frameCount * 0.04 + bobOffset)) * 0.4;
    ctx.save();
    ctx.translate(x, cy);
    ctx.scale(squish, 1);
    // Outer
    drawCircle(0, 0, 10, '#ffd700');
    drawCircle(0, 0, 7, '#f0c000');
    // Shine
    drawCircle(-2, -2, 2.5, '#fff3a0');
    // Pound symbol
    ctx.fillStyle = '#b8860b';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('£', 0.5, 1);
    ctx.restore();
  }

  // ─── Obstacle / Coin / Power-up Types ──────────────────────────────

  const OBSTACLE_TYPES = [
    { type: 'hedgehog', w: 26, h: 14, ground: true },
    { type: 'oldperson', w: 22, h: 40, ground: true },
    { type: 'rat', w: 26, h: 12, ground: true },
  ];

  function spawnObstacle() {
    const def = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    obstacles.push({
      x: W + 30,
      y: GROUND_Y,
      w: def.w,
      h: def.h,
      type: def.type,
      hasSounded: false,
      soundDelay: 30 + Math.floor(Math.random() * 50),
    });
  }

  function spawnCoin() {
    const high = Math.random() > 0.4;
    coinItems.push({
      x: W + 30,
      y: high ? GROUND_Y - 55 - Math.random() * 35 : GROUND_Y - 22,
      bobOffset: Math.random() * 6,
      collected: false,
    });
  }

  function spawnCoinRow() {
    const high = Math.random() > 0.5;
    const baseY = high ? GROUND_Y - 60 : GROUND_Y - 22;
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
      coinItems.push({
        x: W + 30 + i * 22,
        y: baseY - Math.sin(i * 0.5) * 15,
        bobOffset: i * 0.5,
        collected: false,
      });
    }
  }

  function spawnAnimal() {
    const isCat = Math.random() > 0.5;
    animals.push({
      x: W + 30,
      y: GROUND_Y,
      type: isCat ? 'cat' : 'dog',
      w: isCat ? 22 : 28,
      h: isCat ? 26 : 18,
      hasSounded: false,
      soundDelay: 40 + Math.floor(Math.random() * 60),
    });
  }

  // ─── Collision ─────────────────────────────────────────────────────

  function boxCollision(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by && ay + ah > by - bh;
  }

  // ─── Game Init / Reset ─────────────────────────────────────────────

  function resetGame() {
    coins = 0;
    distance = 0;
    lives = 3;
    speed = 3.2;
    frameCount = 0;
    invincibleTimer = 0;
    difficultyTimer = 0;
    combo = 0;
    comboTimer = 0;
    zoneType = 'city';
    zoneTimer = 0;
    elin.y = GROUND_Y;
    elin.vy = 0;
    elin.jumping = false;
    elin.ducking = false;
    elin.tilt = 0;
    airTapsUsed = 0;
    airTapCooldown = 0;
    obstacles = [];
    coinItems = [];
    animals = [];
    lastCharSoundFrame = 0;
    activeCallouts = [];
    lastCalloutFrame = 0;
    malis = [];
    particles = [];
    speedLines = [];
    initScenery();
  }

  // ─── Input Handling ────────────────────────────────────────────────

  let jumpPressed = false;
  let duckPressed = false;

  document.addEventListener('keydown', (e) => {
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
    if (e.code === 'ArrowDown') {
      duckPressed = false;
    }
  });

  function addTouchEvents(btn, onDown, onUp) {
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); onUp(); }, { passive: false });
    btn.addEventListener('touchcancel', (e) => { e.preventDefault(); onUp(); }, { passive: false });
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
    finalScoreEl.textContent = coins;
    finalDistEl.textContent = `${Math.floor(distance)}m`;
    if (coins > hiScore) {
      hiScore = coins;
      localStorage.setItem('elinBikeHiScore', String(hiScore));
      goRankEl.textContent = 'New High Score!';
    } else {
      goRankEl.textContent = getRank(coins);
    }
    finalBestEl.textContent = hiScore;
    gameOverScreen.classList.add('active');
    updateHiScoreDisplay();
    stopMusic();
  }

  function getRank(c) {
    if (c >= 50) return 'London Legend!';
    if (c >= 30) return 'Expert Cyclist';
    if (c >= 15) return 'Pedal Pro';
    if (c >= 5) return 'Getting the Hang of It';
    return 'Keep Practising!';
  }

  function updateHUD() {
    coinCountEl.querySelector('.hud-val').textContent = coins;
    distCountEl.textContent = `${Math.floor(distance)}m`;
    livesCountEl.innerHTML = '';
    for (let i = 0; i < lives; i++) {
      livesCountEl.innerHTML += '&#10084; ';
    }
    if (combo > 1 && comboTimer > 0) {
      comboCountEl.textContent = `x${combo}`;
      comboCountEl.style.opacity = '1';
    } else {
      comboCountEl.style.opacity = '0';
    }
    const pct = Math.min(100, ((speed - 3.2) / 3.8) * 100);
    speedFillEl.style.width = pct + '%';
  }

  // ─── Game Loop ─────────────────────────────────────────────────────

  function update() {
    if (state !== 'playing') return;

    frameCount++;
    distance += speed * 0.05;
    difficultyTimer++;

    // Zone cycling
    zoneTimer++;
    if (zoneTimer > 1200) {
      zoneTimer = 0;
      const zones = ['city', 'park', 'bridge'];
      const cur = zones.indexOf(zoneType);
      zoneType = zones[(cur + 1) % zones.length];
    }

    // Speed ramp
    if (difficultyTimer % 600 === 0 && speed < 7) {
      speed += 0.15;
    }

    // Combo decay
    if (comboTimer > 0) {
      comboTimer--;
      if (comboTimer <= 0) combo = 0;
    }

    // ── Elin physics ──
    if (airTapCooldown > 0) airTapCooldown--;

    if (jumpPressed && !elin.jumping) {
      // Ground jump
      elin.vy = JUMP_FORCE;
      elin.jumping = true;
      elin.wasInAir = true;
      airTapsUsed = 0;
      jumpPressed = false;
      playJumpSound();
      // Jump dust
      spawnParticles(elin.x + 5, GROUND_Y, 6, '#b2bec3', {
        speed: 2, upward: 1, life: 15, gravity: 0.1, size: 2,
      });
    } else if (jumpPressed && elin.jumping && airTapsUsed < MAX_AIR_TAPS && airTapCooldown <= 0) {
      // Air burst tap – small upward boost
      elin.vy = Math.min(elin.vy, 0) + AIR_TAP_FORCE;
      airTapsUsed++;
      airTapCooldown = AIR_TAP_COOLDOWN;
      jumpPressed = false;
      playJumpSound();
      // Air tap feedback – small puff below the bike
      spawnParticles(elin.x + 10, elin.y + elin.h, 4, '#dfe6e9', {
        speed: 1.2, upward: -0.3, life: 10, gravity: 0.05, size: 1.5,
      });
    }
    jumpPressed = false;

    elin.ducking = duckPressed && !elin.jumping;

    elin.vy += GRAVITY;
    elin.y += elin.vy;
    if (elin.y >= GROUND_Y) {
      if (elin.wasInAir && elin.y !== GROUND_Y) {
        // Landing effects
        playLandSound();
        spawnParticles(elin.x + 5, GROUND_Y, 4, '#999', {
          speed: 1.5, upward: 0.5, life: 12, gravity: 0.12, size: 1.5,
        });
        triggerShake(2, 4);
      }
      elin.y = GROUND_Y;
      elin.vy = 0;
      elin.jumping = false;
      elin.wasInAir = false;
      airTapsUsed = 0;
      airTapCooldown = 0;
    }

    // Invincibility
    if (invincibleTimer > 0) invincibleTimer--;

    // Clouds
    for (const c of clouds) {
      c.x -= c.speed + speed * 0.02;
      if (c.x + c.w < -30) {
        c.x = W + 50;
        c.y = 20 + Math.random() * 70;
      }
    }

    // Spawn obstacles
    const spawnRate = Math.max(50, 130 - difficultyTimer * 0.012);
    if (frameCount % Math.floor(spawnRate) === 0) {
      spawnObstacle();
    }

    // Spawn coins (sometimes in rows)
    if (frameCount % 40 === 0) {
      if (Math.random() > 0.75) {
        spawnCoinRow();
      } else {
        spawnCoin();
      }
    }

    // Spawn animals
    if (frameCount % 280 === 0) spawnAnimal();

    // Spawn Mali occasionally (every ~8-14 seconds)
    if (frameCount % 600 === 200 && Math.random() < 0.55) spawnMali();

    // Move & update Mali
    for (let i = malis.length - 1; i >= 0; i--) {
      malis[i].x -= speed * 0.5;
      if (malis[i].squeakCooldown > 0) {
        malis[i].squeakCooldown--;
      } else if (!malis[i].hasSqueaked && malis[i].x < W - 50 && malis[i].x > 50) {
        malis[i].squeakTimer = 120;
        malis[i].hasSqueaked = true;
        playSqueakSound();
        // Squeak particles — little pink stars
        spawnParticles(malis[i].x, malis[i].y - 40, 6, '#ff69b4', {
          speed: 2, upward: 1.5, life: 25, gravity: 0.02, type: 'star', size: 2,
        });
      }
      if (malis[i].squeakTimer > 0) malis[i].squeakTimer--;
      if (malis[i].x < -60) malis.splice(i, 1);
    }

    // Move obstacles & trigger ambient sounds
    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= speed;
      if (obstacles[i].x < -50) {
        obstacles.splice(i, 1);
        continue;
      }
      // Ambient character sound when approaching (30% chance per obstacle)
      const ob = obstacles[i];
      if (!ob.hasSounded && ob.x < W - 40 && ob.x > 100) {
        if (ob.soundDelay > 0) { ob.soundDelay--; }
        else if (Math.random() < 0.3 && canPlayCharSound()) {
          ob.hasSounded = true;
          if (ob.type === 'rat') playRatSound();
          else if (ob.type === 'hedgehog') playHedgehogSound();
          else if (ob.type === 'oldperson') playGrannySound();
        }
      }
      if (invincibleTimer <= 0) {
        const o = obstacles[i];
        const eH = elin.ducking ? elin.duckH : elin.h;
        const eY = elin.y - eH;
        if (boxCollision(elin.x - 8, eY, 36, eH, o.x - o.w / 2, o.y, o.w, o.h)) {
          lives--;
          invincibleTimer = 100;
          combo = 0;
          comboTimer = 0;
          playHitSound();
          playBabble();
          triggerShake(6, 12);
          // Hit particles
          spawnParticles(elin.x + 10, elin.y - 20, 12, '#ff6b6b', {
            speed: 4, spread: 15, life: 20, gravity: 0.05, type: 'star', size: 3,
          });
          if (lives <= 0) {
            state = 'gameover';
            showGameOver();
            return;
          }
        }
      }
    }

    // Move coins
    for (let i = coinItems.length - 1; i >= 0; i--) {
      coinItems[i].x -= speed;
      if (coinItems[i].x < -30) {
        coinItems.splice(i, 1);
        continue;
      }
      if (!coinItems[i].collected) {
        const c = coinItems[i];
        const cy = c.y + Math.sin(frameCount * 0.08 + c.bobOffset) * 5;
        const eH = elin.ducking ? elin.duckH : elin.h;
        if (boxCollision(elin.x - 5, elin.y - eH, 32, eH, c.x - 10, cy + 10, 20, 20)) {
          coinItems[i].collected = true;
          coins++;
          // Combo
          if (frameCount - lastCoinFrame < 40) {
            combo++;
            if (combo > 1) playComboSound(Math.min(combo, 8));
          } else {
            combo = 1;
          }
          comboTimer = 60;
          lastCoinFrame = frameCount;
          playCoinSound();
          // Coin burst
          spawnParticles(c.x, cy, 8, '#ffd700', {
            speed: 3, upward: 1, life: 18, gravity: 0.04, type: 'star', size: 2.5,
          });
        }
      }
    }

    // Move animals & trigger sounds
    for (let i = animals.length - 1; i >= 0; i--) {
      const a = animals[i];
      a.x -= speed * 0.65;
      if (a.x < -50) { animals.splice(i, 1); continue; }
      // Sound trigger: when on-screen, after random delay, with global cooldown
      if (!a.hasSounded && a.x < W - 20 && a.x > 60) {
        if (a.soundDelay > 0) { a.soundDelay--; }
        else if (canPlayCharSound()) {
          a.hasSounded = true;
          if (a.type === 'cat') playCatSound();
          else playDogSound();
        }
      }
    }

    // Voice callouts — occasional encouraging shouts
    updateCallouts();
    if (frameCount - lastCalloutFrame > CALLOUT_COOLDOWN && Math.random() < CALLOUT_CHANCE) {
      triggerCallout();
    }

    // Babble
    if (frameCount - lastBabbleTime > 500 + Math.random() * 400) {
      playBabble();
      lastBabbleTime = frameCount;
    }

    // Speed lines & particles
    updateSpeedLines();
    updateParticles();

    // Screen shake
    if (shakeTimer > 0) shakeTimer--;

    updateHUD();
  }

  function draw() {
    ctx.save();

    // Screen shake
    let sx = 0, sy = 0;
    if (shakeTimer > 0) {
      sx = (Math.random() - 0.5) * shakeIntensity;
      sy = (Math.random() - 0.5) * shakeIntensity;
    }

    ctx.translate(offsetX + sx * scale, offsetY + sy * scale);
    ctx.scale(scale, scale);

    // Clear
    ctx.clearRect(-10, -10, W + 20, H + 20);

    // Draw layers back to front
    drawSky();
    drawFarHills();
    drawClouds();
    drawBus(350);
    drawBuildings();
    drawPhoneBox(180);
    drawPhoneBox(550);
    drawPostbox(380);
    drawForegroundItems();
    drawGround();
    drawSpeedLines();

    // Animals
    for (const a of animals) {
      if (a.type === 'cat') drawCat(a.x, a.y);
      else drawDog(a.x, a.y);
    }

    // Mali
    for (const m of malis) {
      drawMali(m.x, m.y, m.squeakTimer);
    }

    // Coins
    for (const c of coinItems) {
      if (!c.collected) drawCoin(c.x, c.y, c.bobOffset);
    }

    // Obstacles
    for (const o of obstacles) {
      if (o.type === 'hedgehog') drawHedgehog(o.x, o.y);
      else if (o.type === 'oldperson') drawOldPerson(o.x, o.y);
      else if (o.type === 'rat') drawRat(o.x, o.y);
    }

    // Elin
    drawElin();

    // Particles (on top)
    drawParticles();

    // Voice callouts (floating text)
    drawCallouts();

    // Vignette overlay
    const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

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
  draw();
  gameLoop();

})();

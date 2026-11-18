// Frostpeak Drift — main.js
// The game loop: input, camera, snow, bullets, skid marks, and the state
// machine that ties the world, player, vehicles, police and missions together.

import { createWorld, drawWorld } from './world.js';
import { createPlayer, updatePlayer, drawPlayer } from './player.js';
import { createVehicles, updateVehicles, drawVehicles } from './vehicles.js';
import { createPolice, initPedestrians, updatePolice, drawPolice, addWanted, clearWanted } from './police.js';
import { createMissions, startMission, updateMissions, drawMissionLayer } from './missions.js';
import { drawHUD, drawTitle, drawPause, drawEndScreen } from './hud.js';
import { createAudio } from './audio.js';
import { saveGame, loadGame, hasSave } from './storage.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const G = {
  view: { w: 1280, h: 720 },
  world: createWorld(),
  time: 0,
  clock: 8 * 60, // in-game clock starts at 08:00
  state: 'title', // title | playing | paused | busted | wasted | complete
  cam: { x: 0, y: 0, w: 1280, h: 720 },
  input: {
    up: false, down: false, left: false, right: false,
    handbrake: false, punch: false, shoot: false,
    enterPressed: false, mouseX: 640, mouseY: 360,
  },
  player: null,
  cars: [],
  plow: null,
  rivalCar: null,
  courier: null,
  race: null,
  cops: null,
  police: null,
  missions: null,
  bullets: [],
  pickups: [],
  particles: [],
  skids: [],
  snow: [],
  notices: [],
  dialog: null,
  objective: '',
  wanted: 0,
  blizzard: false,
  audio: createAudio(),
  hasSave: hasSave(),
  saveGame() { saveGame(G); },
};

G.player = createPlayer(G.world.spawns.player);
G.police = createPolice();
G.police.addWanted = addWanted;
G.police.clearWanted = clearWanted;
G.cops = G.police; // missions/player code reads G.cops.foot
G.missions = createMissions();
G.cars = createVehicles(G);
initPedestrians(G);
seedPickups(G);
seedSnow(G);

// Test and debug handle: the state is readable from the console and from
// automated playtests. It never changes the game on its own.
window.__frost = G;

function seedPickups(G) {
  const spots = [
    { x: 850, y: 1080, kind: 'health' },
    { x: 1900, y: 1420, kind: 'health' },
    { x: 1600, y: 600, kind: 'ammo' },
    { x: 2400, y: 1080, kind: 'ammo' },
    { x: 500, y: 1900, kind: 'ammo' },
    { x: 1100, y: 1420, kind: 'cash' },
    { x: 2300, y: 600, kind: 'cash' },
    { x: 2700, y: 1500, kind: 'cash' },
  ];
  G.pickups = spots.map((s) => ({ ...s, bob: Math.random() * Math.PI * 2 }));
}

function seedSnow(G) {
  for (let i = 0; i < 220; i++) {
    G.snow.push({
      x: Math.random() * G.view.w,
      y: Math.random() * G.view.h,
      s: 1 + Math.random() * 2.5,
      v: 30 + Math.random() * 50,
      drift: Math.random() * Math.PI * 2,
    });
  }
}

G.say = (text, speaker) => {
  G.dialog = { text, speaker: speaker || 'Raka', timer: 0 };
};

G.notify = (text) => {
  G.notices.push({ text, life: 4 });
  if (G.notices.length > 5) G.notices.shift();
};

// ---------------------------------------------------------------- input

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'handbrake',
};

window.addEventListener('keydown', (e) => {
  G.audio.init();
  if (e.code === 'Space') e.preventDefault();
  const dir = KEYMAP[e.code];
  if (dir) G.input[dir] = true;
  if (e.code === 'KeyF') G.input.punch = true;
  if (e.code === 'KeyE' && !e.repeat) G.input.enterPressed = true;
  if (e.code === 'KeyM' && !e.repeat) {
    G.audio.setMuted(!G.audio.muted);
    G.notify(G.audio.muted ? 'Suara dimatikan (M).' : 'Suara dinyalakan (M).');
  }
  if (e.code === 'KeyP' && !e.repeat) {
    if (G.state === 'playing') {
      G.state = 'paused';
      G.audio.engine(0, false);
      G.audio.siren(false);
    } else if (G.state === 'paused') {
      G.state = 'playing';
      G.audio.siren(G.wanted > 0);
    }
  }
  if (e.code === 'Enter' && !e.repeat) {
    if (G.state === 'title') beginGame(false);
    else if (G.state === 'busted' || G.state === 'wasted' || G.state === 'complete') restartGame();
  }
  if (e.code === 'KeyL' && !e.repeat && G.state === 'title') beginGame(true);
  if (e.code === 'KeyR' && !e.repeat && G.state === 'paused') restartGame();
  if (G.dialog && (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE')) {
    // A keypress dismisses the dialog box; it does not skip the game.
    if (G.state === 'playing') G.dialog = null;
  }
});

window.addEventListener('keyup', (e) => {
  const dir = KEYMAP[e.code];
  if (dir) G.input[dir] = false;
  if (e.code === 'KeyF') G.input.punch = false;
});

canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  G.input.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
  G.input.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
});

canvas.addEventListener('mousedown', (e) => {
  G.audio.init();
  if (G.state === 'title') {
    beginGame(false);
    return;
  }
  if (G.state === 'playing' && !G.player.inCar) {
    G.input.shoot = true;
  }
});

function beginGame(fromSave) {
  G.audio.init();
  if (fromSave) {
    const data = loadGame();
    if (data) {
      G.player.money = data.money;
      G.player.health = data.health;
      G.player.ammo = data.ammo;
      G.player.x = data.x;
      G.player.y = data.y;
      G.clock = data.clock || G.clock;
      G.missions.index = Math.min(data.mission, 5);
      G.notify('Lanjutan dimuat dari simpanan.');
    }
  }
  G.state = 'playing';
  startMission(G, G.missions.index);
}

function restartGame() {
  G.player = createPlayer(G.world.spawns.player);
  G.police = createPolice();
  G.police.addWanted = addWanted;
  G.police.clearWanted = clearWanted;
  G.cops = G.police;
  G.missions = createMissions();
  G.cars = createVehicles(G);
  initPedestrians(G);
  seedPickups(G);
  G.bullets = [];
  G.particles = [];
  G.skids = [];
  G.notices = [];
  G.dialog = null;
  G.wanted = 0;
  G.blizzard = false;
  G.race = null;
  G.courier = null;
  G.clock = 8 * 60;
  G.audio.siren(false);
  G.audio.engine(0, false);
  G.state = 'playing';
  startMission(G, 0);
}

// ---------------------------------------------------------------- update

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  G.time += dt;
  if (G.state === 'playing') {
    update(dt);
  }
  render();
  requestAnimationFrame(frame);
}

function update(dt) {
  G.clock += dt * 2; // one real second is two game-minutes
  if (G.dialog) G.dialog.timer += dt;

  updatePlayer(G, dt);
  updateVehicles(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);

  // Bullets fly straight and die on buildings or after their life ends.
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    const hitWall = G.world.buildings.some(
      (bd) => b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h,
    );
    if (b.life <= 0 || hitWall || b.x < 0 || b.y < 0 || b.x > G.world.w || b.y > G.world.h) {
      G.bullets.splice(i, 1);
    }
  }

  // Particles fade.
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const pt = G.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) G.particles.splice(i, 1);
  }
  for (let i = G.skids.length - 1; i >= 0; i--) {
    G.skids[i].life -= dt;
    if (G.skids[i].life <= 0) G.skids.splice(i, 1);
  }

  // Notifications fade.
  for (let i = G.notices.length - 1; i >= 0; i--) {
    G.notices[i].life -= dt;
    if (G.notices[i].life <= 0) G.notices.splice(i, 1);
  }

  // Snow falls; in a blizzard it falls faster and sideways.
  const wind = G.blizzard ? 160 : 24;
  for (const flake of G.snow) {
    flake.y += flake.v * (G.blizzard ? 2.2 : 1) * dt;
    flake.x += Math.sin(G.time + flake.drift) * 18 * dt + wind * dt * 0.2;
    if (flake.y > G.view.h + 4) {
      flake.y = -4;
      flake.x = Math.random() * G.view.w;
    }
    if (flake.x > G.view.w + 4) flake.x = -4;
    if (flake.x < -4) flake.x = G.view.w + 4;
  }

  // Camera follows the player, clamped to the world.
  const p = G.player;
  const tx = p.x - G.view.w / 2;
  const ty = p.y - G.view.h / 2;
  G.cam.x += (tx - G.cam.x) * Math.min(1, 6 * dt);
  G.cam.y += (ty - G.cam.y) * Math.min(1, 6 * dt);
  G.cam.x = Math.max(0, Math.min(G.world.w - G.view.w, G.cam.x));
  G.cam.y = Math.max(0, Math.min(G.world.h - G.view.h, G.cam.y));

  // Engine hum stops when not driving.
  if (!p.inCar) G.audio.engine(0, false);
}

// ---------------------------------------------------------------- render

function render() {
  ctx.clearRect(0, 0, G.view.w, G.view.h);
  if (G.state === 'title') {
    drawTitle(ctx, G);
    drawSnowOverlay();
    return;
  }

  ctx.save();
  ctx.translate(-Math.round(G.cam.x), -Math.round(G.cam.y));

  drawWorld(ctx, G.cam, G.world, G.time);

  // Skid marks.
  for (const s of G.skids) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.7, s.life / s.max);
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = '#2c2f36';
    ctx.fillRect(-14, -3, 28, 5);
    ctx.restore();
  }

  drawMissionLayer(ctx, G);

  // Pickups bob gently.
  for (const pk of G.pickups) {
    const bob = Math.sin(G.time * 3 + pk.bob) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = pk.kind === 'health' ? '#e33' : pk.kind === 'ammo' ? '#f5d76e' : '#7ee787';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'health' ? '+' : pk.kind === 'ammo' ? 'A' : '$', 0, 5);
    ctx.restore();
  }

  drawVehicles(ctx, G);
  drawPolice(ctx, G);
  drawPlayer(ctx, G);

  // Bullets.
  for (const b of G.bullets) {
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles.
  for (const pt of G.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / pt.max);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();

  // Blizzard fog: a pale veil that shrinks visibility.
  if (G.blizzard && G.state === 'playing') {
    const cx = G.view.w / 2;
    const cy = G.view.h / 2;
    const grad = ctx.createRadialGradient(cx, cy, 120, cx, cy, 620);
    grad.addColorStop(0, 'rgba(220,232,245,0)');
    grad.addColorStop(1, 'rgba(220,232,245,0.75)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, G.view.w, G.view.h);
  }

  drawSnowOverlay();

  if (G.state === 'playing' || G.state === 'paused') {
    drawHUD(ctx, G);
  }
  if (G.state === 'paused') drawPause(ctx, G);
  if (G.state === 'busted') drawEndScreen(ctx, G, 'busted');
  if (G.state === 'wasted') drawEndScreen(ctx, G, 'wasted');
  if (G.state === 'complete') drawEndScreen(ctx, G, 'complete');
}

function drawSnowOverlay() {
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (const flake of G.snow) {
    ctx.fillRect(flake.x, flake.y, flake.s, flake.s);
  }
}

// Start the loop.
requestAnimationFrame(frame);

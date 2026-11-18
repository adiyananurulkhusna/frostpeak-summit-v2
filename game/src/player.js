// Frostpeak Drift — player.js
// Raka on foot: walking, punching, shooting, health, money and pickups.

import { resolveCollision, surfaceAt } from './world.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: 14,
    health: 100,
    maxHealth: 100,
    money: 50,
    ammo: 24,
    speed: 185,
    inCar: null, // the vehicle object Raka is driving, or null
    punchTimer: 0,
    punchCooldown: 0,
    shootCooldown: 0,
    hurtTimer: 0,
    walking: false,
    moving: false,
  };
}

// Direction the player wants to walk, from the input state.
function inputVector(input) {
  let x = 0;
  let y = 0;
  if (input.left) x -= 1;
  if (input.right) x += 1;
  if (input.up) y -= 1;
  if (input.down) y += 1;
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  if (p.inCar) return; // driving is handled by vehicles.js
  const iv = inputVector(G.input);
  p.moving = iv.x !== 0 || iv.y !== 0;
  const ground = surfaceAt(G.world, p.x, p.y);
  // Even on foot, ice is slippery: Raka slides a little.
  const accel = ground === 'ice' ? 900 : 1500;
  const friction = ground === 'ice' ? 2.2 : 7;
  p.vx += iv.x * accel * dt;
  p.vy += iv.y * accel * dt;
  const damp = Math.exp(-friction * dt);
  p.vx *= damp;
  p.vy *= damp;
  const sp = Math.hypot(p.vx, p.vy);
  const max = p.speed;
  if (sp > max) {
    p.vx = (p.vx / sp) * max;
    p.vy = (p.vy / sp) * max;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  if (p.moving) p.angle = Math.atan2(p.vy, p.vx);
  resolveCollision(G.world, p, p.radius);
  if (p.punchCooldown > 0) p.punchCooldown -= dt;
  if (p.punchTimer > 0) p.punchTimer -= dt;
  if (p.shootCooldown > 0) p.shootCooldown -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;

  // Punch: a short arc in front of Raka, hurts nearby enemies.
  if (G.input.punch && p.punchCooldown <= 0) {
    p.punchTimer = 0.22;
    p.punchCooldown = 0.45;
    G.audio.punch();
    const reach = 46;
    const px = p.x + Math.cos(p.angle) * reach;
    const py = p.y + Math.sin(p.angle) * reach;
    for (const cop of G.cops.foot) {
      const d = Math.hypot(cop.x - px, cop.y - py);
      if (d < 40) {
        cop.health -= 34;
        cop.vx += Math.cos(p.angle) * 260;
        cop.vy += Math.sin(p.angle) * 260;
        G.notify('Pukulan kena!');
        if (cop.health <= 0) {
          cop.down = true;
          cop.downTimer = 4;
          G.player.money += 10;
          G.notify('Polisi tumbang! +$10');
        }
      }
    }
    // Punching a parked car window is how you break in quietly.
    for (const car of G.cars) {
      if (car.parked && Math.hypot(car.x - p.x, car.y - p.y) < 60) {
        car.brokenIn = true;
        G.notify('Kaca pecah — mobil bisa dicuri (E)');
      }
    }
  }

  // Shooting: click fires toward the mouse cursor.
  if (G.input.shoot && p.shootCooldown <= 0) {
    if (p.ammo > 0) {
      p.ammo -= 1;
      p.shootCooldown = 0.28;
      const wx = G.cam.x + G.input.mouseX;
      const wy = G.cam.y + G.input.mouseY;
      const a = Math.atan2(wy - p.y, wx - p.x);
      p.angle = a;
      G.bullets.push({
        x: p.x + Math.cos(a) * 20,
        y: p.y + Math.sin(a) * 20,
        vx: Math.cos(a) * 620,
        vy: Math.sin(a) * 620,
        life: 0.9,
        fromPlayer: true,
      });
      G.audio.shoot();
      G.particles.push({
        x: p.x + Math.cos(a) * 24, y: p.y + Math.sin(a) * 24,
        vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, life: 0.12, max: 0.12,
        color: '#ffd94d', size: 5,
      });
    } else {
      p.shootCooldown = 0.3;
      G.audio.emptyClick();
      G.notify('Amunisi habis! Cari kotak amunisi.');
    }
    G.input.shoot = false;
  }

  // Pickups: health kits, ammo boxes, cash.
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i];
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      if (pk.kind === 'health') {
        p.health = Math.min(p.maxHealth, p.health + 40);
        G.notify('Kesehatan +40');
      } else if (pk.kind === 'ammo') {
        p.ammo += 18;
        G.notify('Amunisi +18');
      } else if (pk.kind === 'cash') {
        p.money += 60;
        G.notify('Uang +$60');
      }
      G.audio.pickup();
      G.pickups.splice(i, 1);
    }
  }
}

export function hurtPlayer(G, amount) {
  const p = G.player;
  if (p.hurtTimer > 0 || p.health <= 0) return;
  p.health -= amount;
  p.hurtTimer = 0.6;
  G.audio.hurt();
  G.particles.push({
    x: p.x, y: p.y, vx: 0, vy: -30, life: 0.4, max: 0.4,
    color: '#e33', size: 6,
  });
  if (p.health <= 0) {
    p.health = 0;
    G.state = 'wasted';
    G.audio.gameOver();
  }
}

export function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.inCar) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.hurtTimer > 0 && Math.floor(p.hurtTimer * 12) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 13, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle);
  // Body: orange snowplow-driver jacket.
  ctx.fillStyle = '#e8722a';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  // Head with beanie.
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath();
  ctx.arc(6, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#274e6e';
  ctx.beginPath();
  ctx.arc(6, 0, 7, Math.PI, Math.PI * 2);
  ctx.fill();
  // Punch arm.
  if (p.punchTimer > 0) {
    ctx.fillStyle = '#f2c79b';
    ctx.fillRect(8, -4, 20, 7);
  } else {
    ctx.fillStyle = '#f2c79b';
    ctx.fillRect(8, -9, 12, 5);
    ctx.fillRect(8, 4, 12, 5);
  }
  ctx.restore();

  // Health bar above Raka when hurt.
  if (p.health < p.maxHealth) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(p.x - 18, p.y - 30, 36, 6);
    ctx.fillStyle = p.health > 40 ? '#4caf50' : '#e33';
    ctx.fillRect(p.x - 17, p.y - 29, 34 * (p.health / p.maxHealth), 4);
  }
}

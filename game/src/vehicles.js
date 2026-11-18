// Frostpeak Drift — vehicles.js
// Cars: the snowplow, parked cars, traffic that follows the roads, and the
// icy driving model — low friction, sliding, handbrake drifts.

import { resolveCollision, surfaceAt } from './world.js';

const CAR_COLORS = ['#c0392b', '#2874a6', '#7d3c98', '#b7950b', '#148f77', '#5d6d7e', '#a93226', '#1e8449'];
const PARKED_SPOTS = [
  { x: 700, y: 1095, angle: 0 }, { x: 1000, y: 1095, angle: 0 },
  { x: 1300, y: 1095, angle: 0 }, { x: 1800, y: 1095, angle: 0 },
  { x: 2100, y: 1095, angle: 0 }, { x: 700, y: 1355, angle: 0 },
  { x: 1000, y: 1355, angle: 0 }, { x: 1500, y: 1355, angle: 0 },
  { x: 1800, y: 1355, angle: 0 }, { x: 2300, y: 1355, angle: 0 },
  { x: 700, y: 395, angle: Math.PI }, { x: 1500, y: 395, angle: Math.PI },
  { x: 2500, y: 395, angle: Math.PI }, { x: 700, y: 1795, angle: 0 },
  { x: 1500, y: 1795, angle: 0 }, { x: 2300, y: 1795, angle: 0 },
];

export function makeCar(x, y, angle, opts = {}) {
  return {
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0, // forward speed along the car's heading
    color: opts.color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    kind: opts.kind || 'sedan', // sedan | plow | police | rival
    parked: !!opts.parked,
    traffic: !!opts.traffic,
    brokenIn: false,
    driver: opts.driver || null, // 'player' | 'traffic' | 'rival' | null
    loop: opts.loop || 0,
    waypoint: opts.waypoint || 0,
    cruise: opts.cruise || 120 + Math.random() * 60,
    steer: 0,
    drift: 0, // how sideways the car is sliding, for skid marks
    stuck: 0,
  };
}

export function createVehicles(G) {
  const cars = [];
  const plowSpawn = G.world.spawns.plow;
  const plow = makeCar(plowSpawn.x, plowSpawn.y, plowSpawn.angle, {
    kind: 'plow', color: '#e8722a', parked: true,
  });
  cars.push(plow);
  G.plow = plow;

  for (const spot of PARKED_SPOTS) {
    cars.push(makeCar(spot.x, spot.y, spot.angle, { parked: true }));
  }

  // Traffic cars, two per loop.
  G.world.loops.forEach((loop, li) => {
    for (let k = 0; k < 2; k++) {
      const wp = Math.floor((k / 2) * loop.length);
      const pt = loop[wp];
      const next = loop[(wp + 1) % loop.length];
      const car = makeCar(pt.x + (k === 0 ? 0 : 24), pt.y + (k === 0 ? 0 : 24),
        Math.atan2(next.y - pt.y, next.x - pt.x),
        { traffic: true, driver: 'traffic', loop: li, waypoint: (wp + 1) % loop.length });
      cars.push(car);
    }
  });

  // The rival crew's race car, parked by the lodge until the race.
  const rival = makeCar(2760, 1740, Math.PI / 2, {
    kind: 'rival', color: '#111111', parked: true,
  });
  cars.push(rival);
  G.rivalCar = rival;
  return cars;
}

// Grip and drag for each surface. Ice barely holds the car at all.
function surfacePhysics(ground) {
  if (ground === 'ice') return { grip: 0.35, drag: 0.12, accel: 150 };
  if (ground === 'slope') return { grip: 0.55, drag: 0.2, accel: 190 };
  if (ground === 'cleared') return { grip: 2.6, drag: 0.55, accel: 260 };
  if (ground === 'snowroad') return { grip: 1.4, drag: 0.35, accel: 210 };
  return { grip: 0.8, drag: 0.25, accel: 170 }; // deep snow off-road
}

export function updateVehicles(G, dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (car.driver === 'player') {
      updatePlayerCar(G, car, dt);
    } else if (car.driver === 'traffic') {
      updateTrafficCar(G, car, dt);
    } else if (car.driver === 'rival') {
      updateRivalCar(G, car, dt);
    } else if (car.driver === 'police') {
      updatePoliceCar(G, car, dt);
    }
    // Parked cars never move.
  }

  // Enter / exit with E.
  if (G.input.enterPressed) {
    G.input.enterPressed = false;
    if (p.inCar) {
      exitCar(G, p.inCar);
    } else {
      tryEnterCar(G);
    }
  }
}

function updatePlayerCar(G, car, dt) {
  const input = G.input;
  const ground = surfaceAt(G.world, car.x, car.y);
  const phys = surfacePhysics(ground);
  const handbrake = input.handbrake;

  // Throttle.
  let throttle = 0;
  if (G.race && G.race.active && G.race.countdown > 0) {
    throttle = 0; // hold still until the race countdown ends
  } else if (input.up) throttle = 1;
  else if (input.down) throttle = -0.6;
  car.speed += throttle * phys.accel * dt;

  // Drag and rolling resistance; ice keeps the car sliding.
  car.speed *= Math.exp(-phys.drag * dt);
  if (!input.up && !input.down) car.speed *= Math.exp(-0.4 * dt);
  const maxSpeed = car.kind === 'plow' ? 230 : 340;
  if (car.speed > maxSpeed) car.speed = maxSpeed;
  if (car.speed < -120) car.speed = -120;

  // Steering: weaker on ice, and the handbrake cuts rear grip for drifting.
  const steerInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const speedFactor = Math.min(1, Math.abs(car.speed) / 120);
  const steerRate = (handbrake ? 2.6 : 1.9) * speedFactor;
  car.angle += steerInput * steerRate * dt * Math.sign(car.speed || 1);

  // Velocity: mostly along the heading, with a sideways slide that the
  // surface grip bleeds away. Handbrake keeps the slide alive.
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  const rx = -fy;
  const ry = fx;
  const forward = car.vx * fx + car.vy * fy;
  const lateral = car.vx * rx + car.vy * ry;
  const gripNow = handbrake ? phys.grip * 0.25 : phys.grip;
  const newLateral = lateral * Math.exp(-gripNow * dt);
  const newForward = forward + (car.speed - forward) * Math.min(1, 6 * dt);
  car.vx = fx * newForward + rx * newLateral;
  car.vy = fy * newForward + ry * newLateral;
  car.drift = Math.abs(newLateral);

  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const hit = resolveCollision(G.world, car, 20);
  if (hit && Math.hypot(car.vx, car.vy) > 140) {
    G.audio.crash();
    car.speed *= 0.4;
    car.vx *= 0.4;
    car.vy *= 0.4;
    spawnCrashSparks(G, car);
  } else if (hit) {
    car.speed *= 0.7;
    car.vx *= 0.7;
    car.vy *= 0.7;
  }

  // Skid marks while drifting or handbraking hard.
  if ((handbrake && Math.abs(car.speed) > 80) || car.drift > 60) {
    G.skids.push({
      x: car.x - fx * 12, y: car.y - fy * 12,
      angle: car.angle, life: 6, max: 6,
    });
    if (G.skids.length > 400) G.skids.shift();
  }

  // Keep the player glued to the car.
  G.player.x = car.x;
  G.player.y = car.y;
  G.player.angle = car.angle;

  // Engine sound follows speed.
  G.audio.engine(Math.abs(car.speed) / maxSpeed, car.kind === 'plow');
}

function spawnCrashSparks(G, car) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    G.particles.push({
      x: car.x, y: car.y,
      vx: Math.cos(a) * 140, vy: Math.sin(a) * 140,
      life: 0.35, max: 0.35, color: '#ffd94d', size: 3,
    });
  }
}

function updateTrafficCar(G, car, dt) {
  const loop = G.world.loops[car.loop];
  const target = loop[car.waypoint % loop.length];
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
  const speed = Math.min(car.cruise, dist * 1.2 + 40);
  car.vx = Math.cos(car.angle) * speed;
  car.vy = Math.sin(car.angle) * speed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  if (dist < 26) car.waypoint = (car.waypoint + 1) % loop.length;

  // Traffic panics and speeds off when the player causes chaos nearby.
  const p = G.player;
  const pd = Math.hypot(p.x - car.x, p.y - car.y);
  if (G.wanted > 0 && pd < 160) {
    car.cruise = 240;
  } else {
    car.cruise = 120 + (car.loop * 13) % 60;
  }

  // A traffic car that gets shot or rammed hard becomes stealable wreck.
  if (car.health !== undefined && car.health <= 0) {
    car.traffic = false;
    car.parked = true;
    car.driver = null;
  }
}

function updateRivalCar(G, car, dt) {
  // The rival only drives during the race (mission 5); otherwise parked.
  if (!G.race || !G.race.active) return;
  const race = G.race;
  const target = race.path[race.rivalWp % race.path.length];
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
  const speed = race.rivalSpeed;
  car.vx = Math.cos(car.angle) * speed;
  car.vy = Math.sin(car.angle) * speed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  if (dist < 40) race.rivalWp++;
}

function updatePoliceCar(G, car, dt) {
  const p = G.player;
  const dx = p.x - car.x;
  const dy = p.y - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
  const speed = dist > 300 ? 300 : 230;
  car.vx = Math.cos(car.angle) * speed;
  car.vy = Math.sin(car.angle) * speed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  const hit = resolveCollision(G.world, car, 20);
  if (hit) {
    car.vx *= 0.5;
    car.vy *= 0.5;
  }
  // Ram the player: damage on contact, and a hard hit can stop the car.
  if (dist < 34) {
    if (p.inCar) {
      p.inCar.speed *= 0.55;
      p.inCar.vx *= 0.55;
      p.inCar.vy *= 0.55;
      G.audio.crash();
      G.notify('Tabrakan dengan polisi!');
    } else {
      G.state = 'busted';
      G.audio.gameOver();
    }
  }
}

function tryEnterCar(G) {
  const p = G.player;
  let best = null;
  let bestD = 70;
  for (const car of G.cars) {
    if (car.driver === 'traffic' || car.driver === 'rival') continue;
    if (car.driver === 'police') continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  if (!best) {
    G.notify('Tidak ada mobil di dekat sini.');
    return;
  }
  // Stealing a parked car that is not yours raises the wanted level.
  if (best.parked && best.kind !== 'plow' && !best.brokenIn && best !== G.plow) {
    G.police.addWanted(G, 1);
    G.notify('Mobil dicuri! Polisi mengejarmu.');
  }
  best.parked = false;
  best.driver = 'player';
  p.inCar = best;
  G.audio.door();
  G.notify(best.kind === 'plow' ? 'Kamu mengemudikan snowplow.' : 'Kamu masuk mobil.');
}

function exitCar(G, car) {
  const p = G.player;
  car.driver = null;
  car.parked = true;
  car.speed = 0;
  car.vx = 0;
  car.vy = 0;
  p.inCar = null;
  // Step out to the side of the car.
  p.x = car.x - Math.sin(car.angle) * 30;
  p.y = car.y + Math.cos(car.angle) * 30;
  p.vx = 0;
  p.vy = 0;
  G.audio.door();
}

export function drawVehicles(ctx, G) {
  for (const car of G.cars) {
    drawCar(ctx, car);
  }
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 24, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  const len = car.kind === 'plow' ? 46 : 42;
  roundRect(ctx, -len / 2, -13, len, 26, 6);
  ctx.fill();
  // Roof / cabin.
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  roundRect(ctx, -8, -10, 18, 20, 3);
  ctx.fill();
  // Windshield.
  ctx.fillStyle = '#bcd9ea';
  ctx.fillRect(len / 2 - 10, -9, 4, 18);
  // Headlights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(len / 2 - 2, -11, 3, 5);
  ctx.fillRect(len / 2 - 2, 6, 3, 5);
  // Snowplow blade.
  if (car.kind === 'plow') {
    ctx.fillStyle = '#d8b13c';
    ctx.fillRect(len / 2 - 2, -17, 7, 34);
    ctx.fillStyle = '#8a6d1d';
    ctx.fillRect(len / 2 + 5, -17, 3, 34);
  }
  // Police markings.
  if (car.kind === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-14, -13, 22, 5);
    ctx.fillStyle = '#e33';
    ctx.fillRect(-14, 8, 22, 5);
    ctx.fillStyle = '#274e6e';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLISI', 0, 3);
    ctx.textAlign = 'left';
  }
  // Rival racing stripe.
  if (car.kind === 'rival') {
    ctx.fillStyle = '#e33';
    ctx.fillRect(-len / 2, -3, len, 6);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

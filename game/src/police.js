// Frostpeak Drift — police.js
// The wanted system: stars 0-5, foot cops and police cars that scale with
// the heat, plus pedestrians who flee when things get loud.

import { resolveCollision } from './world.js';
import { makeCar } from './vehicles.js';
import { hurtPlayer } from './player.js';

export function createPolice() {
  return {
    foot: [], // foot cops {x,y,vx,vy,health,down,downTimer,angle}
    cars: [], // police cars (also present in G.cars with driver 'police')
    pedestrians: [], // {x,y,vx,vy,angle,fleeing}
    wantedTimer: 0, // counts down while hidden; wanted decays when it ends
    spawnTimer: 0,
    sirenOn: false,
  };
}

export function initPedestrians(G) {
  const spots = [
    { x: 800, y: 1080 }, { x: 1200, y: 1080 }, { x: 1800, y: 1080 },
    { x: 2200, y: 1080 }, { x: 800, y: 1420 }, { x: 1400, y: 1420 },
    { x: 2000, y: 1420 }, { x: 500, y: 600 }, { x: 1600, y: 600 },
    { x: 2500, y: 600 }, { x: 500, y: 1900 }, { x: 1600, y: 1900 },
  ];
  G.police.pedestrians = spots.map((s) => ({
    x: s.x, y: s.y, vx: 0, vy: 0,
    angle: Math.random() * Math.PI * 2,
    fleeing: false, walkTimer: Math.random() * 3,
    color: ['#7d3c98', '#148f77', '#b7950b', '#5d6d7e'][Math.floor(Math.random() * 4)],
  }));
}

export function addWanted(G, n) {
  G.wanted = Math.min(5, G.wanted + n);
  G.police.wantedTimer = 20;
  G.audio.siren(G.wanted > 0);
  if (G.wanted >= 1) G.notify(`Level buronan naik: ${G.wanted} bintang!`);
}

export function clearWanted(G) {
  G.wanted = 0;
  G.audio.siren(false);
  // Send the cops home.
  for (const car of G.police.cars) {
    car.driver = null;
    car.parked = true;
    const i = G.cars.indexOf(car);
    if (i >= 0) G.cars.splice(i, 1);
  }
  G.police.cars = [];
  G.police.foot = [];
}

export function updatePolice(G, dt) {
  const pol = G.police;
  const p = G.player;

  // Wanted decays if the player stays out of sight for a while.
  if (G.wanted > 0) {
    const nearestCop = nearestCopDistance(G);
    if (nearestCop > 500) {
      pol.wantedTimer -= dt;
      if (pol.wantedTimer <= 0) {
        G.wanted = Math.max(0, G.wanted - 1);
        pol.wantedTimer = 20;
        G.notify(`Buronan turun: ${G.wanted} bintang.`);
        if (G.wanted === 0) clearWanted(G);
      }
    } else {
      pol.wantedTimer = 20;
    }
  }

  // Spawn cops to match the wanted level: foot cops = stars, cars = stars - 1.
  pol.spawnTimer -= dt;
  if (pol.spawnTimer <= 0) {
    pol.spawnTimer = 1.2;
    const wantFoot = G.wanted;
    const wantCars = G.wanted >= 2 ? G.wanted - 1 : 0;
    const liveFoot = pol.foot.filter((c) => !c.down).length;
    if (liveFoot < wantFoot) {
      spawnFootCop(G);
    }
    if (pol.cars.length < wantCars) {
      spawnPoliceCar(G);
    }
  }

  // Foot cops chase on foot and punch Raka; they give up when down.
  for (const cop of pol.foot) {
    if (cop.down) {
      cop.downTimer -= dt;
      if (cop.downTimer <= 0) {
        const i = pol.foot.indexOf(cop);
        if (i >= 0) pol.foot.splice(i, 1);
      }
      continue;
    }
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const d = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    const speed = 165 + G.wanted * 8;
    cop.vx = (dx / (d || 1)) * speed;
    cop.vy = (dy / (d || 1)) * speed;
    cop.x += cop.vx * dt;
    cop.y += cop.vy * dt;
    resolveCollision(G.world, cop, 13);
    if (d < 26) {
      if (p.inCar) {
        // A foot cop in front of the car gets knocked aside.
        cop.vx = (dx / (d || 1)) * -300;
        cop.vy = (dy / (d || 1)) * -300;
        cop.health -= 50;
        if (cop.health <= 0) {
          cop.down = true;
          cop.downTimer = 4;
        }
        G.audio.crash();
      } else {
        hurtPlayer(G, 12);
        // Being grabbed on foot at close range ends the run.
        if (d < 20) {
          G.state = 'busted';
          G.audio.gameOver();
        }
      }
    }
  }

  // Bullets from the player can down foot cops.
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    if (!b.fromPlayer) continue;
    for (const cop of pol.foot) {
      if (cop.down) continue;
      if (Math.hypot(cop.x - b.x, cop.y - b.y) < 16) {
        cop.health -= 50;
        G.bullets.splice(i, 1);
        if (cop.health <= 0) {
          cop.down = true;
          cop.downTimer = 4;
          p.money += 10;
          G.notify('Polisi tumbang! +$10');
        }
        break;
      }
    }
  }

  updatePedestrians(G, dt);
}

function nearestCopDistance(G) {
  const p = G.player;
  let best = Infinity;
  for (const cop of G.police.foot) {
    best = Math.min(best, Math.hypot(cop.x - p.x, cop.y - p.y));
  }
  for (const car of G.police.cars) {
    best = Math.min(best, Math.hypot(car.x - p.x, car.y - p.y));
  }
  return best;
}

function spawnFootCop(G) {
  const p = G.player;
  // Appear a little way off, at the edge of the screen.
  const a = Math.random() * Math.PI * 2;
  const x = p.x + Math.cos(a) * 420;
  const y = p.y + Math.sin(a) * 420;
  G.police.foot.push({
    x: Math.max(40, Math.min(G.world.w - 40, x)),
    y: Math.max(40, Math.min(G.world.h - 40, y)),
    vx: 0, vy: 0, health: 100, down: false, downTimer: 0, angle: 0,
  });
}

function spawnPoliceCar(G) {
  const p = G.player;
  const a = Math.random() * Math.PI * 2;
  const car = makeCar(
    Math.max(60, Math.min(G.world.w - 60, p.x + Math.cos(a) * 500)),
    Math.max(60, Math.min(G.world.h - 60, p.y + Math.sin(a) * 500)),
    0,
    { kind: 'police', color: '#1c2733', driver: 'police' },
  );
  G.cars.push(car);
  G.police.cars.push(car);
  G.audio.siren(true);
}

function updatePedestrians(G, dt) {
  const p = G.player;
  for (const ped of G.police.pedestrians) {
    const d = Math.hypot(p.x - ped.x, p.y - ped.y);
    const danger = G.wanted > 0 || (p.inCar && Math.hypot(p.inCar.vx, p.inCar.vy) > 200);
    ped.fleeing = d < 170 && danger;
    ped.walkTimer -= dt;
    if (ped.fleeing) {
      // Run away from the player.
      const a = Math.atan2(ped.y - p.y, ped.x - p.x);
      ped.vx = Math.cos(a) * 190;
      ped.vy = Math.sin(a) * 190;
      ped.angle = a;
    } else {
      if (ped.walkTimer <= 0) {
        ped.walkTimer = 2 + Math.random() * 3;
        ped.angle = Math.random() * Math.PI * 2;
      }
      ped.vx = Math.cos(ped.angle) * 42;
      ped.vy = Math.sin(ped.angle) * 42;
    }
    ped.x += ped.vx * dt;
    ped.y += ped.vy * dt;
    resolveCollision(G.world, ped, 12);
  }
}

export function drawPolice(ctx, G) {
  // Foot cops: dark blue uniforms.
  for (const cop of G.police.foot) {
    ctx.save();
    ctx.translate(cop.x, cop.y);
    if (cop.down) {
      ctx.rotate(Math.PI / 2);
      ctx.globalAlpha = 0.8;
    } else {
      ctx.rotate(cop.angle);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d3a5f';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c79b';
    ctx.beginPath();
    ctx.arc(5, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#274e6e';
    ctx.fillRect(2, -6, 7, 12);
    ctx.restore();
    if (!cop.down && cop.health < 100) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(cop.x - 15, cop.y - 26, 30, 5);
      ctx.fillStyle = '#e33';
      ctx.fillRect(cop.x - 14, cop.y - 25, 28 * (cop.health / 100), 3);
    }
  }

  // Pedestrians.
  for (const ped of G.police.pedestrians) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 7, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c79b';
    ctx.beginPath();
    ctx.arc(4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    if (ped.fleeing) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('!', 10, -12);
    }
    ctx.restore();
  }
}

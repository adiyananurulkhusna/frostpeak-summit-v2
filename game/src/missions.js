// Frostpeak Drift — missions.js
// Six linked story missions for Raka, the snowplow driver pulled into
// Frostpeak's underworld. Each mission tracks its own progress and pays out.

import { makeCar } from './vehicles.js';

export const MISSION_DEFS = [
  {
    title: 'Misi 1 — Buka Jalan',
    brief: 'Resor buka sebentar lagi. Naik snowplow dan bersihkan Main Street sebelum tamu datang.',
    objective: 'Bersihkan 5 titik salju di Main Street dengan snowplow.',
  },
  {
    title: 'Misi 2 — Paket Dingin',
    brief: 'Seseorang butuh paket dingin diantar ke lodge. Ambil di Depot Es, antar ke Lodge. Jangan sampai ketahuan patroli.',
    objective: 'Ambil paket di Depot Es, antar ke Lodge.',
  },
  {
    title: 'Misi 3 — Buntuti Kurir',
    brief: 'Kurir kru saingan sedang bergerak. Buntuti dia — jangan terlalu dekat, jangan sampai kehilangan jejak.',
    objective: 'Jaga jarak 150–450 dari kurir selama 20 detik.',
  },
  {
    title: 'Misi 4 — Badai Salju',
    brief: 'Badai datang, jarak pandang mengecil. Selundupkan barang melewati pos pemeriksaan ke gudang selatan.',
    objective: 'Bawa barang ke gudang selatan melewati pos polisi.',
  },
  {
    title: 'Misi 5 — Balap Lereng',
    brief: 'Pembalap terbaik kru saingan menantangmu balap menuruni lereng ski. Menang, dan namamu dikenal.',
    objective: 'Kalahkan pembalap saingan sampai gerbang bawah lereng.',
  },
  {
    title: 'Misi 6 — Simpanan Kru',
    brief: 'Ini dia. Curi simpanan kru dari lodge dan kabur. Seluruh kota akan mengejarmu.',
    objective: 'Ambil simpanan di Lodge, kabur ke titik pelarian.',
  },
];

export function createMissions() {
  return {
    index: 0,
    started: false,
    done: false,
    // Mission 1: which plow points are cleared.
    plowPoints: [
      { x: 500, y: 1200, done: false },
      { x: 1000, y: 1200, done: false },
      { x: 1500, y: 1200, done: false },
      { x: 2000, y: 1200, done: false },
      { x: 2500, y: 1200, done: false },
    ],
    // Mission 2/4/6: carrying something.
    carrying: null, // 'package' | 'goods' | 'stash'
    // Mission 3: tailing.
    tailTime: 0,
    tailWarn: 0,
    // Mission 5: race.
    raceWon: false,
    // Mission 6: escape timer.
    escapeTimer: 0,
    dialogShown: false,
  };
}

export function startMission(G, i) {
  const M = G.missions;
  M.index = i;
  M.started = true;
  M.dialogShown = false;
  M.carrying = null;
  const def = MISSION_DEFS[i];
  G.say(def.brief, 'Raka');
  G.objective = def.objective;
  G.notify(def.title);

  if (i === 2) {
    // The rival courier starts circling the northern loop.
    const c = makeCar(495, 495, 0, {
      kind: 'rival', color: '#222222', traffic: true, driver: 'traffic',
      loop: 1, waypoint: 1, cruise: 150,
    });
    G.cars.push(c);
    G.courier = c;
    M.tailTime = 0;
    M.tailWarn = 0;
  }
  if (i === 3) {
    G.blizzard = true;
    G.notify('Badai salju! Jarak pandang mengecil.');
  }
  if (i === 4) {
    startRace(G);
  }
  if (i === 5) {
    G.escapeTimer = 0;
  }
}

function startRace(G) {
  const top = G.world.spawns.slopeTop;
  const bottom = G.world.spawns.slopeBottom;
  // Step out of whatever Raka was driving, and retire the previous race car.
  if (G.player.inCar) {
    G.player.inCar.driver = null;
    G.player.inCar.parked = true;
    G.player.inCar = null;
  }
  if (G.raceCar) {
    const i = G.cars.indexOf(G.raceCar);
    if (i >= 0) G.cars.splice(i, 1);
    G.raceCar = null;
  }
  // A race car waits at the top of the slope for Raka.
  const car = makeCar(top.x + 90, top.y + 30, Math.PI / 2, {
    color: '#e8722a', parked: false, driver: 'player',
  });
  G.cars.push(car);
  G.raceCar = car;
  G.player.inCar = car;
  G.player.x = car.x;
  G.player.y = car.y;
  // The rival lines up beside him.
  const rival = G.rivalCar;
  rival.x = top.x - 60;
  rival.y = top.y + 30;
  rival.angle = Math.PI / 2;
  rival.vx = 0;
  rival.vy = 0;
  rival.parked = false;
  rival.driver = 'rival';
  const path = [];
  for (let y = top.y + 60; y <= bottom.y; y += 160) {
    const sway = Math.sin(y / 260) * 90;
    path.push({ x: 220 + sway, y });
  }
  path.push({ x: bottom.x, y: bottom.y });
  G.race = {
    active: true,
    path,
    rivalWp: 0,
    rivalSpeed: 205,
    playerFinished: false,
    rivalFinished: false,
    countdown: 3,
  };
  G.say('Tiga... dua... satu... GAS!', 'Starter');
}

export function completeMission(G, reward) {
  const M = G.missions;
  G.player.money += reward;
  G.notify(`${MISSION_DEFS[M.index].title} selesai! +$${reward}`);
  G.audio.missionComplete();
  M.index++;
  G.saveGame();
  if (M.index >= MISSION_DEFS.length) {
    M.done = true;
    G.state = 'complete';
    G.audio.gameOver();
    return;
  }
  startMission(G, M.index);
}

export function updateMissions(G, dt) {
  const M = G.missions;
  if (!M.started || M.done) return;
  const p = G.player;

  if (M.index === 0) {
    // Plow each point with the snowplow.
    if (p.inCar && p.inCar.kind === 'plow') {
      for (const pt of M.plowPoints) {
        if (!pt.done && Math.hypot(p.inCar.x - pt.x, p.inCar.y - pt.y) < 80) {
          pt.done = true;
          G.audio.pickup();
          G.notify(`Titik dibersihkan (${M.plowPoints.filter((q) => q.done).length}/5)`);
          G.particles.push({
            x: pt.x, y: pt.y, vx: 0, vy: -20, life: 0.5, max: 0.5,
            color: '#ffffff', size: 8,
          });
        }
      }
      if (M.plowPoints.every((q) => q.done)) {
        completeMission(G, 150);
      }
    }
  } else if (M.index === 1) {
    const depot = G.world.spawns.depot;
    const lodge = G.world.spawns.lodge;
    if (!M.carrying) {
      if (Math.hypot(p.x - depot.x, p.y - depot.y) < 70) {
        M.carrying = 'package';
        G.police.addWanted(G, 1);
        G.say('Paket dingin di tangan. Antar ke Lodge, jangan kejar-kejaran dengan patroli.', 'Raka');
        G.objective = 'Antar paket ke Lodge di tepi danau.';
      }
    } else if (Math.hypot(p.x - lodge.x, p.y - lodge.y) < 90) {
      M.carrying = null;
      completeMission(G, 300);
    }
  } else if (M.index === 2) {
    const c = G.courier;
    if (!c) return;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d >= 150 && d <= 450) {
      M.tailTime += dt;
      M.tailWarn = 0;
      if (Math.floor(M.tailTime * 2) % 2 === 0) {
        G.objective = `Buntuti kurir... ${Math.ceil(20 - M.tailTime)} dtk lagi. Jarak ${Math.round(d)}.`;
      }
      if (M.tailTime >= 20) {
        // The courier parks; remove him from traffic.
        c.driver = null;
        c.parked = true;
        G.courier = null;
        completeMission(G, 350);
      }
    } else {
      M.tailWarn += dt;
      G.objective = d < 150
        ? 'Terlalu dekat! Mundur, kurir bisa curiga.'
        : 'Terlalu jauh! Kejar kurir itu.';
      if (M.tailWarn > 4) {
        M.tailTime = Math.max(0, M.tailTime - 4);
        M.tailWarn = 0;
        G.notify('Jejak hampir hilang! Kembali ke jarak aman.');
      }
    }
  } else if (M.index === 3) {
    const drop = { x: 2230, y: 1660 };
    const checkpoint = G.world.spawns.checkpoint;
    if (!M.carrying) {
      // The goods wait at the depot again.
      const depot = G.world.spawns.depot;
      if (Math.hypot(p.x - depot.x, p.y - depot.y) < 70) {
        M.carrying = 'goods';
        G.say('Barang di tangan. Lewati pos pemeriksaan di Main Street, lalu ke gudang selatan.', 'Raka');
        G.objective = 'Lewati pos pemeriksaan, antar ke gudang selatan.';
      }
    } else {
      // A cop posted at the checkpoint spots anyone who gets too close.
      const dc = Math.hypot(p.x - checkpoint.x, p.y - checkpoint.y);
      if (dc < 130 && G.wanted < 2) {
        G.police.addWanted(G, 2);
        G.notify('Ketahuan di pos pemeriksaan! Kabur!');
      }
      if (Math.hypot(p.x - drop.x, p.y - drop.y) < 90) {
        M.carrying = null;
        G.blizzard = false;
        completeMission(G, 450);
      }
    }
  } else if (M.index === 4) {
    const race = G.race;
    if (!race || !race.active) return;
    if (race.countdown > 0) {
      race.countdown -= dt;
      return;
    }
    const bottom = G.world.spawns.slopeBottom;
    if (!race.playerFinished && Math.hypot(p.x - bottom.x, p.y - bottom.y) < 110) {
      race.playerFinished = true;
    }
    const rival = G.rivalCar;
    if (!race.rivalFinished && Math.hypot(rival.x - bottom.x, rival.y - bottom.y) < 110) {
      race.rivalFinished = true;
    }
    if (race.playerFinished && race.rivalFinished) {
      // Whoever got there first wins; the player flag is set on arrival,
      // the rival only finishes if he arrived in an earlier frame.
      finishRace(G, true);
    } else if (race.playerFinished) {
      finishRace(G, true);
    } else if (race.rivalFinished) {
      finishRace(G, false);
    }
  } else if (M.index === 5) {
    const lodge = G.world.spawns.lodge;
    const escape = G.world.spawns.escape;
    if (!M.carrying) {
      if (Math.hypot(p.x - lodge.x, p.y - lodge.y) < 90) {
        M.carrying = 'stash';
        G.police.addWanted(G, 5);
        G.escapeTimer = 75;
        G.say('Simpanan didapat! Seluruh kota mengejarmu — kabur ke titik pelarian di barat!', 'Raka');
        G.objective = 'Kabur ke titik pelarian di ujung barat Lake Road!';
      }
    } else {
      G.escapeTimer -= dt;
      G.objective = `Kabur! ${Math.ceil(G.escapeTimer)} dtk — ke ujung barat Lake Road.`;
      if (Math.hypot(p.x - escape.x, p.y - escape.y) < 100) {
        M.carrying = null;
        completeMission(G, 1000);
      } else if (G.escapeTimer <= 0) {
        G.state = 'busted';
        G.audio.gameOver();
        G.say('Terlambat — polisi mengepungmu.', 'Polisi');
      }
    }
  }
}

function finishRace(G, won) {
  const race = G.race;
  race.active = false;
  G.rivalCar.driver = null;
  G.rivalCar.parked = true;
  if (won) {
    G.say('Kamu menang! Lereng ini milikmu sekarang.', 'Penonton');
    completeMission(G, 600);
  } else {
    G.say('Kalah tipis! Coba lagi — rivalmu menunggu di puncak.', 'Rival');
    // Restart the race from the top.
    startRace(G);
  }
}

// Where should the HUD arrow and minimap point right now?
export function missionTarget(G) {
  const M = G.missions;
  if (!M.started || M.done) return null;
  if (M.index === 0) {
    const next = M.plowPoints.find((q) => !q.done);
    return next ? { x: next.x, y: next.y } : null;
  }
  if (M.index === 1) {
    return M.carrying
      ? { x: G.world.spawns.lodge.x, y: G.world.spawns.lodge.y }
      : { x: G.world.spawns.depot.x, y: G.world.spawns.depot.y };
  }
  if (M.index === 2) {
    return G.courier ? { x: G.courier.x, y: G.courier.y } : null;
  }
  if (M.index === 3) {
    return M.carrying
      ? { x: 2230, y: 1660 }
      : { x: G.world.spawns.depot.x, y: G.world.spawns.depot.y };
  }
  if (M.index === 4) {
    return { x: G.world.spawns.slopeBottom.x, y: G.world.spawns.slopeBottom.y };
  }
  if (M.index === 5) {
    return M.carrying
      ? { x: G.world.spawns.escape.x, y: G.world.spawns.escape.y }
      : { x: G.world.spawns.lodge.x, y: G.world.spawns.lodge.y };
  }
  return null;
}

export function drawMissionLayer(ctx, G) {
  const M = G.missions;
  if (!M.started || M.done) return;
  const pulse = 0.6 + 0.4 * Math.sin(G.time * 5);

  if (M.index === 0) {
    for (const pt of M.plowPoints) {
      ctx.save();
      ctx.globalAlpha = pt.done ? 0.25 : pulse;
      ctx.fillStyle = pt.done ? '#4caf50' : '#f5d76e';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1c2733';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pt.done ? '✓' : '!', pt.x, pt.y + 7);
      ctx.restore();
    }
  }
  if ((M.index === 1 && !M.carrying) || (M.index === 3 && !M.carrying)) {
    const depot = G.world.spawns.depot;
    drawMarker(ctx, depot.x, depot.y, pulse, '#f5d76e', 'PAKET');
  }
  if (M.index === 1 && M.carrying) {
    drawMarker(ctx, G.world.spawns.lodge.x, G.world.spawns.lodge.y, pulse, '#4caf50', 'LODGE');
  }
  if (M.index === 2 && G.courier) {
    const c = G.courier;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = '#e33';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (M.index === 3) {
    // The police checkpoint on Main Street.
    const cp = G.world.spawns.checkpoint;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#274e6e';
    ctx.fillRect(cp.x - 40, cp.y - 70, 80, 34);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POS POLISI', cp.x, cp.y - 48);
    ctx.restore();
    if (M.carrying) drawMarker(ctx, 2230, 1660, pulse, '#4caf50', 'GUDANG');
  }
  if (M.index === 4 && G.race && G.race.active) {
    const bottom = G.world.spawns.slopeBottom;
    drawMarker(ctx, bottom.x, bottom.y, pulse, '#e8722a', 'FINISH');
    if (G.race.countdown > 0) {
      ctx.save();
      ctx.fillStyle = '#1c2733';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(Math.ceil(G.race.countdown)), G.player.x, G.player.y - 90);
      ctx.restore();
    }
  }
  if (M.index === 5) {
    if (!M.carrying) {
      drawMarker(ctx, G.world.spawns.lodge.x, G.world.spawns.lodge.y, pulse, '#f5d76e', 'SIMPANAN');
    } else {
      drawMarker(ctx, G.world.spawns.escape.x, G.world.spawns.escape.y, pulse, '#4caf50', 'KABUR');
    }
  }
}

function drawMarker(ctx, x, y, pulse, color, label) {
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - 34);
  ctx.lineTo(x - 12, y - 12);
  ctx.lineTo(x + 12, y - 12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c2733';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y - 42);
  ctx.restore();
}

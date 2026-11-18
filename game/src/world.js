// Frostpeak Drift — world.js
// The town of Frostpeak: roads, buildings, ski slope, frozen lake and lodges.
// Everything here is plain data plus small helpers; drawing lives here too
// so the main loop stays thin.

export function createWorld() {
  const W = 3200;
  const H = 2400;

  // Roads are axis-aligned strips. kind: 'main' is the plowed main street
  // (best grip), 'street' is packed snow, 'alley' is narrow snow.
  const roads = [
    { x: 0, y: 1145, w: 3200, h: 110, kind: 'main', name: 'Main Street' },
    { x: 0, y: 445, w: 3200, h: 100, kind: 'street', name: 'North Avenue' },
    { x: 0, y: 1845, w: 3200, h: 100, kind: 'street', name: 'Lake Road' },
    { x: 445, y: 0, w: 100, h: 2400, kind: 'street', name: 'Pine Street' },
    { x: 1545, y: 0, w: 100, h: 2400, kind: 'street', name: 'Summit Road' },
    { x: 2645, y: 0, w: 100, h: 1845, kind: 'street', name: 'Lodge Lane' },
  ];

  // Buildings: solid rectangles the player and cars cannot pass through.
  const buildings = [
    // Shops along the north side of Main Street
    { x: 620, y: 950, w: 220, h: 160, color: '#b5533c', label: 'TOKO SKI', roof: '#7d3a2b' },
    { x: 900, y: 950, w: 220, h: 160, color: '#3c6e9e', label: 'KAFE', roof: '#2c4f73' },
    { x: 1180, y: 950, w: 220, h: 160, color: '#c98f2e', label: 'RENTAL', roof: '#8f6520' },
    { x: 1720, y: 950, w: 240, h: 160, color: '#5d8a4a', label: 'MARKET', roof: '#3f6132' },
    { x: 2020, y: 950, w: 220, h: 160, color: '#8a5da8', label: 'HOTEL', roof: '#5f3f78' },
    // South side of Main Street
    { x: 620, y: 1290, w: 220, h: 160, color: '#9e3c3c', label: 'BENGKEL', roof: '#6e2a2a' },
    { x: 900, y: 1290, w: 220, h: 160, color: '#3c9e8a', label: 'APOTEK', roof: '#2a6e61' },
    { x: 1180, y: 1290, w: 220, h: 160, color: '#a89a5d', label: 'BAKERY', roof: '#776d40' },
    { x: 1720, y: 1290, w: 240, h: 160, color: '#6e7f9e', label: 'BANK', roof: '#4d5a70' },
    { x: 2020, y: 1290, w: 220, h: 160, color: '#9e6e3c', label: 'BAR', roof: '#6e4d2a' },
    // North district
    { x: 620, y: 600, w: 260, h: 180, color: '#7a6a8a', label: 'APARTEMEN', roof: '#554763' },
    { x: 1000, y: 600, w: 260, h: 180, color: '#8a7a5d', label: 'RUMAH', roof: '#635740' },
    { x: 1720, y: 600, w: 260, h: 180, color: '#5d7a8a', label: 'SEKOLAH', roof: '#405663' },
    { x: 2100, y: 600, w: 260, h: 180, color: '#8a5d6e', label: 'RUMAH', roof: '#634052' },
    // Police station
    { x: 2400, y: 150, w: 300, h: 200, color: '#2e4a6e', label: 'POLISI', roof: '#1d3149' },
    // South district
    { x: 620, y: 1560, w: 260, h: 180, color: '#6e8a5d', label: 'RUMAH', roof: '#4d6140' },
    { x: 1000, y: 1560, w: 260, h: 180, color: '#8a6e5d', label: 'RUMAH', roof: '#614d40' },
    { x: 1720, y: 1560, w: 260, h: 180, color: '#7a5d8a', label: 'GUDANG', roof: '#554063' },
    { x: 2100, y: 1560, w: 260, h: 180, color: '#5d8a7a', label: 'DEPOT', roof: '#40615a' },
    // The rival crew lodge by the frozen lake
    { x: 2380, y: 1620, w: 320, h: 200, color: '#8a2f2f', label: 'LODGE', roof: '#5f1f1f' },
    // Depot where the cold package waits (west end of Main Street)
    { x: 120, y: 1290, w: 240, h: 170, color: '#4a6e8a', label: 'DEPOT ES', roof: '#33506a' },
  ];

  // Special zones: the ski slope (west strip) and the frozen lake (south-east).
  const zones = [
    { x: 40, y: 260, w: 360, h: 1900, kind: 'slope', name: 'Lereng Ski' },
    { x: 2320, y: 1960, w: 840, h: 400, kind: 'lake', name: 'Danau Beku' },
  ];

  // Pine trees scattered on snow, away from roads and buildings.
  const trees = [];
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 130; i++) {
    const x = 60 + rnd() * (W - 120);
    const y = 60 + rnd() * (H - 120);
    if (pointOnRoad(x, y, roads)) continue;
    if (buildings.some((b) => x > b.x - 40 && x < b.x + b.w + 40 && y > b.y - 40 && y < b.y + b.h + 40)) continue;
    if (zones.some((z) => x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h)) continue;
    trees.push({ x, y, s: 14 + rnd() * 16 });
  }

  // Traffic loops: closed rectangles traced along road centrelines.
  const loops = [
    // Outer loop around the central blocks
    [
      { x: 495, y: 495 }, { x: 1595, y: 495 }, { x: 1595, y: 1200 },
      { x: 495, y: 1200 },
    ],
    [
      { x: 1595, y: 495 }, { x: 2695, y: 495 }, { x: 2695, y: 1200 },
      { x: 1595, y: 1200 },
    ],
    [
      { x: 495, y: 1200 }, { x: 1595, y: 1200 }, { x: 1595, y: 1895 },
      { x: 495, y: 1895 },
    ],
    [
      { x: 1595, y: 1200 }, { x: 2695, y: 1200 }, { x: 2695, y: 1895 },
      { x: 1595, y: 1895 },
    ],
  ];

  return {
    w: W,
    h: H,
    roads,
    buildings,
    zones,
    trees,
    loops,
    spawns: {
      player: { x: 700, y: 1330 },
      plow: { x: 760, y: 1200, angle: 0 },
      depot: { x: 250, y: 1200 },
      lodge: { x: 2540, y: 1740 },
      checkpoint: { x: 2150, y: 1200 },
      slopeTop: { x: 220, y: 330 },
      slopeBottom: { x: 220, y: 2080 },
      escape: { x: 300, y: 1895 },
      policeStation: { x: 2550, y: 250 },
    },
  };
}

function pointOnRoad(x, y, roads) {
  return roads.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
}

// What kind of ground is under a point? Drives grip and drift.
export function surfaceAt(world, x, y) {
  for (const z of world.zones) {
    if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) {
      return z.kind === 'lake' ? 'ice' : 'slope';
    }
  }
  for (const r of world.roads) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      return r.kind === 'main' ? 'cleared' : 'snowroad';
    }
  }
  return 'snow';
}

// Circle vs building collision. Returns the building hit, or null.
export function collideBuildings(world, x, y, r) {
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}

// Push a circle out of buildings and the map edge. Returns true if it hit something.
export function resolveCollision(world, e, r) {
  let hit = false;
  if (e.x < r) { e.x = r; hit = true; }
  if (e.y < r) { e.y = r; hit = true; }
  if (e.x > world.w - r) { e.x = world.w - r; hit = true; }
  if (e.y > world.h - r) { e.y = world.h - r; hit = true; }
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(e.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(e.y, b.y + b.h));
    const dx = e.x - cx;
    const dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      e.x = cx + (dx / d) * r;
      e.y = cy + (dy / d) * r;
      hit = true;
    } else if (d2 <= 0.0001) {
      // Centre inside the building: shove out along the smallest overlap.
      const left = e.x - b.x;
      const right = b.x + b.w - e.x;
      const top = e.y - b.y;
      const bottom = b.y + b.h - e.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) e.x = b.x - r;
      else if (m === right) e.x = b.x + b.w + r;
      else if (m === top) e.y = b.y - r;
      else e.y = b.y + b.h + r;
      hit = true;
    }
  }
  return hit;
}

export function drawWorld(ctx, cam, world, time) {
  const vx0 = cam.x - 40;
  const vy0 = cam.y - 40;
  const vx1 = cam.x + cam.w + 40;
  const vy1 = cam.y + cam.h + 40;

  // Snow ground.
  ctx.fillStyle = '#e8eef6';
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);

  // Subtle snow sparkle patches.
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 40; i++) {
    const px = ((i * 613) % world.w);
    const py = ((i * 941) % world.h);
    if (px < vx0 || px > vx1 || py < vy0 || py > vy1) continue;
    ctx.fillRect(px, py, 26, 14);
  }

  // Ski slope: groomed stripes.
  const slope = world.zones[0];
  ctx.fillStyle = '#dfe9f5';
  ctx.fillRect(slope.x, slope.y, slope.w, slope.h);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let y = slope.y; y < slope.y + slope.h; y += 90) {
    ctx.fillRect(slope.x, y, slope.w, 34);
  }
  ctx.strokeStyle = '#c33';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(slope.x + 60, slope.y);
  ctx.lineTo(slope.x + 60, slope.y + slope.h);
  ctx.moveTo(slope.x + slope.w - 60, slope.y);
  ctx.lineTo(slope.x + slope.w - 60, slope.y + slope.h);
  ctx.stroke();

  // Frozen lake: pale blue ice with cracks.
  const lake = world.zones[1];
  ctx.fillStyle = '#bcd9ea';
  ctx.fillRect(lake.x, lake.y, lake.w, lake.h);
  ctx.strokeStyle = 'rgba(90,140,180,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lake.x + 120, lake.y + 60);
  ctx.lineTo(lake.x + 320, lake.y + 180);
  ctx.lineTo(lake.x + 520, lake.y + 120);
  ctx.moveTo(lake.x + 200, lake.y + 300);
  ctx.lineTo(lake.x + 480, lake.y + 340);
  ctx.stroke();
  ctx.fillStyle = '#5a8cb4';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('DANAU BEKU', lake.x + 330, lake.y + 210);

  // Roads.
  for (const r of world.roads) {
    if (r.x > vx1 || r.x + r.w < vx0 || r.y > vy1 || r.y + r.h < vy0) continue;
    ctx.fillStyle = r.kind === 'main' ? '#5a5f6b' : '#7d828e';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // Centre dashes.
    ctx.fillStyle = r.kind === 'main' ? '#f5d76e' : 'rgba(255,255,255,0.75)';
    const horizontal = r.w > r.h;
    if (horizontal) {
      const cy = r.y + r.h / 2;
      for (let x = r.x + 10; x < r.x + r.w - 20; x += 70) ctx.fillRect(x, cy - 2, 34, 4);
    } else {
      const cx = r.x + r.w / 2;
      for (let y = r.y + 10; y < r.y + r.h - 20; y += 70) ctx.fillRect(cx - 2, y, 4, 34);
    }
    // Snow piled on the road edges.
    ctx.fillStyle = 'rgba(232,238,246,0.9)';
    if (horizontal) {
      ctx.fillRect(r.x, r.y, r.w, 8);
      ctx.fillRect(r.x, r.y + r.h - 8, r.w, 8);
    } else {
      ctx.fillRect(r.x, r.y, 8, r.h);
      ctx.fillRect(r.x + r.w - 8, r.y, 8, r.h);
    }
  }

  // Trees.
  for (const t of world.trees) {
    if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
    ctx.fillStyle = '#2c5a3c';
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - t.s);
    ctx.lineTo(t.x - t.s * 0.7, t.y + t.s * 0.6);
    ctx.lineTo(t.x + t.s * 0.7, t.y + t.s * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - t.s);
    ctx.lineTo(t.x - t.s * 0.35, t.y - t.s * 0.2);
    ctx.lineTo(t.x + t.s * 0.35, t.y - t.s * 0.2);
    ctx.closePath();
    ctx.fill();
  }

  // Buildings with snowy roofs.
  ctx.textAlign = 'center';
  for (const b of world.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(b.x - 4, b.y - 8, b.w + 8, 12);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(b.x + 18, b.y + 34, 26, 30);
    ctx.fillRect(b.x + b.w - 44, b.y + 34, 26, 30);
    ctx.fillStyle = '#1c2733';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h - 18);
  }
  ctx.textAlign = 'left';

  // Town sign at the main street entrance.
  ctx.fillStyle = '#1c2733';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('FROSTPEAK', 90, 1120);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#445566';
  ctx.fillText('Kota Resor Ski — hati-hati jalan licin', 90, 1146);

  void time;
}

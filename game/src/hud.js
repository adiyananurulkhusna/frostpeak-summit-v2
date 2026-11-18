// Frostpeak Drift — hud.js
// HUD, minimap, dialog box, notifications, and the title / pause / end screens.

import { missionTarget } from './missions.js';

const CONTROLS = [
  ['WASD / Panah', 'Bergerak & mengemudi'],
  ['E', 'Masuk / keluar mobil'],
  ['F', 'Pukul'],
  ['Klik mouse', 'Tembak ke arah kursor'],
  ['Spasi', 'Rem tangan (drift)'],
  ['P', 'Jeda'],
  ['M', 'Bisukan suara'],
];

export function drawHUD(ctx, G) {
  const W = G.view.w;
  const p = G.player;

  // Top-left: health, money, ammo.
  ctx.save();
  ctx.fillStyle = 'rgba(10,18,28,0.72)';
  roundRect(ctx, 12, 12, 250, 92, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('RAKA', 26, 36);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(26, 46, 180, 12);
  ctx.fillStyle = p.health > 40 ? '#4caf50' : '#e33';
  ctx.fillRect(26, 46, 180 * (p.health / p.maxHealth), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(`${Math.ceil(p.health)}`, 212, 57);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`$${p.money}`, 26, 82);
  ctx.fillStyle = '#ffd94d';
  ctx.fillText(`Amunisi: ${p.ammo}`, 120, 82);
  ctx.restore();

  // Top-right: wanted stars and clock.
  ctx.save();
  ctx.fillStyle = 'rgba(10,18,28,0.72)';
  roundRect(ctx, W - 232, 12, 220, 62, 10);
  ctx.fill();
  ctx.font = 'bold 22px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < G.wanted ? '#ffd94d' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', W - 218 + i * 30, 42);
  }
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  const hh = String(Math.floor(G.clock / 60) % 24).padStart(2, '0');
  const mm = String(Math.floor(G.clock) % 60).padStart(2, '0');
  ctx.fillText(`🕐 ${hh}:${mm}  Frostpeak`, W - 218, 64);
  ctx.restore();

  // Objective line under the top bar.
  if (G.objective) {
    ctx.save();
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(G.objective).width;
    ctx.fillStyle = 'rgba(10,18,28,0.72)';
    roundRect(ctx, (W - tw) / 2 - 14, 84, tw + 28, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(G.objective, (W - tw) / 2, 105);
    ctx.restore();
  }

  // Mission number.
  ctx.save();
  ctx.fillStyle = 'rgba(10,18,28,0.6)';
  roundRect(ctx, 12, 112, 210, 26, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  ctx.fillText(G.missions.done ? 'Semua misi selesai!' : `Misi ${G.missions.index + 1} dari 6`, 24, 130);
  ctx.restore();

  // Notifications stack (bottom-left).
  ctx.save();
  ctx.font = '14px sans-serif';
  let ny = G.view.h - 20;
  for (let i = G.notices.length - 1; i >= 0; i--) {
    const n = G.notices[i];
    ctx.globalAlpha = Math.min(1, n.life);
    const tw = ctx.measureText(n.text).width;
    ctx.fillStyle = 'rgba(10,18,28,0.75)';
    roundRect(ctx, 12, ny - 20, tw + 20, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(n.text, 22, ny - 2);
    ny -= 34;
  }
  ctx.restore();

  // Dialog box (bottom centre).
  if (G.dialog) {
    const d = G.dialog;
    ctx.save();
    ctx.fillStyle = 'rgba(10,18,28,0.85)';
    roundRect(ctx, 90, G.view.h - 130, W - 180, 84, 12);
    ctx.fill();
    ctx.strokeStyle = '#e8722a';
    ctx.lineWidth = 2;
    roundRect(ctx, 90, G.view.h - 130, W - 180, 84, 12);
    ctx.stroke();
    ctx.fillStyle = '#e8722a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(d.speaker, 112, G.view.h - 102);
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    wrapText(ctx, d.text, 112, G.view.h - 78, W - 224, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Tekan tombol apa saja untuk lanjut', W - 112, G.view.h - 58);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  drawMinimap(ctx, G);

  // Off-screen mission arrow at the screen edge.
  const target = missionTarget(G);
  if (target && G.state === 'playing') {
    const sx = target.x - G.cam.x;
    const sy = target.y - G.cam.y;
    if (sx < 0 || sx > W || sy < 0 || sy > G.view.h) {
      const cx = W / 2;
      const cy = G.view.h / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const ex = cx + Math.cos(a) * (W / 2 - 60);
      const ey = cy + Math.sin(a) * (G.view.h / 2 - 90);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = '#f5d76e';
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Blizzard warning.
  if (G.blizzard) {
    ctx.save();
    ctx.fillStyle = 'rgba(180,210,235,0.55)';
    ctx.fillText('❄ BADAI SALJU — jarak pandang terbatas', 24, G.view.h - 150);
    ctx.restore();
  }
}

function drawMinimap(ctx, G) {
  const mw = 190;
  const mh = 142;
  const mx = G.view.w - mw - 14;
  const my = G.view.h - mh - 14;
  const sx = mw / G.world.w;
  const sy = mh / G.world.h;
  ctx.save();
  ctx.fillStyle = 'rgba(10,18,28,0.78)';
  roundRect(ctx, mx - 6, my - 6, mw + 12, mh + 12, 10);
  ctx.fill();
  // Ground.
  ctx.fillStyle = '#dfe9f5';
  ctx.fillRect(mx, my, mw, mh);
  // Lake and slope.
  ctx.fillStyle = '#bcd9ea';
  ctx.fillRect(mx + 2320 * sx, my + 1960 * sy, 840 * sx, 400 * sy);
  ctx.fillStyle = '#e8eef6';
  ctx.fillRect(mx + 40 * sx, my + 260 * sy, 360 * sx, 1900 * sy);
  // Roads.
  ctx.fillStyle = '#5a5f6b';
  for (const r of G.world.roads) {
    ctx.fillRect(mx + r.x * sx, my + r.y * sy, Math.max(2, r.w * sx), Math.max(2, r.h * sy));
  }
  // Mission target.
  const target = missionTarget(G);
  if (target) {
    ctx.fillStyle = '#f5d76e';
    ctx.beginPath();
    ctx.arc(mx + target.x * sx, my + target.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops.
  ctx.fillStyle = '#e33';
  for (const cop of G.police.foot) {
    ctx.fillRect(mx + cop.x * sx - 2, my + cop.y * sy - 2, 4, 4);
  }
  for (const car of G.police.cars) {
    ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
  }
  // Player arrow.
  const p = G.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#e8722a';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function drawTitle(ctx, G) {
  const W = G.view.w;
  const H = G.view.h;
  // Frosty gradient backdrop.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0e2238');
  grad.addColorStop(0.6, '#274e6e');
  grad.addColorStop(1, '#7fa8c9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // Mountains.
  ctx.fillStyle = '#e8eef6';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(180, 430);
  ctx.lineTo(360, H);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(300, H);
  ctx.lineTo(620, 380);
  ctx.lineTo(940, H);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(820, H);
  ctx.lineTo(1080, 460);
  ctx.lineTo(1280, H);
  ctx.closePath();
  ctx.fill();
  // Snow ground.
  ctx.fillStyle = '#e8eef6';
  ctx.fillRect(0, H - 120, W, 120);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('FROSTPEAK DRIFT', W / 2, 150);
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Kota ski. Jalan es. Satu sopir snowplow melawan kru saingan.', W / 2, 190);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  ctx.fillText('Tekan ENTER atau klik untuk mulai', W / 2, 250);
  if (G.hasSave) {
    ctx.fillStyle = '#7ee787';
    ctx.fillText('Tekan L untuk lanjut dari simpanan terakhir', W / 2, 280);
  }

  // Controls panel.
  ctx.fillStyle = 'rgba(10,18,28,0.72)';
  roundRect(ctx, W / 2 - 250, 310, 500, CONTROLS.length * 30 + 40, 12);
  ctx.fill();
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('KONTROL', W / 2, 342);
  ctx.font = '15px sans-serif';
  CONTROLS.forEach((c, i) => {
    const y = 372 + i * 30;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(c[0], W / 2 - 220, y);
    ctx.fillStyle = '#bcd9ea';
    ctx.fillText(c[1], W / 2 - 60, y);
    ctx.textAlign = 'center';
  });
  ctx.fillStyle = '#33506a';
  ctx.font = '13px sans-serif';
  ctx.fillText('Game open-world 2D — dibuat untuk bounty Make GTA 6 di make.fun', W / 2, H - 24);
  ctx.textAlign = 'left';
}

export function drawPause(ctx, G) {
  const W = G.view.w;
  const H = G.view.h;
  ctx.fillStyle = 'rgba(8,14,24,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('JEDA', W / 2, H / 2 - 60);
  ctx.font = '18px sans-serif';
  ctx.fillText('Tekan P untuk lanjut bermain', W / 2, H / 2 - 10);
  ctx.fillText('Tekan R untuk mulai ulang dari awal', W / 2, H / 2 + 24);
  ctx.fillText('Tekan M untuk bisu / nyalakan suara', W / 2, H / 2 + 58);
  ctx.textAlign = 'left';
}

export function drawEndScreen(ctx, G, kind) {
  const W = G.view.w;
  const H = G.view.h;
  ctx.fillStyle = kind === 'complete' ? 'rgba(20,60,30,0.85)' : 'rgba(40,10,14,0.85)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 52px sans-serif';
  const title = kind === 'complete'
    ? 'FROSTPEAK MILIKMU!'
    : kind === 'busted' ? 'TERTANGKAP!' : 'GAME OVER';
  ctx.fillText(title, W / 2, H / 2 - 90);
  ctx.font = '19px sans-serif';
  const lines = kind === 'complete'
    ? [
        'Raka mencuri simpanan kru, kabur dari kejaran lima bintang,',
        'dan menghilang ke dalam badai. Legenda Frostpeak lahir malam itu.',
      ]
    : kind === 'busted'
      ? ['Polisi mengepungmu. Raka dibawa ke kantor polisi Frostpeak.', 'Coba lagi — kota ini belum selesai denganmu.']
      : ['Raka tumbang di tengah salju. Frostpeak memang kejam.', 'Coba lagi — kota ini belum selesai denganmu.'];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 - 40 + i * 28));
  ctx.fillStyle = '#ffd94d';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`Uang akhir: $${G.player.money}   •   Misi selesai: ${G.missions.index} dari 6`, W / 2, H / 2 + 50);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  ctx.fillText('Tekan ENTER untuk main lagi', W / 2, H / 2 + 100);
  ctx.textAlign = 'left';
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = w;
      cy += lh;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
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

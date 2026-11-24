// Cenário: dojo no pôr do sol, desenhado pelo próprio código.
import { W, H, GROUND } from './config.js';

let cached = null;

function mountains(ctx, baseY, height, color, seed, peaks) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H);
  let x = 0;
  let s = seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  ctx.lineTo(0, baseY);
  while (x <= W + 100) {
    const w = W / peaks * (0.6 + rnd() * 0.8);
    const h = height * (0.5 + rnd() * 0.5);
    ctx.lineTo(x + w / 2, baseY - h);
    ctx.lineTo(x + w, baseY - h * 0.15 * rnd());
    x += w;
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
}

function lantern(ctx, x, y) {
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, 4, x, y, 70);
  glow.addColorStop(0, 'rgba(255,190,90,.55)');
  glow.addColorStop(1, 'rgba(255,190,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 70, y - 70, 140, 140);
  ctx.strokeStyle = '#2a1410';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y - 60); ctx.lineTo(x, y - 26); ctx.stroke();
  ctx.fillStyle = '#e2492f';
  ctx.beginPath(); ctx.ellipse(x, y, 20, 26, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,220,140,.6)';
  ctx.beginPath(); ctx.ellipse(x - 5, y - 4, 7, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2a1410';
  ctx.fillRect(x - 12, y - 28, 24, 5);
  ctx.fillRect(x - 12, y + 23, 24, 5);
  ctx.restore();
}

function render() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  // Céu do pôr do sol.
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND - 60);
  sky.addColorStop(0, '#1d1240');
  sky.addColorStop(0.45, '#7a2f6b');
  sky.addColorStop(0.8, '#f0794a');
  sky.addColorStop(1, '#ffc46b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Estrelinhas.
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  let s = 7;
  for (let i = 0; i < 70; i++) {
    s = (s * 9301 + 49297) % 233280;
    const x = (s / 233280) * W;
    s = (s * 9301 + 49297) % 233280;
    const y = (s / 233280) * 200;
    ctx.fillRect(x, y, 2, 2);
  }

  // Sol.
  const sunY = GROUND - 190;
  const sun = ctx.createRadialGradient(W / 2, sunY, 20, W / 2, sunY, 220);
  sun.addColorStop(0, 'rgba(255,240,190,1)');
  sun.addColorStop(0.35, 'rgba(255,190,110,.8)');
  sun.addColorStop(1, 'rgba(255,150,80,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffe6a8';
  ctx.beginPath(); ctx.arc(W / 2, sunY, 85, 0, Math.PI * 2); ctx.fill();

  // Montanhas em camadas.
  mountains(ctx, GROUND - 120, 230, '#8a3d63', 11, 5);
  mountains(ctx, GROUND - 95, 160, '#5b2a52', 23, 7);
  mountains(ctx, GROUND - 80, 90, '#3a1d3f', 5, 9);

  // Portal (torii) ao fundo.
  const gx = W / 2;
  const gTop = GROUND - 330;
  ctx.fillStyle = '#b42a22';
  ctx.fillRect(gx - 190, gTop + 40, 22, 250);
  ctx.fillRect(gx + 168, gTop + 40, 22, 250);
  ctx.fillRect(gx - 230, gTop + 70, 460, 18);
  ctx.fillStyle = '#2a1410';
  ctx.beginPath();
  ctx.moveTo(gx - 270, gTop + 20);
  ctx.quadraticCurveTo(gx, gTop + 45, gx + 270, gTop + 20);
  ctx.lineTo(gx + 260, gTop + 42);
  ctx.quadraticCurveTo(gx, gTop + 62, gx - 260, gTop + 42);
  ctx.closePath();
  ctx.fill();

  // Parede do dojo (madeira escura) com janelas de papel.
  const wallTop = GROUND - 120;
  ctx.fillStyle = '#3b2016';
  ctx.fillRect(0, wallTop, W, 40);
  for (let x = 0; x < W; x += 160) {
    ctx.fillStyle = 'rgba(255,225,170,.25)';
    ctx.fillRect(x + 12, wallTop + 6, 136, 28);
    ctx.strokeStyle = '#2a140c';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 12, wallTop + 6, 136, 28);
    ctx.beginPath();
    ctx.moveTo(x + 80, wallTop + 6); ctx.lineTo(x + 80, wallTop + 34);
    ctx.moveTo(x + 12, wallTop + 20); ctx.lineTo(x + 148, wallTop + 20);
    ctx.stroke();
  }
  ctx.fillStyle = '#24110a';
  ctx.fillRect(0, wallTop + 40, W, 8);

  // Piso de madeira em perspectiva.
  const floorTop = wallTop + 48;
  const floor = ctx.createLinearGradient(0, floorTop, 0, H);
  floor.addColorStop(0, '#6b3a22');
  floor.addColorStop(0.4, '#9a5a32');
  floor.addColorStop(1, '#5a2f1b');
  ctx.fillStyle = floor;
  ctx.fillRect(0, floorTop, W, H - floorTop);
  ctx.strokeStyle = 'rgba(40,18,8,.45)';
  ctx.lineWidth = 2;
  const vanishX = W / 2;
  for (let i = -14; i <= 14; i++) {
    ctx.beginPath();
    ctx.moveTo(vanishX + i * 40, floorTop);
    ctx.lineTo(vanishX + i * 150, H);
    ctx.stroke();
  }
  for (const y of [floorTop + 18, floorTop + 45, floorTop + 85, floorTop + 140]) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // Reflexo do sol no chão.
  const shine = ctx.createRadialGradient(W / 2, floorTop + 40, 10, W / 2, floorTop + 40, 420);
  shine.addColorStop(0, 'rgba(255,200,120,.35)');
  shine.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, floorTop, W, H - floorTop);

  lantern(ctx, 120, wallTop - 70);
  lantern(ctx, W - 120, wallTop - 70);
  return c;
}

export function drawStage(ctx) {
  if (!cached) cached = render();
  ctx.drawImage(cached, 0, 0);
}

import { W, H, GAME_TITLE } from './config.js';
import { loadCharacter, webpSupported } from './assets.js';
import { KeyboardController, TouchController, MergedController, isTouchDevice, onKey } from './input.js';
import { CpuController } from './ai.js';
import { Match } from './game.js';
import { drawStage } from './stage.js';
import { unlockAudio, sfx, toggleMute } from './audio.js';
import { MOVE_LIST } from './moves.js';

// Lutadores (nome da pasta em web/assets). Para adicionar um novo, exporte com
// tools/export_web.py e coloque o nome aqui.
const ROSTER = ['jessy', 'gui', 'kaua'];

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingQuality = 'high';
const touchEl = document.getElementById('touch');
const rotateEl = document.getElementById('rotate');
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

// Safari/Chrome no celular ainda dão zoom com vários toques, mesmo com viewport fixo.
function blockMobileZoom() {
  if (!isTouchDevice()) return;
  const stop = (e) => e.preventDefault();
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(ev, stop, { passive: false });
  }
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
}
blockMobileZoom();

// Celular (joystick e botões na tela) ou computador (teclado). A pessoa escolhe
// antes do menu; o jogo lembra a escolha.
let touchMode = isTouchDevice();
const kb1 = new KeyboardController('p1');
const kb2 = new KeyboardController('p2');
const touch = new TouchController();
touch.attach();
const CONTROL_KEY = 'garyu_controles';
function savedControlMode() {
  try { return localStorage.getItem(CONTROL_KEY); } catch { return null; }
}
function setControlMode(mode) {
  touchMode = mode === 'celular';
  try { localStorage.setItem(CONTROL_KEY, mode); } catch { /* sem armazenamento: tudo bem */ }
  resize();
}

let screen = 'loading';
let progress = 0;
let chars = [];          // lutadores carregados (mesma ordem do ROSTER)
let match = null;
let menuIndex = 0;
let muted = false;
let menuItems = [];
let overlayItems = [];
let players = 1;         // 1 = contra a CPU, 2 = dois no teclado, 0 = demonstração
const pick = { step: 0, cursor: 0, chosen: [] }; // escolha de lutadores

// ------------------------------------------------------------ tela / tamanho
function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = `${Math.floor(W * s)}px`;
  canvas.style.height = `${Math.floor(H * s)}px`;
  rotateEl.hidden = !(touchMode && innerHeight > innerWidth);
}
addEventListener('resize', resize);
resize();

function goFullscreen() {
  if (!touchMode || document.fullscreenElement) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req) {
    Promise.resolve(req.call(el)).then(() => {
      const o = window.screen.orientation;
      if (o && o.lock) o.lock('landscape').catch(() => {});
    }).catch(() => {});
  }
}

// ------------------------------------------------------------ partida
function startMatch(mode, chosen) {
  players = mode;
  const picked = chosen || pick.chosen;
  let p1 = new MergedController(kb1, touch);
  const p2 = mode === 2 ? kb2 : new CpuController();
  if (mode === 0) p1 = new CpuController();
  const labels = mode === 0
    ? [{ label: 'CPU 1', color: '#4fb3ff' }, { label: 'CPU 2', color: '#ff5d5d' }]
    : [{ label: 'P1', color: '#4fb3ff' }, { label: mode === 2 ? 'P2' : 'CPU', color: '#ff5d5d' }];
  match = new Match([chars[picked[0]], chars[picked[1]]], [p1, p2], labels, DEBUG);
  screen = 'game';
}

function openSelect(mode) {
  players = mode;
  pick.step = 0;
  pick.cursor = 0;
  pick.chosen = [];
  screen = 'select';
}

function choose(i) {
  sfx('select');
  pick.chosen[pick.step] = i;
  if (pick.step === 0) {
    pick.step = 1;
    pick.cursor = (i + 1) % chars.length; // sugere o outro lutador
  } else {
    startMatch(players);
  }
}

function menuOptions() {
  const items = [{ text: '1 JOGADOR', action: () => openSelect(1) }];
  if (!touchMode) items.push({ text: '2 JOGADORES', action: () => openSelect(2) });
  items.push({ text: 'COMO JOGAR', action: () => { screen = 'help'; } });
  items.push({
    text: touchMode ? 'CONTROLES: CELULAR' : 'CONTROLES: COMPUTADOR',
    action: () => setControlMode(touchMode ? 'pc' : 'celular'),
  });
  items.push({ text: muted ? 'SOM: DESLIGADO' : 'SOM: LIGADO', action: () => { muted = toggleMute(); } });
  return items;
}

function activate(items, i) {
  unlockAudio();
  sfx('select');
  items[i].action();
}

const toTitle = () => { screen = 'title'; menuIndex = 0; };

onKey((code) => {
  unlockAudio();
  if (code === 'KeyM') muted = toggleMute();
  if (screen === 'help') {
    if (['ArrowLeft', 'KeyA'].includes(code)) helpChar = (helpChar + chars.length - 1) % chars.length;
    if (['ArrowRight', 'KeyD'].includes(code)) helpChar = (helpChar + 1) % chars.length;
    if (['Escape', 'Enter', 'KeyJ', 'Space'].includes(code)) toTitle();
    return;
  }
  if (screen === 'device') {
    if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(code)) menuIndex = 1 - menuIndex;
    if (code === 'Enter' || code === 'KeyJ' || code === 'Space') activate(deviceItems, menuIndex);
  } else if (screen === 'title') {
    const items = menuOptions();
    if (code === 'ArrowUp' || code === 'KeyW') menuIndex = (menuIndex + items.length - 1) % items.length;
    if (code === 'ArrowDown' || code === 'KeyS') menuIndex = (menuIndex + 1) % items.length;
    if (code === 'Enter' || code === 'KeyJ' || code === 'Space') activate(items, menuIndex);
  } else if (screen === 'select') {
    // Quem escolhe agora: P1 usa A/D + J; P2 (no modo 2 jogadores) usa setas + N.
    const p2turn = players === 2 && pick.step === 1;
    const left = p2turn ? ['ArrowLeft'] : ['KeyA', 'ArrowLeft'];
    const right = p2turn ? ['ArrowRight'] : ['KeyD', 'ArrowRight'];
    const ok = p2turn ? ['KeyN', 'Enter', 'Numpad1'] : ['KeyJ', 'Enter', 'Space'];
    if (left.includes(code)) pick.cursor = (pick.cursor + chars.length - 1) % chars.length;
    if (right.includes(code)) pick.cursor = (pick.cursor + 1) % chars.length;
    if (ok.includes(code)) choose(pick.cursor);
    if (code === 'Escape') toTitle();
  } else if (screen === 'game') {
    if (match.over) {
      if (code === 'Enter' || code === 'Space') startMatch(players);
      if (code === 'Escape') toTitle();
    } else if (code === 'Escape' || code === 'KeyP') { screen = 'paused'; menuIndex = 0; }
  } else if (screen === 'paused') {
    if (code === 'Escape' || code === 'KeyP' || code === 'Enter') screen = 'game';
    if (code === 'KeyQ') toTitle();
  }
});

document.getElementById('pause-btn').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (screen === 'game' && !match.over) screen = 'paused';
  else if (screen === 'paused') screen = 'game';
});

function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}
const hit = (items, p) => items.findIndex((it) => it.rect
  && p.x >= it.rect.x && p.x <= it.rect.x + it.rect.w && p.y >= it.rect.y && p.y <= it.rect.y + it.rect.h);

// Toques/cliques nos menus. No celular os controles ficam por cima do jogo,
// então os menus também escutam a camada de toque.
function onPointer(e) {
  unlockAudio();
  goFullscreen();
  const p = canvasPoint(e);
  if (screen === 'help') {
    const t = hit(helpTabs, p);
    if (t >= 0) { helpChar = t; sfx('select'); } else if (hit([backBtn], p) === 0) toTitle();
    return;
  }
  if (screen === 'select') {
    const i = hit(cards, p);
    if (i >= 0) { pick.cursor = i; choose(i); }
    else if (hit([backBtn], p) === 0) toTitle();
    return;
  }
  const items = screen === 'title' ? menuItems : screen === 'device' ? deviceItems : overlayItems;
  const i = hit(items, p);
  if (i >= 0) { menuIndex = i; activate(items, i); }
}
canvas.addEventListener('pointerdown', (e) => {
  if (isTouchDevice()) e.preventDefault();
  onPointer(e);
});
touchEl.addEventListener('pointerdown', (e) => {
  if (isTouchDevice()) e.preventDefault();
  if (screen !== 'game' || match?.over) onPointer(e);
}, true);

// ------------------------------------------------------------ desenho de telas
function text(str, x, y, size, color = '#fff', align = 'center', weight = 800) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.lineWidth = Math.max(3, size / 8);
  ctx.strokeStyle = 'rgba(20,5,20,.85)';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function drawButtons(items, cx, y0, w = 420, h = 64, gap = 18) {
  items.forEach((it, i) => {
    const y = y0 + i * (h + gap);
    it.rect = { x: cx - w / 2, y, w, h };
    const sel = i === menuIndex;
    ctx.fillStyle = sel ? 'rgba(255,190,60,.95)' : 'rgba(20,10,30,.75)';
    ctx.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(it.rect.x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
    text(it.text, cx, y + h / 2 + 11, 30, sel ? '#2a0b18' : '#fff');
  });
}

function drawLoading() {
  ctx.fillStyle = '#120b1e';
  ctx.fillRect(0, 0, W, H);
  text(GAME_TITLE, W / 2, H / 2 - 40, 64, '#ffd46b');
  ctx.fillStyle = 'rgba(255,255,255,.15)';
  ctx.fillRect(W / 2 - 250, H / 2 + 10, 500, 18);
  ctx.fillStyle = '#ffb347';
  ctx.fillRect(W / 2 - 250, H / 2 + 10, 500 * progress, 18);
  text('Carregando...', W / 2, H / 2 + 70, 24);
}

function drawFullBody(img, x, bottom, h, flip) {
  const w = img.width * (h / img.height);
  ctx.save();
  ctx.translate(x, bottom);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -w / 2, -h, w, h);
  ctx.restore();
}

function drawTitle(t) {
  drawStage(ctx);
  ctx.fillStyle = 'rgba(10,4,20,.45)';
  ctx.fillRect(0, 0, W, H);
  // Um lutador de cada lado, olhando para o meio.
  const a = chars[0];
  const b = chars[1 % chars.length];
  drawFullBody(a.select, 190, H, 540, false);
  drawFullBody(b.select, W - 190, H, 560, true);

  ctx.save();
  ctx.translate(W / 2, 150);
  ctx.rotate(-0.03);
  text(GAME_TITLE, 0, 0, 104, '#ffd46b', 'center', 900);
  ctx.restore();

  menuItems = menuOptions();
  drawButtons(menuItems, W / 2, 222, 420, 54, 12);

  const help = touchMode
    ? ['Joystick: andar / pular / agachar', 'PODER = energia   ↑+PODER = especial   ↓+PODER = redemoinho', 'Barra SUPER cheia: PESADO + PODER juntos']
    : ['P1: WASD andar   J soco   K chute   L pesado   I poder', 'P2: setas   N soco   M chute   , pesado   . poder', '↑+PODER especial   ↓+PODER redemoinho   PESADO+PODER super   ESC pausa'];
  help.forEach((l, i) => text(l, W / 2, H - 92 + i * 30, 20, '#ffe9c7', 'center', 700));
}

let cards = [];
const backBtn = { rect: { x: 24, y: 24, w: 150, h: 48 } };

function drawSelect(t) {
  drawStage(ctx);
  ctx.fillStyle = 'rgba(10,4,20,.55)';
  ctx.fillRect(0, 0, W, H);
  const who = pick.step === 0 ? 'JOGADOR 1' : players === 2 ? 'JOGADOR 2' : 'ADVERSÁRIO (CPU)';
  text('ESCOLHA O LUTADOR', W / 2, 78, 52, '#ffd46b', 'center', 900);
  text(who, W / 2, 122, 28, pick.step === 0 ? '#4fb3ff' : '#ff5d5d');

  const cw = 330;
  const ch = 470;
  const gap = 60;
  const total = chars.length * cw + (chars.length - 1) * gap;
  cards = chars.map((c, i) => ({ rect: { x: W / 2 - total / 2 + i * (cw + gap), y: 160, w: cw, h: ch } }));
  chars.forEach((c, i) => {
    const r = cards[i].rect;
    const sel = i === pick.cursor;
    ctx.save();
    ctx.fillStyle = sel ? 'rgba(255,190,60,.25)' : 'rgba(20,10,30,.6)';
    ctx.strokeStyle = sel ? '#ffd46b' : 'rgba(255,255,255,.35)';
    ctx.lineWidth = sel ? 5 : 3;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 18);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 18);
    ctx.clip();
    drawFullBody(c.select, r.x + r.w / 2, r.y + r.h - 70, 380, i % 2 === 1);
    ctx.restore();
    text(c.displayName, r.x + r.w / 2, r.y + r.h - 22, 38, sel ? '#ffd46b' : '#fff', 'center', 900);
    // Marca de quem já escolheu este lutador.
    if (pick.step === 1 && pick.chosen[0] === i) text('P1', r.x + 36, r.y + 44, 30, '#4fb3ff');
  });

  // Voltar.
  ctx.fillStyle = 'rgba(20,10,30,.75)';
  ctx.beginPath();
  ctx.roundRect(backBtn.rect.x, backBtn.rect.y, backBtn.rect.w, backBtn.rect.h, 12);
  ctx.fill();
  text('◀ VOLTAR', backBtn.rect.x + backBtn.rect.w / 2, backBtn.rect.y + 33, 22);
  text(touchMode ? 'Toque no lutador' : 'A/D ou setas para escolher, J ou Enter para confirmar', W / 2, H - 24, 20, '#ffe9c7', 'center', 700);
}

// ------------------------------------------------------------ como jogar
let helpChar = 0;
let helpTabs = [];

function panel(x, y, w, h) {
  ctx.fillStyle = 'rgba(15,8,25,.82)';
  ctx.strokeStyle = 'rgba(255,255,255,.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.fill();
  ctx.stroke();
}

function drawHelp() {
  drawStage(ctx);
  ctx.fillStyle = 'rgba(10,4,20,.6)';
  ctx.fillRect(0, 0, W, H);
  text('COMO JOGAR', W / 2, 70, 54, '#ffd46b', 'center', 900);

  // Controles.
  panel(30, 100, 520, 590);
  text('CONTROLES', 290, 140, 28, '#ffd46b', 'center', 900);
  const linhas = touchMode
    ? [['Joystick ← →', 'andar'], ['Joystick ↑', 'pular'], ['Joystick ↓', 'agachar'],
      ['SOCO  CHUTE', 'golpes rápidos'], ['PESADO', 'golpe pesado'], ['PODER', 'golpes especiais'], ['II', 'pausa']]
    : [['A  D', 'andar (P1)'], ['W', 'pular'], ['S', 'agachar'],
      ['J  K  L  I', 'soco, chute, pesado, poder'], ['P2: setas', 'N  M  ,  .'], ['ESC', 'pausa'], ['M', 'liga/desliga o som']];
  linhas.forEach(([k, v], i) => {
    text(k, 60, 190 + i * 40, 22, '#9fe3ff', 'left', 800);
    text(v, 250, 190 + i * 40, 22, '#fff', 'left', 700);
  });
  const dicas = [
    '→ = para o lado do adversário',
    'Defender: segure para trás',
    '(agachado defende golpe baixo)',
    'Dash: toque 2x para frente/trás',
    'A barra SUPER enche quando',
    'você bate e quando apanha',
  ];
  dicas.forEach((l, i) => text(l, 290, 485 + i * 32, 20, '#ffe9c7', 'center', 700));

  // Golpes do lutador escolhido nas abas.
  panel(570, 100, 680, 590);
  helpTabs = chars.map((c, i) => ({ rect: { x: 590 + i * 215, y: 115, w: 205, h: 64 } }));
  chars.forEach((c, i) => {
    const r = helpTabs[i].rect;
    const sel = i === helpChar;
    ctx.fillStyle = sel ? 'rgba(255,190,60,.95)' : 'rgba(255,255,255,.08)';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    const img = c.portrait;
    const ph = 54;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(r.x + 6, r.y + 5, 54, ph, 8);
    ctx.clip();
    ctx.drawImage(img, r.x + 6 + 27 - (img.width * ph / img.height) / 2, r.y + 5, img.width * ph / img.height, ph);
    ctx.restore();
    text(c.displayName, r.x + 132, r.y + 42, 26, sel ? '#2a0b18' : '#fff', 'center', 900);
  });
  const lista = MOVE_LIST[chars[helpChar].name] || [];
  lista.forEach(([cmd, nome], i) => {
    const y = 222 + i * 42;
    const especial = cmd.includes('PODER');
    text(cmd, 600, y, 21, especial ? '#9fe3ff' : '#ffd46b', 'left', 900);
    text(nome, 830, y, 21, '#fff', 'left', 700);
  });

  ctx.fillStyle = 'rgba(20,10,30,.85)';
  ctx.beginPath();
  ctx.roundRect(backBtn.rect.x, backBtn.rect.y, backBtn.rect.w, backBtn.rect.h, 12);
  ctx.fill();
  text('◀ VOLTAR', backBtn.rect.x + backBtn.rect.w / 2, backBtn.rect.y + 33, 22);
}

let deviceItems = [];
function chooseDevice(mode) {
  setControlMode(mode);
  if (mode === 'celular') goFullscreen();
  toTitle();
}

function drawDevice(t) {
  drawStage(ctx);
  ctx.fillStyle = 'rgba(10,4,20,.6)';
  ctx.fillRect(0, 0, W, H);
  text(GAME_TITLE, W / 2, 120, 84, '#ffd46b', 'center', 900);
  text('COMO VOCÊ VAI JOGAR?', W / 2, 205, 40, '#fff', 'center', 900);
  deviceItems = [
    { text: 'CELULAR', sub: 'joystick e botões na tela', icon: 'phone', action: () => chooseDevice('celular') },
    { text: 'COMPUTADOR', sub: 'teclado', icon: 'pc', action: () => chooseDevice('pc') },
  ];
  const bw = 400;
  const bh = 300;
  const gap = 60;
  deviceItems.forEach((it, i) => {
    const x = W / 2 - bw - gap / 2 + i * (bw + gap);
    const y = 260;
    it.rect = { x, y, w: bw, h: bh };
    const sel = i === menuIndex;
    ctx.fillStyle = sel ? 'rgba(255,190,60,.95)' : 'rgba(20,10,30,.8)';
    ctx.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,.5)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 22);
    ctx.fill();
    ctx.stroke();
    // Ícone desenhado: celular deitado com joystick, ou monitor com teclado.
    const cx = x + bw / 2;
    const cy = y + 115;
    const ink = sel ? '#2a0b18' : '#fff';
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 6;
    if (it.icon === 'phone') {
      ctx.beginPath(); ctx.roundRect(cx - 110, cy - 55, 220, 110, 18); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx - 62, cy + 10, 22, 0, Math.PI * 2); ctx.stroke();
      for (const [dx, dy] of [[55, -15], [80, 10], [55, 35], [30, 10]]) {
        ctx.beginPath(); ctx.arc(cx + dx, cy + dy - 5, 9, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.beginPath(); ctx.roundRect(cx - 95, cy - 70, 190, 115, 10); ctx.stroke();
      ctx.fillRect(cx - 10, cy + 45, 20, 18);
      ctx.beginPath(); ctx.roundRect(cx - 105, cy + 66, 210, 22, 6); ctx.stroke();
    }
    text(it.text, cx, y + 238, 40, sel ? '#2a0b18' : '#fff', 'center', 900);
    text(it.sub, cx, y + 276, 22, sel ? '#3a1a22' : '#ffe9c7', 'center', 700);
  });
  text('Dá para trocar depois no menu', W / 2, H - 40, 22, '#ffe9c7', 'center', 700);
}

function drawPaused() {
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(0, 0, W, H);
  text('PAUSADO', W / 2, 220, 80, '#ffd46b');
  overlayItems = [
    { text: 'CONTINUAR', action: () => { screen = 'game'; } },
    { text: 'SAIR PARA O MENU', action: toTitle },
  ];
  drawButtons(overlayItems, W / 2, 300);
}

function drawMatchOver() {
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  ctx.fillRect(0, 0, W, H);
  const champ = match.champion;
  text(champ ? `${match.nameOf(champ)} VENCEU!` : 'EMPATE!', W / 2, 220, 72, '#ffd46b');
  overlayItems = [
    { text: 'JOGAR DE NOVO', action: () => startMatch(players) },
    { text: 'TROCAR LUTADOR', action: () => openSelect(players === 0 ? 1 : players) },
    { text: 'MENU', action: toTitle },
  ];
  drawButtons(overlayItems, W / 2, 290);
}

// ------------------------------------------------------------ loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (screen === 'loading') drawLoading();
  else if (screen === 'device') drawDevice(now);
  else if (screen === 'help') drawHelp();
  else if (screen === 'title') drawTitle(now);
  else if (screen === 'select') drawSelect(now);
  else if (screen === 'game' || screen === 'paused') {
    if (screen === 'game') {
      // Passos fixos e pequenos: a física fica igual em qualquer celular.
      let left = dt;
      while (left > 0) {
        const step = Math.min(left, 1 / 120);
        match.update(step);
        left -= step;
      }
    }
    match.draw(ctx);
    if (screen === 'paused') drawPaused();
    else if (match.over) drawMatchOver();
  }
  // Joystick e botões só aparecem durante a luta, no modo celular.
  const showTouch = touchMode && (screen === 'game' || screen === 'paused');
  if (touchEl.hidden === showTouch) touchEl.hidden = !showTouch;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const parts = ROSTER.map(() => 0);
webpSupported().then((ok) => {
  if (!ok) throw new Error('Este navegador não abre imagens WebP. Atualize o celular (iPhone: iOS 14 ou mais novo) ou use o Chrome.');
}).then(() => Promise.all(ROSTER.map((name, i) => loadCharacter(name, (p) => {
  parts[i] = p;
  progress = parts.reduce((s, v) => s + v, 0) / parts.length;
}))))
  .then((loaded) => {
    chars = loaded;
    const saved = savedControlMode();
    if (saved) {
      setControlMode(saved);
      screen = 'title';
    } else {
      screen = 'device';
      menuIndex = touchMode ? 0 : 1; // já deixa marcado o que parece ser o aparelho
    }
    window.__game = {
      get screen() { return screen; },
      get match() { return match; },
      start: (mode, a = 0, b = 1) => startMatch(mode, [a, b]),
    };
    if (params.has('demo')) startMatch(0, [0, 1]);
  })
  .catch((err) => {
    console.error(err);
    screen = 'error';
    ctx.fillStyle = '#300';
    ctx.fillRect(0, 0, W, H);
    text('Ops! Não deu para carregar o jogo.', W / 2, H / 2 - 50, 36, '#ffd46b');
    text(err.message, W / 2, H / 2 + 5, 22);
    text('Toque na tela para tentar de novo', W / 2, H / 2 + 70, 26, '#9fe3ff');
    canvas.addEventListener('pointerdown', () => location.reload(), { once: true });
  });

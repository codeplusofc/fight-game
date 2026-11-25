// Controles: teclado (2 jogadores) e tela de toque (joystick + 4 botões).
// Todo controle devolve o mesmo formato:
//   { left, right, up, down, soco, chute, forte, poder }  (true = apertado)

export const BUTTONS = ['soco', 'chute', 'forte', 'poder'];

const KEYMAPS = {
  p1: {
    KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
    KeyJ: 'soco', KeyK: 'chute', KeyL: 'forte', KeyI: 'poder',
  },
  p2: {
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    Numpad1: 'soco', Numpad2: 'chute', Numpad3: 'forte', Numpad5: 'poder',
    KeyN: 'soco', KeyM: 'chute', Comma: 'forte', Period: 'poder',
  },
};

const pressed = new Set();
const listeners = [];

export function onKey(fn) { listeners.push(fn); }

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  pressed.add(e.code);
  listeners.forEach((fn) => fn(e.code));
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => pressed.delete(e.code));
window.addEventListener('blur', () => pressed.clear());

function emptyState() {
  return { left: false, right: false, up: false, down: false, soco: false, chute: false, forte: false, poder: false };
}

export class KeyboardController {
  constructor(which) { this.map = KEYMAPS[which]; }
  read() {
    const s = emptyState();
    for (const [code, action] of Object.entries(this.map)) {
      if (pressed.has(code)) s[action] = true;
    }
    return s;
  }
  /** Alguma tecla deste jogador foi usada? (para trocar a CPU por gente) */
  active() { return Object.keys(this.map).some((c) => pressed.has(c)); }
}

export class TouchController {
  constructor() {
    this.state = emptyState();
    this.used = false;
    this.stickId = null;
    this.stickOrigin = null;
    this.buttonPointers = new Map(); // pointerId -> botão
  }

  attach() {
    const zone = document.getElementById('stick-zone');
    const base = document.getElementById('stick-base');
    const knob = document.getElementById('stick-knob');
    const RADIUS = 60;

    const placeBase = (x, y) => {
      base.style.left = x + 'px';
      base.style.top = y + 'px';
      base.style.bottom = 'auto';
    };
    const resetStick = () => {
      this.stickId = null;
      knob.style.transform = '';
      this.state.left = this.state.right = this.state.up = this.state.down = false;
    };

    zone.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      this.used = true;
      this.stickId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      placeBase(e.clientX, e.clientY);
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stickId) return;
      e.preventDefault();
      let dx = e.clientX - this.stickOrigin.x;
      let dy = e.clientY - this.stickOrigin.y;
      const len = Math.hypot(dx, dy);
      if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dead = 18;
      // 8 direções: diagonal quando o ângulo está entre os eixos.
      this.state.left = dx < -dead && Math.abs(dx) > Math.abs(dy) * 0.45;
      this.state.right = dx > dead && Math.abs(dx) > Math.abs(dy) * 0.45;
      this.state.up = dy < -dead && Math.abs(dy) > Math.abs(dx) * 0.45;
      this.state.down = dy > dead && Math.abs(dy) > Math.abs(dx) * 0.45;
    });
    const end = (e) => { if (e.pointerId === this.stickId) resetStick(); };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);

    // Botões: aceita vários dedos e deslizar de um botão para outro.
    const buttonsEl = document.getElementById('buttons');
    const btnAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return el && el.dataset && el.dataset.btn ? el : null;
    };
    const refresh = () => {
      for (const b of BUTTONS) this.state[b] = false;
      document.querySelectorAll('.btn').forEach((el) => el.classList.remove('on'));
      for (const el of this.buttonPointers.values()) {
        if (!el) continue;
        this.state[el.dataset.btn] = true;
        el.classList.add('on');
      }
    };
    buttonsEl.addEventListener('pointerdown', (e) => {
      this.used = true;
      buttonsEl.setPointerCapture(e.pointerId);
      this.buttonPointers.set(e.pointerId, btnAt(e.clientX, e.clientY));
      refresh();
      e.preventDefault();
    });
    buttonsEl.addEventListener('pointermove', (e) => {
      if (!this.buttonPointers.has(e.pointerId)) return;
      e.preventDefault();
      this.buttonPointers.set(e.pointerId, btnAt(e.clientX, e.clientY));
      refresh();
    });
    const up = (e) => { this.buttonPointers.delete(e.pointerId); refresh(); };
    buttonsEl.addEventListener('pointerup', up);
    buttonsEl.addEventListener('pointercancel', up);
  }

  read() { return { ...this.state }; }
}

/** Junta vários controles (ex.: teclado + toque para o jogador 1). */
export class MergedController {
  constructor(...controllers) { this.controllers = controllers; }
  read() {
    const s = emptyState();
    for (const c of this.controllers) {
      const r = c.read();
      for (const k of Object.keys(s)) s[k] = s[k] || r[k];
    }
    return s;
  }
}

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

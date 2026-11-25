import {
  GROUND, WALL_LEFT, WALL_RIGHT, MAX_HP, SUPER_MAX, SUPER_COST,
  GRAVITY, WALK_FWD, WALK_BACK, JUMP_VY, JUMP_VX, ANIM_SPEED,
} from './config.js';
import { MOVESETS, hurtboxes } from './moves.js';
import { sfx } from './audio.js';

const CONTROLLABLE = new Set(['idle', 'walkF', 'walkB', 'crouch']);
const FADE_MS = 55; // duração da transição suave entre um desenho e outro
const DASH = { DashF: { vx: 800 }, DashB: { vx: -620, hop: 300 } };

export class Fighter {
  /**
   * @param char  personagem carregada por loadCharacter()
   * @param opts  { label: 'P1', color: '#4af' }
   */
  constructor(char, opts) {
    this.char = char;
    this.moves = MOVESETS[char.name];
    this.hurt = hurtboxes(char.standHeight);
    this.label = opts.label;
    this.color = opts.color;
    this.super = 0;
    this.wins = 0;
    this.prev = {};
    this.reset(640, 1);
  }

  reset(x, facing) {
    this.x = x;
    this.y = 0;          // altura acima do chão
    this.vx = 0;
    this.vy = 0;
    this.pushVx = 0;     // empurrão que vai freando
    this.facing = facing; // 1 = olhando para a direita, -1 = esquerda
    this.hp = MAX_HP;
    this.state = 'intro';
    this.timer = 0;
    this.move = null;
    this.moveName = null;
    this.hitDone = false;
    this.lastHitAt = -1e9;
    this.projectileSpawned = false;
    this.rose = false;
    this.buffer = [];    // direções recentes (para comandos tipo ↓→ + soco)
    this.lastDir = 'N';
    this.tapF = -1e9;
    this.tapB = -1e9;
    this.invulnerable = 0;
    this.play('Starting');
  }

  // ---------------------------------------------------------------- animação
  play(name, { loop = false } = {}) {
    this.anim = name;
    this.animT = 0;
    this.loop = loop;
  }

  get animData() { return this.char.anims[this.anim]; }

  get frameIndex() {
    const a = this.animData;
    const i = Math.floor(this.animT / a.ms);
    return this.loop ? i % a.frames.length : Math.min(i, a.frames.length - 1);
  }

  get animDone() {
    const a = this.animData;
    return !this.loop && this.animT >= a.frames.length * a.ms;
  }

  /** Duração real (ms) de uma animação, já com a velocidade do jogo. */
  animDuration(name) {
    const a = this.char.anims[name];
    return (a.frames.length * a.ms) / ANIM_SPEED;
  }

  // ---------------------------------------------------------------- estado
  get onGround() { return this.y <= 0 && this.vy <= 0; }
  get controllable() { return CONTROLLABLE.has(this.state); }
  get crouching() {
    return this.state === 'crouch' || (this.state === 'attack' && this.moveName === 'LK')
      || (this.state === 'hit' && this.anim === 'CrouchHit');
  }
  get alive() { return this.hp > 0; }

  hurtbox() {
    if (this.invulnerable > 0 || ['knockdown', 'lose', 'win', 'intro'].includes(this.state)) return null;
    if (this.move && this.move.invulnerable) {
      const [a, b] = this.move.invulnerable;
      if (this.frameIndex >= a && this.frameIndex <= b) return null;
    }
    const hb = this.y > 30 ? this.hurt.air : this.crouching ? this.hurt.crouch : this.hurt.stand;
    return this.rect(hb);
  }

  attackBox() {
    if (this.state !== 'attack' || !this.move || !this.move.box) return null;
    const [a, b] = this.move.active;
    const f = this.frameIndex;
    if (f < a || f > b) return null;
    return this.rect(this.move.box);
  }

  /** Converte uma caixa (frente/cima) para retângulo na tela. */
  rect(b) {
    const x0 = this.facing === 1 ? this.x + b.x0 : this.x - b.x1;
    const x1 = this.facing === 1 ? this.x + b.x1 : this.x - b.x0;
    return { x0, x1, y0: GROUND - this.y - b.y1, y1: GROUND - this.y - b.y0 };
  }

  // ---------------------------------------------------------------- entrada
  /** Direção relativa: F = para o oponente, B = para trás. */
  dirToken(inp) {
    const fwd = this.facing === 1 ? inp.right : inp.left;
    const back = this.facing === 1 ? inp.left : inp.right;
    let t = '';
    if (inp.down) t += 'D';
    else if (inp.up) t += 'U';
    if (fwd) t += 'F';
    else if (back) t += 'B';
    return t || 'N';
  }

  recordInput(inp, now) {
    const tok = this.dirToken(inp);
    if (tok !== this.lastDir) {
      // Toque duplo para frente/trás = dash.
      if (tok === 'F' && this.lastDir === 'N') {
        if (now - this.tapF < 260) this.wantDash = 'DashF';
        this.tapF = now;
      }
      if (tok === 'B' && this.lastDir === 'N') {
        if (now - this.tapB < 260) this.wantDash = 'DashB';
        this.tapB = now;
      }
      this.buffer.push({ tok, t: now });
      this.lastDir = tok;
    }
    this.buffer = this.buffer.filter((b) => now - b.t < 500);
  }

  /** O buffer de direções contém esta sequência (em ordem)? */
  did(seq) {
    let i = 0;
    for (const b of this.buffer) {
      if (b.tok === seq[i]) i++;
      if (i === seq.length) return true;
    }
    return false;
  }

  chooseAttack(inp, pressed) {
    const fwd = this.facing === 1 ? inp.right : inp.left;
    const wantSuper = (pressed.poder && inp.forte) || (pressed.forte && inp.poder);
    if (wantSuper) {
      const ultra = this.moves.Ultra;
      if (inp.down && ultra && this.super >= ultra.cost) return 'Ultra';
      if (this.super >= SUPER_COST) return 'SuperTatsu';
    }

    // Comandos clássicos no teclado: ↓↘→ + soco, →↓↘ + soco, ↓↙← + chute.
    if (pressed.soco || pressed.forte) {
      if (this.did(['F', 'D', 'DF'])) return 'Shoryuken';
      if (this.did(['D', 'DF', 'F']) || this.did(['D', 'F'])) return 'Hadoken';
    }
    if (pressed.chute || pressed.forte) {
      if (this.did(['D', 'DB', 'B']) || this.did(['D', 'B'])) return pressed.forte ? 'HTatsu' : 'MTatsu';
    }

    // Jeito fácil (celular): PODER + direção.
    if (pressed.poder) {
      if (inp.up) return 'Shoryuken';
      if (inp.down) return 'MTatsu';
      return 'Hadoken';
    }
    if (pressed.forte) return inp.down ? 'HK' : 'HP';
    if (pressed.chute) return inp.down ? 'LK' : 'MK';
    if (pressed.soco) return fwd ? 'MP' : 'LP';
    return null;
  }

  startMove(name, game) {
    const m = this.moves[name];
    if (name === 'Hadoken' && game.hasProjectile(this)) return;
    if (m.super) {
      const cost = m.cost || SUPER_COST;
      if (this.super < cost) return;
      this.super -= cost;
      game.superFlash(this);
    }
    this.state = 'attack';
    this.move = m;
    this.moveName = name;
    this.hitDone = false;
    this.lastHitAt = -1e9;
    this.projectileSpawned = false;
    this.rose = false;
    this.vx = 0;
    this.play(m.anim);
    if (m.sfx) sfx(m.sfx === 'whoosh' && m.heavy ? 'whooshHeavy' : m.sfx);
    this.buffer = [];
  }

  faceOpponent(opp) {
    if (Math.abs(opp.x - this.x) > 4) this.facing = opp.x > this.x ? 1 : -1;
  }

  // ---------------------------------------------------------------- update
  update(dt, inp, opp, game) {
    const now = game.time;
    const pressed = {};
    for (const b of ['soco', 'chute', 'forte', 'poder']) pressed[b] = inp[b] && !this.prev[b];
    this.prev = { ...inp };
    this.input = inp;
    this.recordInput(inp, now);
    this.animT += dt * 1000 * ANIM_SPEED;
    if (this.invulnerable > 0) this.invulnerable -= dt * 1000;

    const fwdHeld = this.facing === 1 ? inp.right : inp.left;
    const backHeld = this.facing === 1 ? inp.left : inp.right;
    this.holdingBack = backHeld;

    switch (this.state) {
      case 'intro':
        if (this.animDone) this.toIdle();
        break;

      case 'idle': case 'walkF': case 'walkB': case 'crouch': {
        if (!game.fighting) { this.setGround('idle', 'Standing'); break; }
        this.faceOpponent(opp);
        const atk = this.chooseAttack(inp, pressed);
        if (atk) { this.startMove(atk, game); break; }
        if (this.wantDash) {
          const d = this.wantDash;
          this.wantDash = null;
          this.state = 'dash';
          this.dash = d;
          this.play(d);
          if (DASH[d].hop) this.vy = DASH[d].hop;
          break;
        }
        if (inp.up) {
          const dirX = inp.right ? 1 : inp.left ? -1 : 0;
          this.state = 'jump';
          this.vy = JUMP_VY;
          this.vx = dirX * JUMP_VX;
          this.play('Jump');
          sfx('jump');
          break;
        }
        if (inp.down) this.setGround('crouch', 'Crouch');
        else if (fwdHeld) this.setGround('walkF', 'WalkingF', true);
        else if (backHeld) this.setGround('walkB', 'WalkingB', true);
        else this.setGround('idle', 'Standing', true);
        const speed = this.state === 'walkF' ? WALK_FWD : this.state === 'walkB' ? -WALK_BACK : 0;
        this.x += speed * this.facing * dt;
        break;
      }

      case 'jump':
        if (this.onGround && this.animT > 150) { sfx('land'); this.toIdle(); }
        break;

      case 'dash':
        this.x += DASH[this.dash].vx * this.facing * dt;
        if (this.animDone && this.onGround) this.toIdle();
        break;

      case 'attack': this.updateAttack(dt, game); break;

      case 'block': case 'hit':
        this.timer -= dt * 1000;
        if (this.timer <= 0 && this.onGround) this.toIdle();
        break;

      case 'knockdown':
        // No ar, segura o frame de "caindo" até encostar no chão.
        if (!this.onGround && this.frameIndex >= 10) this.animT = 10 * this.animData.ms;
        if (this.onGround) this.vx *= Math.exp(-8 * dt);
        if (this.animDone && this.onGround) { this.invulnerable = 250; this.toIdle(); }
        break;

      case 'lose':
        if (this.onGround) this.vx *= Math.exp(-6 * dt);
        break;

      case 'win':
        break;

      default: break;
    }

    this.physics(dt);
  }

  updateAttack(dt, game) {
    const m = this.move;
    const f = this.frameIndex;
    if (m.projectileAt !== undefined && !this.projectileSpawned && f >= m.projectileAt) {
      this.projectileSpawned = true;
      game.spawnProjectile(this);
    }
    if (m.rise && !this.rose && f >= m.rise.at) {
      this.rose = true;
      this.vy = m.rise.vy;
      this.vx = m.rise.vx * this.facing;
    }
    if (m.spin) {
      const [a, b] = m.active;
      if (f >= a && f <= b + 1) {
        this.x += m.spin.vx * this.facing * dt;
        this.y += (m.spin.lift - this.y) * Math.min(1, dt * 12);
        this.vy = 0;
      }
    }
    if (this.animDone && this.onGround) this.toIdle();
  }

  setGround(state, anim, loop = false) {
    if (this.state !== state || this.anim !== anim) {
      this.state = state;
      this.play(anim, { loop: loop || anim === 'Crouch' });
    }
  }

  toIdle() {
    this.move = null;
    this.moveName = null;
    this.vx = 0;
    this.state = 'idle';
    if (this.input && this.input.down) {
      this.state = 'crouch';
      this.play('Crouch', { loop: true });
    } else {
      this.play('Standing', { loop: true });
    }
  }

  physics(dt) {
    const spinning = this.state === 'attack' && this.move && this.move.spin
      && this.frameIndex >= this.move.active[0] && this.frameIndex <= this.move.active[1] + 1;
    if (!spinning && (this.y > 0 || this.vy > 0)) {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) { this.y = 0; this.vy = 0; }
    }
    this.x += (this.vx + this.pushVx) * dt;
    this.pushVx *= Math.exp(-9 * dt);
    if (Math.abs(this.pushVx) < 5) this.pushVx = 0;
    if (this.onGround && ['jump', 'dash'].indexOf(this.state) < 0 && this.state !== 'attack'
      && this.state !== 'knockdown' && this.state !== 'lose') this.vx = 0;
    this.x = Math.max(WALL_LEFT, Math.min(WALL_RIGHT, this.x));
  }

  // ---------------------------------------------------------------- apanhar
  /** Recebe um golpe. Devolve 'block' ou 'hit'. */
  receiveHit(attacker, move, isLastHit = false) {
    const dir = Math.sign(this.x - attacker.x) || -this.facing;
    const canBlock = (this.controllable || this.state === 'block') && this.onGround
      && this.holdingBack && !(move.low && !this.input?.down);

    if (canBlock) {
      this.hp = Math.max(0, this.hp - Math.ceil(move.dmg / 5));
      this.state = 'block';
      this.timer = 220;
      this.play(this.input?.down ? 'Crouch' : 'Block');
      this.pushVx = dir * move.push * 0.8;
      this.super = Math.min(SUPER_MAX, this.super + move.dmg * 0.25);
      sfx('block');
      if (this.hp <= 0) this.knockOut(dir);
      return 'block';
    }

    this.hp = Math.max(0, this.hp - move.dmg);
    this.super = Math.min(SUPER_MAX, this.super + move.dmg * 0.35);
    this.move = null;
    this.moveName = null;
    const forte = move.heavy || move.dmg >= 30;
    sfx(forte ? 'hitHeavy' : 'hitLight');

    if (this.hp <= 0) { this.knockOut(dir); return 'hit'; }

    let reaction = move.hit;
    if (isLastHit && move.lastHit) reaction = move.lastHit;
    if (this.y > 0 && reaction === 'hit') reaction = 'knockdown'; // apanhou no ar: cai

    if (reaction === 'hit') {
      const crouch = this.input?.down && this.onGround;
      this.state = 'hit';
      this.play(crouch ? 'CrouchHit' : 'Hit');
      this.timer = this.animDuration(this.anim);
      this.pushVx = dir * move.push;
      this.vx = 0;
    } else {
      this.state = 'knockdown';
      this.play('Knockback');
      this.vy = reaction === 'launch' ? 950 : 600;
      this.vx = dir * (reaction === 'launch' ? 170 : 260);
      this.pushVx = 0;
    }
    return 'hit';
  }

  knockOut(dir) {
    this.state = 'lose';
    this.move = null;
    this.play('Lose');
    this.vx = dir * 160;
    if (this.y > 0) this.vy = Math.max(this.vy, 300);
  }

  win() {
    this.state = 'win';
    this.move = null;
    this.vx = 0;
    this.play('Win');
  }

  // ---------------------------------------------------------------- desenho
  draw(ctx, debug = false) {
    const img = this.char.frames[this.animData.frames[this.frameIndex]];
    const footY = GROUND - this.y;

    // Sombra (diminui quando ela está no alto) e anel colorido do jogador.
    const s = Math.max(0.4, 1 - this.y / 500);
    ctx.save();
    ctx.globalAlpha = 0.35 * s;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(this.x, GROUND + 4, 70 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.55 * s;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(this.x, GROUND + 4, 62 * s, 11 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Transição suave: quando o desenho troca, o anterior vai sumindo por baixo
    // do novo (o braço/perna "arrasta" até a posição nova).
    if (img !== this.curImg) {
      this.prevImg = this.curImg;
      this.curImg = img;
      this.fadeStart = performance.now();
    }
    const fade = this.prevImg ? 1 - (performance.now() - this.fadeStart) / FADE_MS : 0;

    // Desenho: pivô no centro de baixo; espelha quando olha para a esquerda.
    ctx.save();
    ctx.translate(Math.round(this.x), Math.round(footY));
    if (this.facing === -1) ctx.scale(-1, 1);
    const blink = this.invulnerable > 0 && Math.floor(this.invulnerable / 60) % 2 ? 0.6 : 1;
    if (fade > 0) {
      ctx.globalAlpha = fade * 0.75 * blink;
      ctx.drawImage(this.prevImg, -this.prevImg.width / 2, -this.prevImg.height);
    }
    ctx.globalAlpha = blink;
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();

    // Etiqueta P1 / CPU em cima da cabeça.
    if (this.state !== 'lose') {
      const top = footY - this.char.standHeight - 34;
      ctx.save();
      ctx.font = '800 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(this.label, this.x, top);
      ctx.fillStyle = this.color;
      ctx.fillText(this.label, this.x, top);
      ctx.beginPath();
      ctx.moveTo(this.x - 7, top + 6);
      ctx.lineTo(this.x + 7, top + 6);
      ctx.lineTo(this.x, top + 14);
      ctx.fill();
      ctx.restore();
    }

    if (debug) {
      const hb = this.hurtbox();
      const ab = this.attackBox();
      ctx.save();
      ctx.lineWidth = 2;
      if (hb) { ctx.strokeStyle = '#0f0'; ctx.strokeRect(hb.x0, hb.y0, hb.x1 - hb.x0, hb.y1 - hb.y0); }
      if (ab) { ctx.strokeStyle = '#f00'; ctx.strokeRect(ab.x0, ab.y0, ab.x1 - ab.x0, ab.y1 - ab.y0); }
      ctx.fillStyle = '#fff';
      ctx.font = '14px monospace';
      ctx.fillText(`${this.state} ${this.anim}:${this.frameIndex}`, this.x - 60, GROUND + 30);
      ctx.restore();
    }
  }
}

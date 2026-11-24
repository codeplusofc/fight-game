// Uma partida: rounds, golpes acertando, bola de energia, efeitos e placar.
import { W, H, GROUND, WALL_LEFT, WALL_RIGHT, MAX_HP, SUPER_MAX, SUPER_COST, ROUND_TIME, ROUNDS_TO_WIN, PROJECTILE_SPEED } from './config.js';
import { Fighter } from './fighter.js';
import { CpuController } from './ai.js';
import { drawStage } from './stage.js';
import { sfx } from './audio.js';

const PROJECTILE = { dmg: 20, hit: 'hit', push: 180, speed: PROJECTILE_SPEED };

function overlap(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export class Match {
  /**
   * @param chars       [lutador P1, lutador P2] carregados
   * @param controllers [controle P1, controle P2]
   * @param labels      [{label, color}, {label, color}]
   */
  constructor(chars, controllers, labels, debug = false) {
    this.controllers = controllers;
    this.fighters = [new Fighter(chars[0], labels[0]), new Fighter(chars[1], labels[1])];
    this.sameChar = chars[0].name === chars[1].name;
    this.debug = debug;
    this.time = 0;
    this.round = 0;
    this.over = false;
    this.startRound();
  }

  startRound() {
    this.round += 1;
    const [a, b] = this.fighters;
    a.reset(W / 2 - 260, 1);
    b.reset(W / 2 + 260, -1);
    this.projectiles = [];
    this.effects = [];
    this.clock = ROUND_TIME;
    this.phase = 'intro';
    this.phaseT = 0;
    this.hitstop = 0;
    this.shake = 0;
    this.slowmo = 1;
    this.flash = 0;
    this.lagHp = [MAX_HP, MAX_HP];
    this.banner = `ROUND ${this.round}`;
    sfx('round');
  }

  get fighting() { return this.phase === 'fight'; }

  hasProjectile(owner) { return this.projectiles.some((p) => p.owner === owner); }

  spawnProjectile(owner) {
    const info = owner.char.projectile;
    this.projectiles.push({
      owner,
      x: owner.x + owner.facing * info.x,
      y: GROUND - owner.y - info.y,
      vx: owner.facing * PROJECTILE.speed,
      w: info.w,
      h: info.h,
      t: 0,
    });
  }

  /** Nome para mostrar ("JESSY", ou "JESSY P1" quando as duas são iguais). */
  nameOf(f) {
    return this.sameChar ? `${f.char.displayName} ${f.label}` : f.char.displayName;
  }

  superFlash(who) {
    this.flash = 450;
    this.hitstop = 0.35;
    this.effects.push({ type: 'super', x: who.x, y: GROUND - 140, t: 0, dur: 450 });
  }

  // ------------------------------------------------------------------ update
  update(realDt) {
    this.shake *= Math.exp(-14 * realDt);
    if (this.flash > 0) this.flash -= realDt * 1000;
    if (this.hitstop > 0) { this.hitstop -= realDt; return; }

    const dt = realDt * this.slowmo;
    this.time += dt * 1000;
    this.phaseT += realDt * 1000;
    const [a, b] = this.fighters;

    this.controllers.forEach((c, i) => {
      if (c instanceof CpuController) c.think(this.fighters[i], this.fighters[1 - i], this);
    });
    const inA = this.controllers[0].read();
    const inB = this.controllers[1].read();
    a.update(dt, inA, b, this);
    b.update(dt, inB, a, this);

    this.separate(a, b);
    this.updateProjectiles(dt);
    this.resolveAttack(a, b);
    this.resolveAttack(b, a);

    for (const e of this.effects) e.t += realDt * 1000;
    this.effects = this.effects.filter((e) => e.t < e.dur);
    this.fighters.forEach((f, i) => {
      // Barra vermelha de "dano recente" vai descendo devagar.
      if (this.lagHp[i] > f.hp) this.lagHp[i] = Math.max(f.hp, this.lagHp[i] - 260 * realDt);
      else this.lagHp[i] = f.hp;
    });

    this.updatePhase(realDt);
  }

  updatePhase(realDt) {
    const [a, b] = this.fighters;
    switch (this.phase) {
      case 'intro':
        if (this.phaseT > 1150 && this.banner !== 'LUTEM!') { this.banner = 'LUTEM!'; sfx('fight'); }
        if (this.phaseT > 1700) { this.phase = 'fight'; this.banner = null; this.phaseT = 0; }
        break;
      case 'fight':
        this.clock -= realDt;
        if (!a.alive || !b.alive) {
          this.phase = 'ko';
          this.phaseT = 0;
          this.banner = 'K.O.';
          this.slowmo = 0.35;
          this.shake = 14;
          sfx('ko');
        } else if (this.clock <= 0) {
          this.clock = 0;
          this.phase = 'ko';
          this.phaseT = 0;
          this.banner = 'TEMPO!';
          const loser = a.hp < b.hp ? a : b.hp < a.hp ? b : null;
          if (loser) loser.knockOut(-loser.facing);
        }
        break;
      case 'ko':
        if (this.phaseT > 1000) this.slowmo = 1;
        if (this.phaseT > 1700) {
          const winner = a.hp > b.hp ? a : b.hp > a.hp ? b : null;
          if (winner && (winner.controllable || winner.state === 'block' || winner.state === 'hit')
            && winner.onGround) {
            winner.win();
          }
          if (!winner || winner.state === 'win') {
            if (winner) winner.wins += 1;
            this.winner = winner;
            this.phase = 'roundOver';
            this.phaseT = 0;
            this.banner = winner ? `${this.nameOf(winner)} VENCEU!` : 'EMPATE!';
          }
        }
        break;
      case 'roundOver':
        if (this.phaseT > 2600) {
          if (this.fighters.some((f) => f.wins >= ROUNDS_TO_WIN)) {
            this.phase = 'matchOver';
            this.over = true;
            this.champion = this.fighters.find((f) => f.wins >= ROUNDS_TO_WIN);
            this.banner = null;
          } else {
            this.startRound();
          }
        }
        break;
      default: break;
    }
  }

  /** Não deixa as duas ficarem uma dentro da outra. */
  separate(a, b) {
    if (a.y > 110 || b.y > 110) return; // uma passa por cima da outra no pulo
    if (['lose', 'knockdown'].includes(a.state) || ['lose', 'knockdown'].includes(b.state)) return;
    const min = 105; // distância mínima entre os dois (os desenhos são largos)
    const dx = b.x - a.x;
    if (Math.abs(dx) >= min) return;
    const dir = dx !== 0 ? Math.sign(dx) : a.facing;
    const push = (min - Math.abs(dx)) / 2;
    a.x -= dir * push;
    b.x += dir * push;
    // Na parede, quem está livre é que anda.
    for (const [f, o] of [[a, b], [b, a]]) {
      if (f.x < WALL_LEFT) { o.x += WALL_LEFT - f.x; f.x = WALL_LEFT; }
      if (f.x > WALL_RIGHT) { o.x -= f.x - WALL_RIGHT; f.x = WALL_RIGHT; }
    }
  }

  resolveAttack(att, def) {
    const box = att.attackBox();
    if (!box) return;
    const hb = def.hurtbox();
    if (!hb || !overlap(box, hb)) return;
    const m = att.move;
    if (m.every) {
      if (this.time - att.lastHitAt < m.every) return;
    } else if (att.hitDone) return;

    const isLast = !!m.every && att.frameIndex >= m.active[1] - 1;
    const result = def.receiveHit(att, m, isLast);
    att.hitDone = true;
    att.lastHitAt = this.time;
    if (!m.super) att.super = Math.min(SUPER_MAX, att.super + m.dmg * (result === 'hit' ? 0.7 : 0.2));

    const cx = (Math.max(box.x0, hb.x0) + Math.min(box.x1, hb.x1)) / 2;
    const cy = (Math.max(box.y0, hb.y0) + Math.min(box.y1, hb.y1)) / 2;
    this.effects.push({ type: result, x: cx, y: cy, t: 0, dur: result === 'hit' ? 220 : 160, big: !!m.heavy });
    this.hitstop = result === 'block' ? 0.05 : m.heavy ? 0.12 : 0.075;
    if (m.heavy && result === 'hit') this.shake = 9;

    // Oponente na parede: quem bateu é que recua.
    const dir = Math.sign(def.x - att.x) || att.facing;
    if (def.x <= WALL_LEFT + 2 || def.x >= WALL_RIGHT - 2) att.pushVx = -dir * m.push * 0.6;
  }

  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.t += dt * 1000;
    }
    // Duas bolas se anulam.
    for (let i = 0; i < this.projectiles.length; i++) {
      for (let j = i + 1; j < this.projectiles.length; j++) {
        const p = this.projectiles[i];
        const q = this.projectiles[j];
        if (p.owner !== q.owner && Math.abs(p.x - q.x) < (p.w + q.w) * 0.4) {
          p.dead = q.dead = true;
          this.effects.push({ type: 'hit', x: (p.x + q.x) / 2, y: p.y, t: 0, dur: 260, big: true });
          sfx('hitHeavy');
        }
      }
    }
    for (const p of this.projectiles) {
      if (p.dead) continue;
      const target = this.fighters.find((f) => f !== p.owner);
      const hb = target.hurtbox();
      const hw = p.w * 0.4;
      const hh = p.h * 0.4;
      const box = { x0: p.x - hw, x1: p.x + hw, y0: p.y - hh, y1: p.y + hh };
      if (hb && overlap(box, hb)) {
        p.dead = true;
        const result = target.receiveHit({ x: p.x - Math.sign(p.vx), facing: Math.sign(p.vx) }, PROJECTILE);
        p.owner.super = Math.min(SUPER_MAX, p.owner.super + (result === 'hit' ? 14 : 4));
        this.effects.push({ type: result, x: p.x, y: p.y, t: 0, dur: 240, big: true });
        this.hitstop = 0.07;
      }
      if (p.x < -100 || p.x > W + 100) p.dead = true;
    }
    this.projectiles = this.projectiles.filter((p) => !p.dead);
  }

  // ------------------------------------------------------------------ desenho
  draw(ctx) {
    ctx.save();
    if (this.shake > 0.5) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    drawStage(ctx);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(10,0,30,${Math.min(0.6, this.flash / 450 * 0.6)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Quem está atacando aparece na frente.
    const order = [...this.fighters].sort((p, q) => (p.state === 'attack') - (q.state === 'attack'));
    for (const f of order) f.draw(ctx, this.debug);
    for (const p of this.projectiles) this.drawProjectile(ctx, p);
    for (const e of this.effects) this.drawEffect(ctx, e);
    ctx.restore();

    this.drawHud(ctx);
    if (this.banner) this.drawBanner(ctx, this.banner);
  }

  drawProjectile(ctx, p) {
    const img = p.owner.char.projectileImg;
    const pulse = 1 + Math.sin(p.t / 40) * 0.06;
    const w = p.w * pulse;
    const h = p.h * pulse;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.vx < 0) ctx.scale(-1, 1);
    // Rastro.
    for (let i = 3; i >= 1; i--) {
      ctx.globalAlpha = 0.12 * (4 - i);
      ctx.drawImage(img, -w / 2 - i * 22, -h / 2, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  drawEffect(ctx, e) {
    const k = e.t / e.dur;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.type === 'super') {
      ctx.strokeStyle = `rgba(140,230,255,${1 - k})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, 40 + k * 260, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const block = e.type === 'block';
      const r = (e.big ? 70 : 48) * (0.4 + k);
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = block ? '#9fe3ff' : '#fff6b0';
      ctx.fillStyle = block ? 'rgba(120,200,255,.5)' : 'rgba(255,170,60,.6)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      const rays = block ? 6 : 10;
      for (let i = 0; i < rays; i++) {
        const ang = (i / rays) * Math.PI * 2 + e.x;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r * 0.5, Math.sin(ang) * r * 0.5);
        ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawHud(ctx) {
    const barW = 470;
    const barH = 26;
    const y = 30;
    const [a, b] = this.fighters;
    const sides = [
      { f: a, x: W / 2 - 60 - barW, flip: false, lag: this.lagHp[0] },
      { f: b, x: W / 2 + 60, flip: true, lag: this.lagHp[1] },
    ];
    ctx.save();
    for (const s of sides) {
      const { f } = s;
      // Moldura.
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(s.x - 4, y - 4, barW + 8, barH + 8);
      ctx.fillStyle = '#3a0d12';
      ctx.fillRect(s.x, y, barW, barH);
      // Dano recente (vermelho) e vida (amarelo -> verde).
      const lagW = barW * (s.lag / MAX_HP);
      const hpW = barW * (f.hp / MAX_HP);
      ctx.fillStyle = '#e8402f';
      ctx.fillRect(s.flip ? s.x : s.x + barW - lagW, y, lagW, barH);
      const g = ctx.createLinearGradient(0, y, 0, y + barH);
      const low = f.hp < MAX_HP * 0.25;
      g.addColorStop(0, low ? '#ffb347' : '#fff36b');
      g.addColorStop(1, low ? '#e0761b' : '#f2b705');
      ctx.fillStyle = g;
      ctx.fillRect(s.flip ? s.x : s.x + barW - hpW, y, hpW, barH);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x, y, barW, barH);

      // Rosto.
      const pw = 64;
      const ph = 64;
      const px = s.flip ? s.x + barW + 10 : s.x - pw - 10;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(px - 3, y - 6, pw + 6, ph + 6);
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, y - 3, pw, ph);
      ctx.clip();
      const img = f.char.portrait;
      const sc = ph / img.height;
      ctx.translate(px + pw / 2, y - 3);
      if (s.flip) ctx.scale(-1, 1);
      ctx.drawImage(img, -img.width * sc / 2, 0, img.width * sc, ph);
      ctx.restore();
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(px - 2, y - 5, pw + 4, ph + 4);

      // Nome e etiqueta.
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.textAlign = s.flip ? 'right' : 'left';
      const nx = s.flip ? s.x + barW : s.x;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      const name = `${f.char.displayName}  ${f.label}`;
      ctx.strokeText(name, nx, y + barH + 24);
      ctx.fillStyle = '#fff';
      ctx.fillText(name, nx, y + barH + 24);

      // Vitórias (bolinhas perto do relógio).
      for (let i = 0; i < ROUNDS_TO_WIN; i++) {
        const cx = s.flip ? s.x + 14 + i * 24 : s.x + barW - 14 - i * 24;
        ctx.beginPath();
        ctx.arc(cx, y + barH + 18, 8, 0, Math.PI * 2);
        ctx.fillStyle = i < f.wins ? '#ffd23f' : 'rgba(0,0,0,.5)';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Barra de super (3 partes) logo abaixo.
      const sw = 210;
      const sh = 12;
      const sx = s.flip ? s.x + barW - sw : s.x;
      const sy = y + barH + 34;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(sx - 2, sy - 2, sw + 4, sh + 4);
      const fillW = sw * (f.super / SUPER_MAX);
      const full = f.super >= SUPER_COST;
      ctx.fillStyle = full ? `hsl(${195 + Math.sin(this.time / 120) * 15},100%,60%)` : '#2f6fe0';
      ctx.fillRect(s.flip ? sx + sw - fillW : sx, sy, fillW, sh);
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 1.5;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + (sw / 3) * i, sy);
        ctx.lineTo(sx + (sw / 3) * i, sy + sh);
        ctx.stroke();
      }
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.font = '800 14px system-ui, sans-serif';
      ctx.textAlign = s.flip ? 'right' : 'left';
      ctx.fillStyle = full ? '#9fe8ff' : '#cfd8ff';
      const label = full ? 'SUPER!' : 'SUPER';
      ctx.fillText(label, s.flip ? sx - 8 : sx + sw + 8, sy + 11);
    }

    // Relógio.
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.beginPath();
    ctx.arc(W / 2, y + barH / 2 + 4, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '900 40px system-ui, sans-serif';
    ctx.fillStyle = this.clock < 10 ? '#ff6b5b' : '#fff';
    ctx.fillText(String(Math.ceil(this.clock)).padStart(2, '0'), W / 2, y + barH / 2 + 18);
    ctx.restore();
  }

  drawBanner(ctx, text) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '900 96px system-ui, sans-serif';
    const pop = Math.min(1, this.phaseT / 160);
    ctx.translate(W / 2, H / 2 - 40);
    ctx.scale(0.6 + pop * 0.4, 0.6 + pop * 0.4);
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#2a0b18';
    ctx.strokeText(text, 0, 0);
    const g = ctx.createLinearGradient(0, -80, 0, 10);
    g.addColorStop(0, '#fff7c2');
    g.addColorStop(1, '#ff9a2e');
    ctx.fillStyle = g;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }
}

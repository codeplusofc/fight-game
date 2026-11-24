// CPU: decide o que fazer e "aperta os botões" como um jogador de verdade.
import { CPU_LEVEL } from './config.js';

const empty = () => ({ left: false, right: false, up: false, down: false, soco: false, chute: false, forte: false, poder: false });

export class CpuController {
  constructor(level = CPU_LEVEL) {
    this.level = level;
    this.plan = empty();
    this.planUntil = 0;
    this.tapButton = null;
    this.thinkAt = 0;
  }

  /** Chamado a cada frame antes de ler(). */
  think(me, foe, game) {
    const now = game.time;
    // Botões são só um toque (solta no frame seguinte).
    if (this.tapButton) {
      for (const b of [].concat(this.tapButton)) this.plan[b] = false;
      this.tapButton = null;
    }
    if (now < this.thinkAt) return;

    const lvl = this.level;
    const reaction = 380 - lvl * 260; // ms entre decisões
    this.thinkAt = now + reaction * (0.6 + Math.random() * 0.8);

    const dist = Math.abs(foe.x - me.x);
    const toward = foe.x > me.x ? 'right' : 'left';
    const away = toward === 'right' ? 'left' : 'right';
    const p = empty();
    const chance = (x) => Math.random() < x;

    if (!me.controllable) { this.plan = p; return; }

    const foeAttacking = foe.state === 'attack' && foe.move && foe.move.box;
    const incoming = game.projectiles.find((pr) => pr.owner !== me
      && Math.sign(me.x - pr.x) === Math.sign(pr.vx) && Math.abs(me.x - pr.x) < 420);

    // Defesa: bola de energia chegando ou golpe vindo de perto.
    if (incoming) {
      if (chance(0.35 + lvl * 0.3)) { p.up = true; p[toward] = true; }
      else p[away] = true;
      this.plan = p;
      return;
    }
    if (foeAttacking && dist < 230 && chance(0.25 + lvl * 0.5)) {
      p[away] = true;
      if (foe.moveName === 'LK') p.down = true;
      this.plan = p;
      this.thinkAt = now + 260;
      return;
    }
    // Anti-aéreo: oponente pulando por cima.
    if (foe.y > 60 && dist < 260 && chance(0.2 + lvl * 0.5)) {
      p.up = true; p.poder = true; this.tapButton = 'poder';
      this.plan = p;
      return;
    }

    if (dist > 420) {
      if (chance(0.3 + lvl * 0.2) && !game.hasProjectile(me)) { p.poder = true; this.tapButton = 'poder'; }
      else if (chance(0.15)) { p.up = true; p[toward] = true; }
      else p[toward] = true;
    } else if (dist > 190) {
      const r = Math.random();
      if (r < 0.45) p[toward] = true;
      else if (r < 0.6 && !game.hasProjectile(me)) { p.poder = true; this.tapButton = 'poder'; }
      else if (r < 0.72) { p.up = true; p[toward] = true; }
      else if (r < 0.82) { p.down = true; p.poder = true; this.tapButton = 'poder'; }
      else p[away] = true;
    } else {
      // Perto: ataca.
      if (me.super >= 100 && chance(0.25)) {
        p.poder = true; p.forte = true; this.tapButton = ['poder', 'forte'];
        this.plan = p;
        return;
      }
      const r = Math.random();
      if (r < 0.2) { p.soco = true; this.tapButton = 'soco'; }
      else if (r < 0.35) { p[toward] = true; p.soco = true; this.tapButton = 'soco'; }
      else if (r < 0.48) { p.chute = true; this.tapButton = 'chute'; }
      else if (r < 0.6) { p.down = true; p.chute = true; this.tapButton = 'chute'; }
      else if (r < 0.7) { p.forte = true; this.tapButton = 'forte'; }
      else if (r < 0.78) { p.down = true; p.forte = true; this.tapButton = 'forte'; }
      else if (r < 0.84) { p.up = true; p.poder = true; this.tapButton = 'poder'; }
      else if (r < 0.92) { p[away] = true; }
      else { p.down = true; p[away] = true; }
    }
    this.plan = p;
  }

  read() { return { ...this.plan }; }
}

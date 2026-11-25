// Golpes da Jessy.
//
//   anim      animação (mesmos nomes das pastas do jogo Java)
//   active    [primeiro, último] frame em que o golpe acerta (igual ao hbstart/hbend do Java)
//   box       área do golpe: x para FRENTE a partir do centro do corpo, y para CIMA a partir do pé
//   dmg       dano (a vida é 800, igual ao Java)
//   hit       reação de quem apanha: 'hit' (recua), 'knockdown' (cai), 'launch' (voa para cima)
//   low       true = golpe baixo (só defende agachada)
//   push      quanto empurra o oponente
//   every     golpe que acerta várias vezes: intervalo entre acertos (ms)
//   sfx       som ao soltar o golpe
//
// Para mudar a força de um golpe, é só mexer aqui.

export const MOVES = {
  LP: { anim: 'LP', active: [2, 4], box: { x0: 50, x1: 150, y0: 170, y1: 225 }, dmg: 10, hit: 'hit', push: 140, sfx: 'whoosh' },
  MP: { anim: 'MP', active: [3, 5], box: { x0: 60, x1: 165, y0: 160, y1: 220 }, dmg: 20, hit: 'hit', push: 190, sfx: 'whoosh' },
  HP: { anim: 'HP', active: [3, 10], box: { x0: 80, x1: 185, y0: 165, y1: 225 }, dmg: 50, hit: 'knockdown', push: 300, heavy: true, sfx: 'whoosh' },
  LK: { anim: 'LK', active: [2, 4], box: { x0: 40, x1: 150, y0: 40, y1: 110 }, dmg: 10, hit: 'hit', low: true, push: 140, sfx: 'whoosh' },
  MK: { anim: 'MK', active: [3, 5], box: { x0: 30, x1: 140, y0: 150, y1: 270 }, dmg: 15, hit: 'launch', push: 220, heavy: true, sfx: 'whoosh' },
  HK: { anim: 'HK', active: [3, 5], box: { x0: 40, x1: 150, y0: 170, y1: 285 }, dmg: 20, hit: 'hit', push: 260, sfx: 'whoosh' },

  Hadoken: { anim: 'Hadoken', projectileAt: 2, dmg: 20, sfx: 'hadoken' },

  // ↑ + PODER: Mawashi Geri especial (chute com energia azul, subindo).
  Shoryuken: {
    anim: 'Shoryuken', active: [3, 9], box: { x0: 0, x1: 130, y0: 90, y1: 300 },
    dmg: 50, hit: 'launch', push: 200, heavy: true, sfx: 'shoryuken',
    rise: { at: 3, vy: 1150, vx: 140 }, invulnerable: [0, 6],
  },

  LTatsu: { anim: 'LTatsu', active: [2, 9], box: { x0: -150, x1: 150, y0: 90, y1: 220 }, dmg: 8, every: 160, hit: 'hit', push: 160, spin: { vx: 170, lift: 28 }, sfx: 'whoosh' },
  MTatsu: { anim: 'MTatsu', active: [2, 14], box: { x0: -150, x1: 150, y0: 90, y1: 220 }, dmg: 9, every: 160, hit: 'hit', push: 170, spin: { vx: 200, lift: 32 }, sfx: 'whoosh' },
  HTatsu: { anim: 'HTatsu', active: [2, 21], box: { x0: -150, x1: 150, y0: 90, y1: 220 }, dmg: 10, every: 160, hit: 'hit', push: 180, spin: { vx: 230, lift: 36 }, sfx: 'whoosh' },

  // PESADO + PODER: Shinkyoku Ryu (raio que acerta várias vezes).
  SuperTatsu: {
    anim: 'SuperTatsu', active: [20, 104], box: { x0: 60, x1: 290, y0: 60, y1: 230 },
    dmg: 9, every: 120, hit: 'hit', push: 90, super: true, invulnerable: [0, 24],
    lastHit: 'launch', sfx: 'super',
  },
  // ↓ + PESADO + PODER: Kyokushin Impact (gasta 2 barras; acerta os dois lados).
  Ultra: {
    anim: 'Ultra', active: [12, 18], box: { x0: -260, x1: 260, y0: 0, y1: 170 },
    dmg: 110, hit: 'launch', push: 260, heavy: true, super: true, cost: 200,
    invulnerable: [0, 18], sfx: 'super',
  },
};

// Golpes do Gui (karatê Kyokushin). Mesmos botões, golpes dele:
//   SOCO jab / cross, PESADO gyaku zuki, CHUTE mae geri, ↓+CHUTE low sweep,
//   PODER shuto uchi (onda), ↑+PODER kyokushin impact, ↓+PODER tatsumaki geri,
//   PESADO+PODER shinkyoku ryu (super: raio gigante).
export const GUI_MOVES = {
  LP: { anim: 'LP', active: [2, 4], box: { x0: 60, x1: 165, y0: 185, y1: 240 }, dmg: 10, hit: 'hit', push: 140, sfx: 'whoosh' },
  MP: { anim: 'MP', active: [3, 5], box: { x0: 70, x1: 155, y0: 150, y1: 210 }, dmg: 20, hit: 'hit', push: 190, sfx: 'whoosh' },
  HP: { anim: 'HP', active: [3, 10], box: { x0: 90, x1: 208, y0: 165, y1: 230 }, dmg: 50, hit: 'knockdown', push: 300, heavy: true, sfx: 'whoosh' },
  LK: { anim: 'LK', active: [2, 4], box: { x0: 40, x1: 140, y0: 0, y1: 60 }, dmg: 10, hit: 'hit', low: true, push: 140, sfx: 'whoosh' },
  MK: { anim: 'MK', active: [3, 5], box: { x0: 30, x1: 135, y0: 150, y1: 285 }, dmg: 15, hit: 'launch', push: 220, heavy: true, sfx: 'whoosh' },
  HK: { anim: 'HK', active: [3, 5], box: { x0: 70, x1: 197, y0: 150, y1: 240 }, dmg: 20, hit: 'hit', push: 260, sfx: 'whoosh' },

  Hadoken: { anim: 'Hadoken', projectileAt: 2, dmg: 20, sfx: 'hadoken' },

  // Kyokushin Impact: soco no chão que joga para cima quem estiver perto (dos dois lados).
  Shoryuken: {
    anim: 'Shoryuken', active: [4, 9], box: { x0: -170, x1: 185, y0: 0, y1: 130 },
    dmg: 45, hit: 'launch', push: 220, heavy: true, sfx: 'shoryuken', invulnerable: [0, 5],
  },

  LTatsu: { anim: 'LTatsu', active: [2, 9], box: { x0: -200, x1: 140, y0: 90, y1: 205 }, dmg: 8, every: 160, hit: 'hit', push: 160, spin: { vx: 170, lift: 28 }, sfx: 'whoosh' },
  MTatsu: { anim: 'MTatsu', active: [2, 14], box: { x0: -200, x1: 140, y0: 90, y1: 205 }, dmg: 9, every: 160, hit: 'hit', push: 170, spin: { vx: 200, lift: 32 }, sfx: 'whoosh' },
  HTatsu: { anim: 'HTatsu', active: [2, 21], box: { x0: -200, x1: 140, y0: 90, y1: 205 }, dmg: 10, every: 160, hit: 'hit', push: 180, spin: { vx: 230, lift: 36 }, sfx: 'whoosh' },

  // Shinkyoku Ryu: carrega o kiai e solta um raio que acerta várias vezes.
  SuperTatsu: {
    anim: 'SuperTatsu', active: [20, 104], box: { x0: 60, x1: 300, y0: 50, y1: 235 },
    dmg: 9, every: 120, hit: 'hit', push: 90, super: true, invulnerable: [0, 24],
    lastHit: 'launch', sfx: 'super',
  },
};

// Golpes do Kauã (energia roxa).
export const KAUA_MOVES = {
  LP: { anim: 'LP', active: [2, 4], box: { x0: 45, x1: 125, y0: 195, y1: 250 }, dmg: 10, hit: 'hit', push: 140, sfx: 'whoosh' },
  MP: { anim: 'MP', active: [3, 5], box: { x0: 60, x1: 160, y0: 190, y1: 250 }, dmg: 20, hit: 'hit', push: 190, sfx: 'whoosh' },
  HP: { anim: 'HP', active: [3, 10], box: { x0: 80, x1: 182, y0: 195, y1: 255 }, dmg: 50, hit: 'knockdown', push: 300, heavy: true, sfx: 'whoosh' },
  LK: { anim: 'LK', active: [2, 4], box: { x0: 50, x1: 180, y0: 0, y1: 70 }, dmg: 10, hit: 'hit', low: true, push: 140, sfx: 'whoosh' },
  MK: { anim: 'MK', active: [3, 5], box: { x0: 30, x1: 180, y0: 170, y1: 290 }, dmg: 15, hit: 'launch', push: 220, heavy: true, sfx: 'whoosh' },
  HK: { anim: 'HK', active: [3, 5], box: { x0: 80, x1: 238, y0: 150, y1: 240 }, dmg: 20, hit: 'hit', push: 260, sfx: 'whoosh' },

  Hadoken: { anim: 'Hadoken', projectileAt: 2, dmg: 20, sfx: 'hadoken' },

  // ↑ + PODER: chute de energia roxa, subindo.
  Shoryuken: {
    anim: 'Shoryuken', active: [3, 9], box: { x0: 20, x1: 200, y0: 80, y1: 280 },
    dmg: 50, hit: 'launch', push: 200, heavy: true, sfx: 'shoryuken',
    rise: { at: 3, vy: 1150, vx: 140 }, invulnerable: [0, 6],
  },

  LTatsu: { anim: 'LTatsu', active: [2, 9], box: { x0: -180, x1: 180, y0: 120, y1: 260 }, dmg: 8, every: 160, hit: 'hit', push: 160, spin: { vx: 170, lift: 28 }, sfx: 'whoosh' },
  MTatsu: { anim: 'MTatsu', active: [2, 14], box: { x0: -180, x1: 180, y0: 120, y1: 260 }, dmg: 9, every: 160, hit: 'hit', push: 170, spin: { vx: 200, lift: 32 }, sfx: 'whoosh' },
  HTatsu: { anim: 'HTatsu', active: [2, 21], box: { x0: -180, x1: 180, y0: 120, y1: 260 }, dmg: 10, every: 160, hit: 'hit', push: 180, spin: { vx: 230, lift: 36 }, sfx: 'whoosh' },

  // PESADO + PODER: aura roxa e rajada de chutes de energia.
  SuperTatsu: {
    anim: 'SuperTatsu', active: [20, 104], box: { x0: 40, x1: 235, y0: 60, y1: 265 },
    dmg: 9, every: 120, hit: 'hit', push: 90, super: true, invulnerable: [0, 24],
    lastHit: 'launch', sfx: 'super',
  },
};

// Golpes de cada lutador (o nome é o da pasta em web/assets).
export const MOVESETS = { jessy: MOVES, gui: GUI_MOVES, kaua: KAUA_MOVES };

// Corpo de quem apanha (área que pode ser acertada), para a altura da Jessy (273 px).
// Lutadores maiores/menores usam a mesma caixa proporcional (hurtboxes()).
export const HURTBOX = {
  stand: { x0: -45, x1: 45, y0: 0, y1: 255 },
  crouch: { x0: -50, x1: 50, y0: 0, y1: 175 },
  air: { x0: -45, x1: 45, y0: 20, y1: 230 },
};

export function hurtboxes(standHeight) {
  const k = standHeight / 273;
  const out = {};
  for (const [nome, b] of Object.entries(HURTBOX)) {
    out[nome] = { x0: b.x0 * k, x1: b.x1 * k, y0: b.y0 * k, y1: b.y1 * k };
  }
  return out;
}

// Lista de golpes para a tela "COMO JOGAR" (comando -> nome do golpe).
export const MOVE_LIST = {
  jessy: [
    ['SOCO', 'Jab'], ['→ + SOCO', 'Cross'], ['PESADO', 'Gyaku Zuki (derruba)'], ['↓ + PESADO', 'Mawashi Geri'],
    ['CHUTE', 'Mae Geri (joga para cima)'], ['↓ + CHUTE', 'Low Sweep (golpe baixo)'],
    ['PODER', 'Shuto Uchi (onda de energia)'], ['↑ + PODER', 'Mawashi Geri Especial'], ['↓ + PODER', 'Tatsumaki Geri (redemoinho)'],
    ['PESADO + PODER', 'SUPER: Shinkyoku Ryu (1 barra)'], ['↓ + PESADO + PODER', 'ULTRA: Kyokushin Impact (2 barras)'],
  ],
  gui: [
    ['SOCO', 'Jab'], ['→ + SOCO', 'Cross'], ['PESADO', 'Gyaku Zuki (derruba)'], ['↓ + PESADO', 'Mae Geri alto'],
    ['CHUTE', 'Mae Geri (joga para cima)'], ['↓ + CHUTE', 'Low Sweep (golpe baixo)'],
    ['PODER', 'Shuto Uchi (onda de energia)'], ['↑ + PODER', 'Kyokushin Impact (soco no chão)'], ['↓ + PODER', 'Tatsumaki Geri (redemoinho)'],
    ['PESADO + PODER', 'SUPER: Shinkyoku Ryu (1 barra)'],
  ],
  kaua: [
    ['SOCO', 'Jab'], ['→ + SOCO', 'Cross'], ['PESADO', 'Cross pesado (derruba)'], ['↓ + PESADO', 'High Kick giratório'],
    ['CHUTE', 'High Kick (joga para cima)'], ['↓ + CHUTE', 'Low Kick (golpe baixo)'],
    ['PODER', 'Soco de energia roxa'], ['↑ + PODER', 'Chute de energia (sobe)'], ['↓ + PODER', 'Redemoinho de chutes'],
    ['PESADO + PODER', 'SUPER: Rajada de energia (1 barra)'],
  ],
};

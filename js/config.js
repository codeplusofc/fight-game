// Configurações gerais do jogo. Mude à vontade!

export const GAME_TITLE = 'GARYU DOJO';

export const W = 1280;          // largura interna da tela
export const H = 720;           // altura interna da tela
export const GROUND = 640;      // linha do chão (onde ficam os pés)
export const WALL_LEFT = 70;    // limite da arena
export const WALL_RIGHT = W - 70;

export const MAX_HP = 800;      // vida (igual ao jogo Java)
export const SUPER_MAX = 300;   // barra de super (3 barrinhas)
export const SUPER_COST = 100;  // custo do Super Tatsu
export const ROUND_TIME = 99;   // segundos por round
export const ROUNDS_TO_WIN = 2; // melhor de 3

// Velocidade das animações/golpes: 1 = igual ao jogo Java, 1.3 = 30% mais rápido.
export const ANIM_SPEED = 1.3;

export const GRAVITY = 3400;    // px/s² (pulo mais rápido)
export const WALK_FWD = 290;    // px/s
export const WALK_BACK = 240;
export const JUMP_VY = 1120;
export const JUMP_VX = 320;
export const PROJECTILE_SPEED = 780;

// Dificuldade da CPU: 0 (fácil) a 1 (difícil).
export const CPU_LEVEL = 0.55;

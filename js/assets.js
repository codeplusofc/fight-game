// Carrega os lutadores exportados por tools/export_web.py.
//
// No celular, pedir centenas de imagens de uma vez faz algumas falharem.
// Então: poucas por vez (fila) e, se uma falhar, tenta de novo.

const MAX_SIMULTANEAS = 6;
const TENTATIVAS = 4;

let ativas = 0;
const fila = [];

function proximo() {
  while (ativas < MAX_SIMULTANEAS && fila.length) {
    const tarefa = fila.shift();
    ativas++;
    tarefa().finally(() => { ativas--; proximo(); });
  }
}

/** Coloca o trabalho na fila e devolve uma Promise com o resultado. */
function naFila(fn) {
  return new Promise((resolve, reject) => {
    fila.push(() => fn().then(resolve, reject));
    proximo();
  });
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function loadImageOnce(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não carregou ' + src));
    img.src = src;
  });
}

async function loadImage(src) {
  let erro;
  for (let i = 0; i < TENTATIVAS; i++) {
    try {
      // A partir da 2ª tentativa, pede de novo sem usar o que ficou no cache.
      return await loadImageOnce(i === 0 ? src : `${src}?tentativa=${i}`);
    } catch (e) {
      erro = e;
      await esperar(400 * (i + 1));
    }
  }
  throw erro;
}

async function loadJson(src) {
  let erro;
  for (let i = 0; i < TENTATIVAS; i++) {
    try {
      const r = await fetch(src);
      if (!r.ok) throw new Error(`Não carregou ${src} (${r.status})`);
      return await r.json();
    } catch (e) {
      erro = e;
      await esperar(400 * (i + 1));
    }
  }
  throw erro;
}

/** O navegador abre imagens WebP? (iPhone com iOS antigo não abre.) */
export function webpSupported() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.width === 1);
    img.onerror = () => resolve(false);
    // 1x1 WebP sem perda (o mesmo tipo das imagens do jogo).
    img.src = 'data:image/webp;base64,UklGRhwAAABXRUJQVlA4TA8AAAAvAAAAAAcQ/Y/+ByKi/wEA';
  });
}

export async function loadCharacter(name, onProgress = () => {}) {
  const base = `assets/${name}/`;
  const manifest = await loadJson(base + 'anims.json');
  const extras = ['portrait.webp', 'select.webp', 'projectile.webp'];
  const total = manifest.frames.length + extras.length;
  let done = 0;
  const tick = (img) => { done++; onProgress(done / total); return img; };

  const frames = await Promise.all(
    manifest.frames.map((f) => naFila(() => loadImage(base + 'frames/' + f.file)).then(tick)),
  );
  const [portrait, select, projectileImg] = await Promise.all(
    extras.map((f) => naFila(() => loadImage(base + f)).then(tick)),
  );

  return {
    name,
    displayName: manifest.displayName,
    projectile: manifest.projectile, // { w, h, x, y }: tamanho e de onde sai (frente / altura do pé)
    frames,
    anims: manifest.anims,
    standHeight: manifest.standHeight,
    portrait,
    select,
    projectileImg,
  };
}

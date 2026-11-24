// Carrega a Jessy exportada por tools/export_web.py.

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não carregou ' + src));
    img.src = src;
  });
}

export async function loadCharacter(name, onProgress = () => {}) {
  const base = `assets/${name}/`;
  const manifest = await (await fetch(base + 'anims.json')).json();
  const extras = ['portrait.webp', 'select.webp', 'projectile.webp'];
  const total = manifest.frames.length + extras.length;
  let done = 0;
  const tick = (img) => { done++; onProgress(done / total); return img; };

  const frames = await Promise.all(
    manifest.frames.map((f) => loadImage(base + 'frames/' + f.file).then(tick)),
  );
  const [portrait, select, projectileImg] = await Promise.all(
    extras.map((f) => loadImage(base + f).then(tick)),
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

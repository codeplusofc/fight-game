// Sons do jogo.
//  * Pancadas e defesa: gravações de verdade (assets/sons, licença CC0 — ver CREDITOS.txt).
//  * "Vush" do golpe, energia e sons de menu: feitos na hora pelo navegador.

let ctx = null;
let master = null;
let muted = false;
let noiseBuf = null;
const buffers = {}; // nome do arquivo -> AudioBuffer

// Cada som usa uma destas gravações, sorteando (fica menos repetitivo).
const GRAVACOES = {
  hitLight: ['leve1', 'leve2', 'leve3', 'leve4'],
  hitHeavy: ['pesado1', 'pesado2', 'pesado3', 'pesado4'],
  block: ['defesa1', 'defesa2'],
};

function decode(arrayBuffer) {
  // Safari antigo só aceita a versão com callback.
  return new Promise((resolve, reject) => ctx.decodeAudioData(arrayBuffer, resolve, reject));
}

async function carregarGravacoes() {
  const nomes = [...new Set(Object.values(GRAVACOES).flat())];
  await Promise.all(nomes.map(async (n) => {
    try {
      const r = await fetch(`assets/sons/${n}.wav`);
      buffers[n] = await decode(await r.arrayBuffer());
    } catch (e) {
      console.warn('Som não carregou:', n, e); // o jogo continua, só sem esse som
    }
  }));
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    carregarGravacoes();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.8;
  return muted;
}

function tocar(lista, { volume = 1, tom = 1 } = {}) {
  const disponiveis = lista.filter((n) => buffers[n]);
  if (!disponiveis.length) return false;
  const src = ctx.createBufferSource();
  src.buffer = buffers[disponiveis[Math.floor(Math.random() * disponiveis.length)]];
  src.playbackRate.value = tom * (0.94 + Math.random() * 0.12); // variação leve
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(g).connect(master);
  src.start();
  return true;
}

function env(param, t, attack, release, peak) {
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(peak, t + attack);
  param.exponentialRampToValueAtTime(0.0001, t + attack + release);
}

function noise({ dur, type = 'bandpass', f0 = 1000, f1 = f0, q = 1, peak = 0.2, delay = 0 }) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  env(g.gain, t, 0.01, dur, peak);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.1);
}

function tone(type, f0, f1, dur, peak = 0.15, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = ctx.createGain();
  env(g.gain, t, 0.005, dur, peak);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function sfx(name) {
  if (!ctx || muted) return;
  switch (name) {
    // Pancadas: gravação de verdade.
    case 'hitLight': tocar(GRAVACOES.hitLight, { volume: 0.8 }); break;
    case 'hitHeavy': tocar(GRAVACOES.hitHeavy, { volume: 1, tom: 0.92 }); break;
    case 'block': tocar(GRAVACOES.block, { volume: 0.55, tom: 1.25 }); break;
    case 'ko':
      tocar(GRAVACOES.hitHeavy, { volume: 1, tom: 0.75 });
      tone('sine', 90, 35, 0.9, 0.35);
      break;
    case 'land': tocar(GRAVACOES.block, { volume: 0.18, tom: 0.6 }); break;

    // Ar cortado pelo golpe (discreto).
    case 'whoosh': noise({ dur: 0.12, f0: 2200, f1: 800, q: 1.2, peak: 0.09 }); break;
    case 'whooshHeavy': noise({ dur: 0.2, f0: 1500, f1: 400, q: 1, peak: 0.13 }); break;
    case 'jump': noise({ dur: 0.1, f0: 700, f1: 1400, q: 1, peak: 0.06 }); break;

    // Energia.
    case 'hadoken':
      noise({ dur: 0.45, f0: 400, f1: 2200, q: 2.5, peak: 0.2 });
      tone('sine', 220, 520, 0.35, 0.08);
      break;
    case 'shoryuken': noise({ dur: 0.35, f0: 500, f1: 2600, q: 2.5, peak: 0.18 }); break;
    case 'super':
      noise({ dur: 0.9, f0: 250, f1: 3200, q: 3, peak: 0.22 });
      tone('sine', 110, 440, 0.8, 0.12);
      break;

    // Menus e anúncios.
    case 'round': tone('triangle', 523, 523, 0.12, 0.15); tone('triangle', 784, 784, 0.2, 0.15, 0.13); break;
    case 'fight':
      tone('triangle', 392, 392, 0.1, 0.18);
      tone('triangle', 784, 1046, 0.3, 0.18, 0.1);
      tocar(GRAVACOES.hitHeavy, { volume: 0.6, tom: 0.8 });
      break;
    case 'select': tone('triangle', 660, 990, 0.08, 0.18); break;
    default: break;
  }
}

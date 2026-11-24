// Sons feitos na hora com o próprio navegador (Web Audio): nada de arquivos.
// Golpes: estalo + pancada grave. Vozes: "HA!", "HYAH!", gemidos e grito de K.O.,
// sintetizados com formantes (as "ressonâncias" da boca de cada vogal).

let ctx = null;
let master = null;
let comp = null;
let muted = false;
let noiseBuf = null;
let distCurve = null;

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      distCurve[i] = Math.tanh(x * 3.5);
    }
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.7;
  return muted;
}

const now = (d = 0) => ctx.currentTime + d;

function env(param, t, attack, hold, release, peak) {
  param.cancelScheduledValues(t);
  param.setValueAtTime(0.0001, t);
  param.exponentialRampToValueAtTime(peak, t + attack);
  param.setValueAtTime(peak, t + attack + hold);
  param.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
}

function noise({ dur, type = 'lowpass', f0 = 1000, f1 = f0, q = 0.8, peak = 0.4, attack = 0.003, delay = 0 }) {
  const t = now(delay);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  env(g.gain, t, attack, 0, dur, peak);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random());
  src.stop(t + dur + 0.1);
}

function thump({ f0, f1, dur, peak = 0.6, delay = 0, drive = false }) {
  const t = now(delay);
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  env(g.gain, t, 0.002, 0, dur, peak);
  let node = o;
  if (drive) {
    const ws = ctx.createWaveShaper();
    ws.curve = distCurve;
    node = o.connect(ws);
  }
  node.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function tone(type, f0, f1, dur, peak = 0.3, delay = 0) {
  const t = now(delay);
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = ctx.createGain();
  env(g.gain, t, 0.005, 0, dur, peak);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// Formantes das vogais (F1, F2, F3) em Hz.
const VOGAIS = {
  a: [800, 1250, 2600],
  e: [500, 1900, 2600],
  i: [300, 2300, 3000],
  o: [500, 900, 2500],
  u: [350, 700, 2400],
  y: [300, 2200, 3000], // começo do "HYAH"
};

/**
 * Voz sintetizada.
 * @param pitch   tom (Hz): ~290 voz feminina, ~140 masculina
 * @param partes  [[vogal, duração(s)], ...]  ex.: [['a', .25]]
 * @param glide   quanto o tom cai no fim (0.7 = cai 30%)
 */
function voz(pitch, partes, { peak = 0.5, glide = 0.75, breath = 0.06, delay = 0, rasp = 0 } = {}) {
  const t0 = now(delay);
  const total = partes.reduce((s, [, d]) => s + d, 0) + breath;
  // Fonte: dente-de-serra (cordas vocais) com um tremidinho.
  const src = ctx.createOscillator();
  src.type = 'sawtooth';
  src.frequency.setValueAtTime(pitch * 1.08, t0);
  src.frequency.linearRampToValueAtTime(pitch * 1.12, t0 + breath + 0.04);
  src.frequency.exponentialRampToValueAtTime(pitch * glide, t0 + total);
  const vib = ctx.createOscillator();
  vib.frequency.value = 7;
  const vibG = ctx.createGain();
  vibG.gain.value = pitch * 0.015;
  vib.connect(vibG).connect(src.frequency);

  const voice = ctx.createGain();
  env(voice.gain, t0 + breath, 0.02, total - breath - 0.09, 0.07, peak);
  const out = ctx.createGain();
  out.gain.value = 1;
  // Três filtros em paralelo = as três ressonâncias da vogal.
  const formants = [0, 1, 2].map((k) => {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = [9, 11, 13][k];
    const g = ctx.createGain();
    g.gain.value = [1, 0.55, 0.3][k];
    src.connect(f).connect(g).connect(voice);
    return f;
  });
  let t = t0 + breath;
  formants.forEach((f, k) => f.frequency.setValueAtTime(VOGAIS[partes[0][0]][k], t));
  for (const [v, d] of partes) {
    formants.forEach((f, k) => f.frequency.linearRampToValueAtTime(VOGAIS[v][k], t + Math.min(0.06, d)));
    t += d;
  }
  voice.connect(out).connect(master);
  // "H" do começo: ar passando.
  noise({ dur: breath + 0.05, type: 'bandpass', f0: 1800, f1: 1400, q: 1.2, peak: peak * 0.35, delay });
  if (rasp) noise({ dur: total, type: 'bandpass', f0: 900, q: 2, peak: rasp, delay: delay + breath });
  src.start(t0);
  vib.start(t0);
  src.stop(t0 + total + 0.1);
  vib.stop(t0 + total + 0.1);
}

/**
 * @param name  nome do som
 * @param pitch tom da voz do lutador (para os gritos)
 */
export function sfx(name, pitch = 200) {
  if (!ctx || muted) return;
  switch (name) {
    // Ar cortado pelo golpe.
    case 'whoosh':
      noise({ dur: 0.13, type: 'bandpass', f0: 2600, f1: 700, q: 1.4, peak: 0.22 });
      break;
    case 'whooshHeavy':
      noise({ dur: 0.22, type: 'bandpass', f0: 1800, f1: 350, q: 1.2, peak: 0.3 });
      break;
    // Acertou: estalo seco + pancada no corpo.
    case 'hitLight':
      noise({ dur: 0.045, type: 'highpass', f0: 2500, peak: 0.55, attack: 0.001 });
      noise({ dur: 0.09, type: 'lowpass', f0: 1800, f1: 400, peak: 0.45 });
      thump({ f0: 190, f1: 70, dur: 0.11, peak: 0.6 });
      break;
    case 'hitHeavy':
      noise({ dur: 0.06, type: 'highpass', f0: 2000, peak: 0.7, attack: 0.001 });
      noise({ dur: 0.22, type: 'lowpass', f0: 2400, f1: 300, peak: 0.6 });
      thump({ f0: 150, f1: 38, dur: 0.3, peak: 0.9, drive: true });
      break;
    // Defendeu: "toc" no antebraço.
    case 'block':
      noise({ dur: 0.04, type: 'bandpass', f0: 1200, q: 3, peak: 0.5, attack: 0.001 });
      thump({ f0: 420, f1: 260, dur: 0.06, peak: 0.35 });
      break;
    case 'hadoken':
      noise({ dur: 0.45, type: 'bandpass', f0: 500, f1: 2400, q: 2, peak: 0.35, delay: 0.08 });
      tone('sawtooth', 120, 60, 0.4, 0.12, 0.08);
      break;
    case 'shoryuken':
      noise({ dur: 0.35, type: 'bandpass', f0: 600, f1: 3000, q: 2, peak: 0.3 });
      break;
    case 'jump':
      noise({ dur: 0.08, type: 'bandpass', f0: 900, f1: 1600, q: 1, peak: 0.12 });
      break;
    case 'land':
      thump({ f0: 120, f1: 50, dur: 0.08, peak: 0.35 });
      noise({ dur: 0.06, type: 'lowpass', f0: 600, peak: 0.2 });
      break;
    case 'super':
      noise({ dur: 0.9, type: 'bandpass', f0: 300, f1: 3500, q: 3, peak: 0.35 });
      [0, 0.09, 0.18].forEach((d, i) => tone('square', 330 * (i + 2), 330 * (i + 2), 0.14, 0.12, d));
      break;
    case 'ko':
      thump({ f0: 90, f1: 30, dur: 1.2, peak: 0.9, drive: true });
      noise({ dur: 0.9, type: 'lowpass', f0: 1200, f1: 100, peak: 0.5 });
      break;
    case 'round':
      tone('square', 523, 523, 0.12, 0.18);
      tone('square', 784, 784, 0.2, 0.18, 0.13);
      break;
    case 'fight':
      tone('square', 392, 392, 0.1, 0.22);
      tone('square', 784, 1046, 0.3, 0.22, 0.1);
      thump({ f0: 100, f1: 40, dur: 0.3, peak: 0.6, delay: 0.1 });
      break;
    case 'select':
      tone('triangle', 660, 990, 0.08, 0.25);
      break;

    // ---------------------------------------------------------------- vozes
    case 'kiaiCurto': // "Ha!" (golpe forte)
      voz(pitch, [['a', 0.13]], { peak: 0.42, glide: 0.8, breath: 0.035 });
      break;
    case 'kiai': // "HYAH!" (especial)
      voz(pitch * 1.05, [['y', 0.06], ['a', 0.24]], { peak: 0.55, glide: 0.7, breath: 0.05 });
      break;
    case 'kiaiSuper': // grito longo de super
      voz(pitch * 1.1, [['a', 0.15], ['a', 0.45]], { peak: 0.6, glide: 0.65, breath: 0.07, rasp: 0.08 });
      break;
    case 'dor': // "Uh!" apanhando
      voz(pitch * 0.92, [['u', 0.1]], { peak: 0.35, glide: 0.7, breath: 0.02 });
      break;
    case 'dorForte': // "Agh!" apanhando forte
      voz(pitch * 0.95, [['a', 0.08], ['o', 0.14]], { peak: 0.45, glide: 0.6, breath: 0.02, rasp: 0.06 });
      break;
    case 'derrota': // grito caindo no K.O.
      voz(pitch * 1.15, [['a', 0.2], ['o', 0.6]], { peak: 0.55, glide: 0.45, breath: 0.03, rasp: 0.07 });
      break;
    case 'vitoria': // "Yosh!"
      voz(pitch, [['o', 0.12], ['i', 0.1]], { peak: 0.5, glide: 0.95, breath: 0.03 });
      break;
    default: break;
  }
}

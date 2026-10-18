import { STORAGE_KEYS } from '../config.js';
import { MAP } from '../map/level.js';

export const Sound = (() => {
  let ctx = null,
    master,
    musicBus,
    sfxBus,
    noiseBuf,
    muted = false,
    musicOn = false,
    duck = 1;
  try {
    muted = localStorage.getItem(STORAGE_KEYS.muted) === '1';
  } catch (e) {}
  const MUSIC_VOL = 0.16,
    SFX_VOL = 0.55;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const NOTE = n => {
    const m = /^([A-G])(#|b)?(\d)$/.exec(n);
    return (
      12 * (+m[3] + 1) +
      { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] +
      (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
    );
  };

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = MUSIC_VOL;
      musicBus.connect(master);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = SFX_VOL;
      sfxBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      if (muted) ctx.suspend();
    }
    if (ctx.state === 'suspended' && !muted && !document.hidden) ctx.resume();
    return ctx;
  }

  /* --- building blocks --- */
  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }
  function tone(bus, type, f, t, a, peak, dec, f2) {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + dec);
    env(g, t, a, peak, dec);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + a + dec + 0.05);
  }
  // marimba-ish: a sine with a quick bright overtone
  function mallet(bus, m, t, vol, len) {
    const f = mtof(m);
    tone(bus, 'sine', f, t, 0.005, vol, len);
    tone(bus, 'sine', f * 4, t, 0.002, vol * 0.22, 0.07);
    tone(bus, 'triangle', f, t, 0.005, vol * 0.35, len * 0.6);
  }
  function noise(bus, t, dur, vol, ftype, f0, f1, q) {
    const src = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain();
    src.buffer = noiseBuf;
    src.loop = true;
    f.type = ftype;
    f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t);
    src.stop(t + dur + 0.05);
    return { f, g };
  }

  /* --- the tunes: 16 bars of eighth notes, looped. Each level picks one (MAP.song).
     '~' holds the note before, '.' rests. A note can end in ' (staccato: short and crisp) or > (accent: louder),
     and A+B plays two sixteenths in one eighth. --- */
  // Chords as note names in octave 2-3: [root, third, fifth]
  // prettier-ignore
  const CH = {
    C:['C3','E3','G3'], Am:['A2','C3','E3'], F:['F2','A2','C3'], G:['G2','B2','D3'], Dm:['D3','F3','A3'], Em:['E3','G3','B3'],
    Bb:['Bb2','D3','F3'], Gm:['G2','Bb2','D3'],
  };
  const SONGS = {
    // The original: bright and bouncy, C major, ~112 bpm
    bright: {
      bpm: 112,
      // prettier-ignore
      mel: [
        'E5 ~ G5 C6 ~ G5 E5 ~', 'A5 ~ G5 E5 ~ C5 D5 ~', 'F5 ~ A5 C6 ~ A5 G5 F5', 'G5 ~ ~ D5 ~ ~ . .',
        'E5 ~ G5 C6 ~ D6 E6 ~', 'D6 C6 A5 ~ G5 E5 ~ ~', 'F5 ~ E5 D5 ~ B4 D5 ~', 'C5 ~ ~ ~ . E5 F5 G5',
        'A5 ~ G5 ~ A5 C6 ~ A5', 'B5 ~ A5 ~ B5 D6 ~ B5', 'G5 ~ E5 ~ G5 B5 ~ ~', 'A5 ~ ~ ~ E5 . C5 .',
        'F5 ~ A5 ~ C6 ~ A5 ~', 'G5 ~ B5 ~ D6 ~ B5 ~', 'C6 ~ B5 A5 ~ E5 F5 G5', 'A5 ~ G5 ~ F5 ~ D5 ~'
      ],
      // chord per half bar
      // prettier-ignore
      prog: ['C C','Am Am','F F','G G','C C','Am Am','Dm G','C C','F F','G G','Em Em','Am Am','F F','G G','Am Am','G G'],
      melVol: 0.5,
      melLen: 0.95, // share of the written length a melody note rings for
      backing(v, ch, s8, bar, t, E8) {
        // bass: root, then octave and fifth bounces
        const bassPat = { 0: [ch[0] - 12, 0.55], 3: [ch[0], 0.3], 4: [ch[0] - 12, 0.45], 6: [ch[2] - 12, 0.35] };
        if (bassPat[s8]) tone(v, 'triangle', mtof(bassPat[s8][0]), t, 0.008, bassPat[s8][1], E8 * 1.6);
        // soft off-beat chord plucks
        if (s8 === 2 || s8 === 6) for (const m of ch) tone(v, 'square', mtof(m + 12), t, 0.004, 0.035, 0.12);
        // light percussion: thump on the beat, tick on the off-beat
        if (s8 === 0 || s8 === 4) tone(v, 'sine', 140, t, 0.003, 0.5, 0.11, 50);
        if (s8 % 2 === 1) noise(v, t, 0.04, 0.08, 'highpass', 7000);
        if (s8 === 4 && bar % 2 === 1) noise(v, t, 0.12, 0.12, 'bandpass', 1800, 900, 0.8);
      },
    },
    // Europe: the same instruments, lighter and more lyrical. F major, 120 bpm. A rising opening phrase that returns
    // three times (each time with a staccato pickup), and a middle section that sighs down in a sequence
    // (D minor, B flat, G minor), each bar ending in a little turn, then climbs back to the opening.
    calm: {
      bpm: 120,
      // prettier-ignore
      mel: [
        "C5' C5' F5 ~ A5> ~ ~ G5",  "F5 ~ E5+F5 G5' F5 ~ D5 ~",   "D5' D5' F5 ~ Bb5> ~ ~ A5",   "G5 ~ A5+G5 F5 G5 ~ . .",
        "C5' C5' F5 ~ A5 ~ Bb5+A5 C6", "D6> ~ C6 ~ A5 ~ E5' A5'", "Bb5 ~ A5' Bb5' G5 ~ E5+F5 E5", "F5 ~ ~ ~ A5' Bb5' C6' .",
        "D6> ~ ~ C6' A5 ~ ~ Bb5+A5", "Bb5> ~ ~ A5' F5 ~ ~ G5+F5", "G5> ~ ~ F5' D5 ~ ~ E5+D5",  "E5 ~ ~ F5' G5 ~ E5' D5'",
        "C5' C5' F5 ~ A5> ~ ~ G5",  "A5 ~ G5+A5 C6 D6> ~ C6 ~",   "Bb5 ~ ~ A5' G5 ~ A5+G5 E5",  'F5 ~ ~ ~ ~ ~ . .'
      ],
      // prettier-ignore
      prog: ['F F','Dm Dm','Bb Bb','C C','F F','Am Am','Bb C','F F','Dm Dm','Bb Bb','Gm Gm','C C','F F','Am Dm','Gm C','F F'],
      melVol: 0.44,
      melLen: 1.1, // held notes ring a little into the next one
      backing(v, ch, s8, bar, t, E8) {
        // bass: the root on the beat, the fifth halfway, and a light octave pickup into the next chord
        if (s8 === 0) tone(v, 'triangle', mtof(ch[0] - 12), t, 0.015, 0.48, E8 * 3);
        if (s8 === 4) tone(v, 'triangle', mtof(ch[2] - 12), t, 0.015, 0.34, E8 * 2.6);
        if (s8 === 7) tone(v, 'triangle', mtof(ch[0]), t, 0.008, 0.18, E8 * 0.9);
        // the chord, broken into a soft ripple instead of off-beat plucks
        const rip = { 1: 0, 2: 1, 3: 2, 5: 0, 6: 1, 7: 2 }[s8];
        if (rip !== undefined) tone(v, 'square', mtof(ch[rip] + 12), t, 0.005, 0.024, 0.22);
        // percussion: a thump on beats one and three, soft ticks on the off-beats
        if (s8 === 0) tone(v, 'sine', 130, t, 0.003, 0.4, 0.12, 50);
        if (s8 === 4) tone(v, 'sine', 130, t, 0.003, 0.24, 0.1, 50);
        if (s8 % 2 === 1) noise(v, t, 0.035, s8 === 3 || s8 === 7 ? 0.045 : 0.03, 'highpass', 7000);
      },
    },
  };
  for (const song of Object.values(SONGS)) {
    song.mel = song.mel.map(b => b.split(' '));
    song.prog = song.prog.map(x => x.split(' '));
  }
  const SONG = SONGS[MAP.song] ?? SONGS.bright,
    E8 = 60 / SONG.bpm / 2;
  let step = 0,
    nextT = 0,
    timer = null;

  function scheduleStep(i, t) {
    const bar = (i >> 3) % 16,
      s8 = i & 7,
      half = s8 >> 2;
    // melody
    const tok = SONG.mel[bar][s8];
    if (tok !== '~' && tok !== '.') {
      const notes = tok.split('+'),
        dt = E8 / notes.length;
      notes.forEach((n, k) => {
        const art = /['>]*$/.exec(n)[0],
          staccato = art.includes("'");
        let len = 1;
        if (notes.length === 1) while (s8 + len < 8 && SONG.mel[bar][s8 + len] === '~') len++;
        const ring = staccato ? 0.4 * dt : Math.max(0.18, len * dt * SONG.melLen);
        mallet(
          musicBus,
          NOTE(n.slice(0, n.length - art.length)),
          t + k * dt,
          SONG.melVol * (art.includes('>') ? 1.3 : 1),
          ring,
        );
      });
    }
    SONG.backing(musicBus, CH[SONG.prog[bar][half]].map(NOTE), s8, bar, t, E8);
  }
  function pump() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 0.2) {
      scheduleStep(step, nextT);
      step++;
      nextT += E8;
    }
    timer = setTimeout(pump, 40);
  }
  function startMusic() {
    if (!ensure()) return;
    clearTimeout(timer);
    musicOn = true;
    step = 0;
    nextT = ctx.currentTime + 0.08;
    setDuck(1, 0.05);
    pump();
  }
  function stopMusic() {
    musicOn = false;
    clearTimeout(timer);
    timer = null;
  }
  function setDuck(x, ramp) {
    duck = x;
    if (!ctx) return;
    const g = musicBus.gain;
    g.cancelScheduledValues(ctx.currentTime);
    g.setTargetAtTime(MUSIC_VOL * x, ctx.currentTime, ramp || 0.15);
  }

  /* --- effects --- */
  const now = () => ctx.currentTime + 0.005;
  let lastMerge = 0;
  const PENTA = [0, 2, 4, 7, 9];
  const fx = {
    drop() {
      if (!ensure()) return;
      const t = now();
      tone(sfxBus, 'sine', 420, t, 0.004, 0.45, 0.16, 140);
      noise(sfxBus, t, 0.05, 0.12, 'lowpass', 1200);
    },
    merge(size) {
      if (!ensure()) return;
      const t = now();
      if (t - lastMerge < 0.06) return;
      lastMerge = t;
      const k = Math.min(size, 24),
        m = 72 + 12 * Math.floor(k / 5) + PENTA[k % 5];
      mallet(sfxBus, Math.min(m, 100), t, 0.5, 0.35);
      mallet(sfxBus, Math.min(m + 7, 107), t + 0.07, 0.35, 0.4);
    },
    region() {
      if (!ensure()) return;
      const t = now();
      [72, 76, 79, 84].forEach((m, i) => mallet(sfxBus, m, t + i * 0.07, 0.42, 0.45));
    },
    shake(D) {
      if (!ensure()) return;
      const t = now(),
        d = D / 1000;
      [
        [0, 1],
        [0.3, 0.6],
        [0.6, 0.5],
      ].forEach(([o, a]) => {
        noise(sfxBus, t + o * d, d * 0.35, 0.5 * a, 'lowpass', 500, 150, 2);
        tone(sfxBus, 'sine', 70, t + o * d, 0.01, 0.5 * a, d * 0.3, 45);
      });
    },
    blend(D) {
      if (!ensure()) return;
      const t = now(),
        d = D / 1000;
      const src = ctx.createBufferSource(),
        f = ctx.createBiquadFilter(),
        g = ctx.createGain();
      src.buffer = noiseBuf;
      src.loop = true;
      f.type = 'bandpass';
      f.Q.value = 1.4;
      f.frequency.setValueAtTime(250, t);
      f.frequency.exponentialRampToValueAtTime(1800, t + d * 0.5);
      f.frequency.exponentialRampToValueAtTime(250, t + d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + d * 0.45);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(f).connect(g).connect(sfxBus);
      src.start(t);
      src.stop(t + d + 0.05);
      setDuck(0.45, 0.3);
      setTimeout(() => {
        if (musicOn) setDuck(1, 0.4);
      }, D);
    },
    bank() {
      if (!ensure()) return;
      const t = now();
      tone(sfxBus, 'square', mtof(76), t, 0.003, 0.12, 0.08);
      tone(sfxBus, 'square', mtof(83), t + 0.07, 0.003, 0.12, 0.12);
    },
    unbank() {
      if (!ensure()) return;
      const t = now();
      tone(sfxBus, 'square', mtof(83), t, 0.003, 0.12, 0.08);
      tone(sfxBus, 'square', mtof(76), t + 0.07, 0.003, 0.12, 0.12);
    },
    win() {
      if (!ensure()) return;
      const t = now();
      setDuck(0.25, 0.1);
      [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => mallet(sfxBus, m, t + i * 0.09, 0.5, i === 6 ? 1.2 : 0.3));
      [60, 64, 67, 72].forEach(m => tone(sfxBus, 'triangle', mtof(m), t + 0.63, 0.02, 0.18, 1.4));
      noise(sfxBus, t + 0.6, 0.5, 0.15, 'highpass', 5000);
    },
    // overflow is one second away: a quick high-low-high-low chime
    warn() {
      if (!ensure()) return;
      const t = now();
      [88, 83, 88, 83].forEach((m, i) => {
        mallet(sfxBus, m, t + i * 0.11, 0.4, 0.2);
        tone(sfxBus, 'square', mtof(m), t + i * 0.11, 0.003, 0.05, 0.08);
      });
    },
    lose() {
      if (!ensure()) return;
      const t = now();
      stopMusic();
      [67, 64, 60, 55].forEach((m, i) => {
        tone(sfxBus, 'triangle', mtof(m), t + i * 0.22, 0.01, 0.3, 0.35);
        mallet(sfxBus, m + 12, t + i * 0.22, 0.2, 0.3);
      });
    },
  };

  function setMuted(m) {
    muted = m;
    try {
      localStorage.setItem(STORAGE_KEYS.muted, m ? '1' : '0');
    } catch (e) {}
    const b = document.getElementById('muteBtn');
    b.setAttribute('aria-pressed', m);
    b.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
    b.title = b.getAttribute('aria-label');
    if (!ctx) return;
    master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.04);
    if (m)
      setTimeout(() => {
        if (muted) ctx.suspend();
      }, 200);
    else ctx.resume();
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (!muted) ctx.resume();
  });
  // browsers only allow audio after a tap or key press
  const unlock = () => {
    ensure();
  };
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });

  return {
    fx,
    startMusic,
    stopMusic,
    setDuck,
    setMuted,
    get muted() {
      return muted;
    },
    get musicOn() {
      return musicOn;
    },
  };
})();
document.getElementById('muteBtn').addEventListener('click', () => Sound.setMuted(!Sound.muted));
Sound.setMuted(Sound.muted); // sync the button with the saved choice

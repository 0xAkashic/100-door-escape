/* 100 Doors: Brain Escape — procedural audio engine.
   Everything here is synthesized with the Web Audio API, so there are
   no binary audio assets to ship, license, or keep in sync with a
   Termux-only workflow. Ambient music shifts mood per chapter; short
   SFX layer on top for taps, correct/wrong answers, hints and
   chapter/level-100 moments. */
const Audio100Doors = (() => {
  let ctx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicNodes = [];
  let musicChapter = null;
  let muted = localStorage.getItem('brain_muted') === '1';

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 1;
      masterGain.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(masterGain);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.35;
      sfxGain.connect(masterGain);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function isMuted() { return muted; }

  function setMuted(v) {
    muted = v;
    localStorage.setItem('brain_muted', v ? '1' : '0');
    if (ctx && masterGain) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setTargetAtTime(v ? 0 : 1, ctx.currentTime, 0.06);
    }
  }

  function toggleMuted() { setMuted(!muted); return muted; }

  function vibrate(ms) {
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
  }

  // ---- short one-shot SFX, built from plain oscillators ----
  function tone(freq, dur, type, gainVal, delay) {
    const c = ensureCtx();
    if (!c) return;
    const t0 = c.currentTime + (delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(gainVal || 0.2, 0.0002), t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function playTap() { tone(680, 0.05, 'square', 0.12); }

  function playCorrect() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.28, 'triangle', 0.22, i * 0.07));
    vibrate(12);
  }

  function playWrong() {
    tone(170, 0.28, 'sawtooth', 0.22);
    tone(120, 0.34, 'sawtooth', 0.16, 0.05);
    vibrate([10, 40, 10]);
  }

  function playHint() {
    tone(880, 0.12, 'sine', 0.16);
    tone(1108, 0.16, 'sine', 0.12, 0.07);
  }

  function playDoorOpen() {
    tone(220, 0.4, 'square', 0.1);
    tone(180, 0.5, 'square', 0.08, 0.05);
  }

  function playChapterFanfare() {
    [392, 494, 587.33, 784, 987.77].forEach((f, i) => tone(f, 0.32, 'triangle', 0.26, i * 0.11));
    vibrate([15, 30, 15, 30, 15]);
  }

  function playVictory() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 0.5, 'triangle', 0.26, i * 0.13));
    vibrate([20, 40, 20, 40, 40]);
  }

  // Looping musical bed: pad + arpeggio + soft kick, mood per chapter.
  function startMusicForChapter(chapterNum) {
    const c = ensureCtx();
    if (!c) return;
    if (musicChapter === chapterNum) return;
    stopMusic();
    musicChapter = chapterNum;

    const scales = [
      [220, 261.63, 329.63, 392, 440],
      [196, 246.94, 293.66, 392, 493.88],
      [174.61, 220, 261.63, 349.23, 440],
      [146.83, 196, 233.08, 293.66, 392],
      [130.81, 164.81, 196, 261.63, 329.63]
    ];
    const scale = scales[(chapterNum - 1) % scales.length];
    const root = scale[0] / 2;

    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    filter.Q.value = 0.6;
    filter.connect(musicGain);

    const bed = c.createGain();
    bed.gain.value = 0.0001;
    bed.connect(filter);
    bed.gain.exponentialRampToValueAtTime(0.9, c.currentTime + 1.6);

    const pad = c.createOscillator();
    pad.type = 'sine';
    pad.frequency.value = root;
    const pad2 = c.createOscillator();
    pad2.type = 'triangle';
    pad2.frequency.value = root * 1.5;
    const pad2g = c.createGain();
    pad2g.gain.value = 0.28;
    pad.connect(bed);
    pad2.connect(pad2g);
    pad2g.connect(bed);

    const lfo = c.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoG = c.createGain();
    lfoG.gain.value = 8;
    lfo.connect(lfoG);
    lfoG.connect(pad.frequency);

    const arpGain = c.createGain();
    arpGain.gain.value = 0.55;
    arpGain.connect(filter);
    const arp = c.createOscillator();
    arp.type = 'triangle';
    arp.frequency.value = scale[0];
    const arpEnv = c.createGain();
    arpEnv.gain.value = 0.0001;
    arp.connect(arpEnv);
    arpEnv.connect(arpGain);

    const step = 0.42 - Math.min(chapterNum, 8) * 0.015;
    let stepI = 0;
    const timer = setInterval(() => {
      if (!ctx || musicChapter !== chapterNum) return;
      const now = ctx.currentTime;
      const note = scale[stepI % scale.length] * (stepI % 8 > 5 ? 2 : 1);
      arp.frequency.setValueAtTime(note, now);
      arpEnv.gain.cancelScheduledValues(now);
      arpEnv.gain.setValueAtTime(0.0001, now);
      arpEnv.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
      arpEnv.gain.exponentialRampToValueAtTime(0.0001, now + step * 0.85);
      if (stepI % 4 === 0) tone(root / 2, 0.18, 'sine', 0.08);
      stepI++;
    }, step * 1000);

    [pad, pad2, lfo, arp].forEach(o => o.start());
    musicNodes = [pad, pad2, lfo, arp, bed, filter, { stop() { clearInterval(timer); } }];
  }

  return {
    ensureCtx, isMuted, setMuted, toggleMuted,
    playTap, playCorrect, playWrong, playHint,
    playDoorOpen, playChapterFanfare, playVictory,
    startMusicForChapter, stopMusic
  };
})();
window.Audio100Doors = Audio100Doors;

// Pachelbel's Canon in D, synthesized with Web Audio (no audio file).
// Shared by the library home page and Life Atelier: window.HJBCanon.create() → { start, stop, context }.
(() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  const BEAT = 0.92; // seconds per ground-bass note
  const LOOKAHEAD = 1.2; // seconds scheduled ahead

  const pitch = (name) => {
    const m = /^([A-G])(#?)(\d)$/.exec(name);
    const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
    return 440 * Math.pow(2, (12 * (Number(m[3]) + 1) + semis - 69) / 12);
  };
  const line = (str) => str.split(' ').map(pitch);

  // ground bass and the chords above it (D A Bm F#m G D G A)
  const BASS = line('D3 A2 B2 F#2 G2 D2 G2 A2');
  const CHORDS = ['D4 F#4 A4', 'C#4 E4 A4', 'B3 D4 F#4', 'A3 C#4 F#4', 'B3 D4 G4', 'A3 D4 F#4', 'B3 D4 G4', 'A3 C#4 E4'].map(line);
  // upper-voice variations; each spans the 8-note ground
  const VARIATIONS = [
    line('F#5 E5 D5 C#5 B4 A4 B4 C#5'),
    line('D5 C#5 B4 A4 G4 F#4 G4 E4'),
    line('D5 F#5 A5 G5 F#5 D5 F#5 E5 D5 B4 D5 A5 G5 B5 A5 G5'),
    line('D5 C#5 D5 D4 C#4 A4 E4 F#4 D4 D5 C#5 B4 C#5 F#5 A5 B5 G5 F#5 E5 G5 F#5 E5 D5 C#5 B4 A4 G4 F#4 E4 G4 F#4 E4'),
  ];
  // intro (ground only), then the variations build up and settle back
  const ORDER = [null, 0, 1, 2, 3, 2, 1, 0];

  const create = () => {
    if (!AC) return null;
    let ctx, master, bus, timer = null, beat = 0, nextTime = 0;

    const graph = () => {
      if (ctx) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24; comp.knee.value = 18; comp.ratio.value = 3; comp.attack.value = 0.05; comp.release.value = 0.6;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass'; tone.frequency.value = 3200; tone.Q.value = 0.4;
      master = ctx.createGain(); master.gain.value = 0.0001;
      bus = ctx.createGain(); bus.gain.value = 1;
      // a soft echo for room
      const delay = ctx.createDelay(1); delay.delayTime.value = 0.27;
      const feedback = ctx.createGain(); feedback.gain.value = 0.26;
      const wet = ctx.createGain(); wet.gain.value = 0.2;
      bus.connect(tone);
      bus.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(wet); wet.connect(tone);
      tone.connect(master); master.connect(comp); comp.connect(ctx.destination);
    };

    const voice = (freq, type, t, peak, attack, hold, release, detune = 0) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = type; osc.frequency.value = freq; osc.detune.value = detune;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + attack);
      gain.gain.setValueAtTime(peak, t + attack + hold);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
      osc.connect(gain); gain.connect(bus);
      osc.start(t); osc.stop(t + attack + hold + release + 0.05);
    };
    // plucked, harp-like upper voice
    const pluck = (freq, t, length) => {
      const decay = Math.min(2.4, Math.max(0.7, length * 2.6));
      voice(freq, 'triangle', t, 0.05, 0.012, 0, decay);
      voice(freq * 2, 'sine', t, 0.012, 0.008, 0, decay * 0.5);
    };

    const scheduleBeat = (t) => {
      const i = beat % 8;
      const section = ORDER[Math.floor(beat / 8) % ORDER.length];
      voice(BASS[i], 'triangle', t, 0.07, 0.04, BEAT * 0.55, BEAT * 0.7);
      voice(BASS[i], 'sine', t, 0.05, 0.04, BEAT * 0.55, BEAT * 0.7);
      CHORDS[i].forEach((f, k) => voice(f, 'sine', t + k * 0.015, 0.011, 0.3, BEAT * 0.5, BEAT * 0.9, k % 2 ? 4 : -4));
      if (section !== null) {
        const notes = VARIATIONS[section];
        const per = notes.length / 8;
        for (let k = 0; k < per; k += 1) pluck(notes[i * per + k], t + (k * BEAT) / per, BEAT / per);
      }
      beat += 1;
    };

    const pump = () => {
      while (nextTime < ctx.currentTime + LOOKAHEAD) {
        scheduleBeat(nextTime);
        nextTime += BEAT;
      }
    };

    return {
      get context() { return ctx; },
      async start() {
        graph();
        try { await ctx.resume(); } catch (e) {}
        if (timer) return;
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
        master.gain.exponentialRampToValueAtTime(0.8, now + 1.6);
        beat = 0; nextTime = now + 0.1;
        pump();
        timer = setInterval(pump, 250);
      },
      stop() {
        clearInterval(timer); timer = null;
        if (!ctx) return;
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
      },
    };
  };

  window.HJBCanon = { create };
})();

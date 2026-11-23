(() => {
  const button = document.querySelector('#music-toggle');
  if (!button) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const preferenceKey = 'hjb-background-music';
  const progression = [
    [146.83, 220.00, 293.66, 369.99],
    [123.47, 185.00, 246.94, 293.66],
    [98.00, 146.83, 220.00, 277.18],
    [110.00, 164.81, 220.00, 329.63]
  ];

  let context;
  let master;
  let chordTimer;
  let step = 0;
  let voices = [];
  let playing = false;
  let enabled = false;

  try {
    enabled = window.localStorage.getItem(preferenceKey) === 'on';
  } catch {}

  const syncButton = () => {
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? '배경음악 끄기' : '배경음악 켜기');
    button.title = enabled ? '배경음악 끄기' : '배경음악 켜기';
  };

  const savePreference = () => {
    try {
      window.localStorage.setItem(preferenceKey, enabled ? 'on' : 'off');
    } catch {}
  };

  const createAudioGraph = () => {
    if (context) return;
    context = new AudioContextClass();

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -32;
    compressor.knee.value = 20;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.15;
    compressor.release.value = 1.1;

    const warmth = context.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.value = 1450;
    warmth.Q.value = 0.45;

    master = context.createGain();
    master.gain.value = 0.0001;
    master.connect(warmth);
    warmth.connect(compressor);
    compressor.connect(context.destination);
  };

  const releaseVoices = (releaseTime = 2.5) => {
    if (!context) return;
    const now = context.currentTime;
    voices.forEach(({ oscillator, gain }) => {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
      oscillator.stop(now + releaseTime + 0.1);
    });
    voices = [];
  };

  const playChord = (frequencies) => {
    if (!context || !playing) return;
    releaseVoices(3.2);
    const now = context.currentTime;

    voices = frequencies.flatMap((frequency, index) => {
      return [-5, 5].map((detune, layer) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = layer === 0 ? 'sine' : 'triangle';
        oscillator.frequency.value = frequency;
        oscillator.detune.value = detune;

        const peak = (layer === 0 ? 0.012 : 0.0045) * (1 - index * 0.08);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + 2.4 + index * 0.18);
        gain.gain.setValueAtTime(peak, now + 6.2);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 10.5);

        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(now + index * 0.12);
        oscillator.stop(now + 10.7);
        return { oscillator, gain };
      });
    });
  };

  const scheduleChord = () => {
    if (!playing) return;
    playChord(progression[step % progression.length]);
    step += 1;
    chordTimer = window.setTimeout(scheduleChord, 7600);
  };

  const startMusic = async () => {
    if (!AudioContextClass || !enabled) return;
    createAudioGraph();
    await context.resume();
    if (playing) return;

    playing = true;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.72, now + 1.8);
    scheduleChord();
  };

  const stopMusic = () => {
    playing = false;
    window.clearTimeout(chordTimer);
    releaseVoices(1.2);
    if (!context || !master) return;

    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    window.setTimeout(() => {
      if (!enabled && context?.state === 'running') context.suspend();
    }, 1200);
  };

  if (!AudioContextClass) {
    button.disabled = true;
    button.setAttribute('aria-label', '이 브라우저에서는 배경음악을 지원하지 않습니다');
    button.title = '배경음악을 지원하지 않는 브라우저입니다';
    return;
  }

  button.addEventListener('click', async () => {
    enabled = !enabled;
    savePreference();
    syncButton();
    if (enabled) await startMusic();
    else stopMusic();
  });

  if (enabled) {
    const unlock = () => startMusic();
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
  }

  document.addEventListener('visibilitychange', () => {
    if (!context) return;
    if (document.hidden && context.state === 'running') context.suspend();
    else if (!document.hidden && enabled) context.resume();
  });

  syncButton();
})();

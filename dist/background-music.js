(() => {
  const button = document.querySelector('#music-toggle');
  if (!button) return;

  // Pachelbel's Canon from canon-music.js (shared with Life Atelier)
  const player = window.HJBCanon && window.HJBCanon.create();
  const preferenceKey = 'hjb-background-music';
  let enabled = false;
  let suspendTimer;

  try {
    enabled = window.localStorage.getItem(preferenceKey) === 'on';
  } catch {}

  const syncButton = () => {
    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? '배경음악 끄기' : '배경음악 켜기');
    button.title = enabled ? '배경음악 끄기 (캐논)' : '배경음악 켜기 (캐논)';
  };

  const savePreference = () => {
    try {
      window.localStorage.setItem(preferenceKey, enabled ? 'on' : 'off');
    } catch {}
  };

  const startMusic = async () => {
    if (!enabled) return;
    window.clearTimeout(suspendTimer);
    await player.start();
  };

  const stopMusic = () => {
    player.stop();
    suspendTimer = window.setTimeout(() => {
      const context = player.context;
      if (!enabled && context?.state === 'running') context.suspend();
    }, 1200);
  };

  if (!player) {
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

  // Browsers block autoplay: a saved "on" preference resumes on the first interaction.
  if (enabled) {
    const unlock = (event) => {
      if (event.target?.closest?.('#music-toggle')) return;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      startMusic();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);
  }

  document.addEventListener('visibilitychange', () => {
    const context = player.context;
    if (!context) return;
    if (document.hidden && context.state === 'running') context.suspend();
    else if (!document.hidden && enabled) context.resume();
  });

  syncButton();
})();
